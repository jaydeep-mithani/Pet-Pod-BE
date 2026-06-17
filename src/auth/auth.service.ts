import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { BCRYPT_ROUNDS } from './auth.constants';
import type { JwtPayload } from './types';
import type { GoogleProfilePayload } from './strategies/google.strategy';

export interface TokenPair {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface AuthResult {
  user: { id: string; email: string; name: string };
  tokens: TokenPair;
}

interface GoogleAuthResult extends AuthResult {
  /** True when this OAuth callback created a brand-new user record. */
  isNew: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name.trim(),
      },
      select: { id: true, email: true, name: true },
    });

    // The /verify-email page auto-sends the first code on mount. Doing it
    // here too caused a race where the FE's send invalidated the BE's send
    // and users entered the code from the (now-invalidated) first email.
    const tokens = await this.issueTokens(user.id, user.email);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // No password on the account means the user signed up via Google. Use a
    // distinct error code so the FE can show only the toast (no misleading
    // "wrong password" field error).
    if (!user.passwordHash) {
      throw new UnauthorizedException({
        message:
          'This account uses Google sign-in. Please continue with Google.',
        code: 'USE_GOOGLE_SIGNIN',
      });
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
  }

  /**
   * Create-or-link a Google identity and issue our own auth tokens. Three
   * paths:
   *   1. A user already exists with this googleId → log them in.
   *   2. A user exists with this email (signed up via password) → link the
   *      Google identity to the existing account and log in.
   *   3. No user yet → create a fresh one with email pre-verified (Google
   *      already verified the address) and avatar from the Google profile.
   */
  async loginWithGoogle(
    profile: GoogleProfilePayload,
  ): Promise<GoogleAuthResult> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
      select: { id: true, email: true, name: true },
    });
    let isNew = false;

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true, email: true, name: true },
      });

      if (byEmail) {
        // Existing password-based account → link the Google identity.
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            // If they hadn't verified yet, Google's verification counts.
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, email: true, name: true },
        });
      } else {
        // Brand-new user — pre-verified, avatar pulled from Google profile.
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, email: true, name: true },
        });
        isNew = true;
      }
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user, tokens, isNew };
  }

  async refresh(
    userId: string,
    presentedRefreshToken: string,
  ): Promise<TokenPair> {
    const presentedHash = this.hashToken(presentedRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: presentedHash },
    });

    if (
      !stored ||
      stored.userId !== userId ||
      stored.revokedAt ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });
    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string, presentedRefreshToken: string | undefined) {
    if (!presentedRefreshToken) return;
    const presentedHash = this.hashToken(presentedRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash: presentedHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };

    const accessMs = this.parseDurationMs(
      this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
    );
    const refreshMs = this.parseDurationMs(
      this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(accessMs / 1000),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(refreshMs / 1000),
    });

    const now = Date.now();
    const accessExpiresAt = new Date(now + accessMs);
    const refreshExpiresAt = new Date(now + refreshMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(input: string): number {
    const match = /^(\d+)([smhd])$/.exec(input.trim());
    if (!match) {
      throw new Error(`Invalid duration string: ${input}`);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}
