import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { COOKIE_REFRESH } from '../auth.constants';
import type { JwtPayload } from '../types';

const cookieExtractor = (req: Request): string | null => {
  const cookies = (req?.cookies as Record<string, string> | undefined) ?? {};
  const raw = cookies[COOKIE_REFRESH];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
};

export interface JwtRefreshUser {
  id: string;
  email: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshUser {
    const token = cookieExtractor(req);
    if (!token) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, refreshToken: token };
  }
}
