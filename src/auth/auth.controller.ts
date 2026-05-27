import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AuthService, type TokenPair } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { COOKIE_ACCESS, COOKIE_REFRESH } from './auth.constants';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from './types';
import type { JwtRefreshUser } from './strategies/jwt-refresh.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.signup(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: JwtRefreshUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.refresh(user.id, user.refreshToken);
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies =
      (res.req.cookies as Record<string, string> | undefined) ?? {};
    await this.auth.logout(user.id, cookies[COOKIE_REFRESH]);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  private setAuthCookies(res: Response, tokens: TokenPair) {
    const base = this.baseCookieOptions();
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

  private clearAuthCookies(res: Response) {
    const base = this.baseCookieOptions();
    res.clearCookie(COOKIE_ACCESS, base);
    res.clearCookie(COOKIE_REFRESH, { ...base, path: '/auth' });
  }

  private baseCookieOptions(): CookieOptions {
    const isSecure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      domain,
      path: '/',
    };
  }
}
