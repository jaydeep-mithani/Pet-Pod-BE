import type { CookieOptions, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { COOKIE_ACCESS, COOKIE_REFRESH } from './auth.constants';
import type { TokenPair } from './auth.service';

/**
 * Shared auth-cookie plumbing. Lives outside AuthController because other
 * controllers also need it — e.g. DELETE /users/me clears the session after
 * an account deletion.
 */
export function baseCookieOptions(config: ConfigService): CookieOptions {
  const isSecure = config.get<string>('COOKIE_SECURE') === 'true';
  const domain = config.get<string>('COOKIE_DOMAIN') || undefined;
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    domain,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  tokens: TokenPair,
): void {
  const base = baseCookieOptions(config);
  res.cookie(COOKIE_ACCESS, tokens.accessToken, {
    ...base,
    expires: tokens.accessExpiresAt,
  });
  res.cookie(COOKIE_REFRESH, tokens.refreshToken, {
    ...base,
    expires: tokens.refreshExpiresAt,
    path: '/auth',
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const base = baseCookieOptions(config);
  res.clearCookie(COOKIE_ACCESS, base);
  res.clearCookie(COOKIE_REFRESH, { ...base, path: '/auth' });
}
