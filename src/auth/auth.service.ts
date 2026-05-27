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

    const tokens = await this.issueTokens(user.id, user.email);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
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
