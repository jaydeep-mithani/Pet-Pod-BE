import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { COOKIE_ACCESS } from '../auth.constants';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedRequestUser } from '../types';

const cookieExtractor = (req: Request): string | null => {
  const cookies = (req?.cookies as Record<string, string> | undefined) ?? {};
  const raw = cookies[COOKIE_ACCESS];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedRequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException();

    // Revoke access tokens issued before the last password reset.
    // RefreshToken revocation alone leaves access JWTs valid until natural
    // expiry — comparing iat vs passwordChangedAt closes that window.
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      const iatMs = payload.iat * 1000;
      if (iatMs < user.passwordChangedAt.getTime()) {
        throw new UnauthorizedException();
      }
    }

    return { id: user.id, email: user.email };
  }
}
