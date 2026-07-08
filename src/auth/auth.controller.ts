import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, type TokenPair } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { COOKIE_REFRESH } from './auth.constants';
import {
  clearAuthCookies as clearAuthCookiesShared,
  setAuthCookies as setAuthCookiesShared,
} from './cookies';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from './types';
import type { JwtRefreshUser } from './strategies/jwt-refresh.strategy';
import type { GoogleProfilePayload } from './strategies/google.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Create a new account and set auth cookies.' })
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

  @ApiOperation({ summary: 'Exchange credentials for auth cookies.' })
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

  @ApiCookieAuth('pp_refresh')
  @ApiOperation({
    summary:
      'Rotate the refresh token and issue a new access token. Requires pp_refresh cookie.',
  })
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

  @ApiCookieAuth('pp_access')
  @ApiOperation({
    summary: 'Revoke the current refresh token and clear auth cookies.',
  })
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

  @ApiCookieAuth('pp_access')
  @ApiOperation({
    summary:
      'Change the password (or set a first one for Google-only accounts). Signs out all other sessions; this one is rotated and stays alive.',
  })
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.changePassword(user.id, dto);
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @ApiCookieAuth('pp_access')
  @ApiOperation({
    summary:
      'Sign out every other session — revokes all refresh tokens except the one presented by this device.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
    const revoked = await this.auth.logoutAllOthers(
      user.id,
      cookies[COOKIE_REFRESH],
    );
    return { revoked };
  }

  @ApiOperation({
    summary:
      'Begin Google OAuth — redirects the user to Google’s consent screen.',
  })
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  google(): void {
    // GoogleAuthGuard handles the redirect to Google; this handler never
    // actually runs its body, but Nest requires a method to attach the route.
  }

  @ApiOperation({
    summary:
      'Google OAuth callback — creates-or-links the user, sets auth cookies, and redirects back to the FE.',
  })
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request & { user?: GoogleProfilePayload },
    @Res() res: Response,
  ) {
    const profile = req.user;
    if (!profile) {
      // Should never happen — GoogleAuthGuard rejects the request before us
      // if the OAuth flow didn't yield a profile.
      return res.redirect(this.failureRedirectUrl());
    }

    const result = await this.auth.loginWithGoogle(profile);
    this.setAuthCookies(res, result.tokens);
    // New users land on /welcome so they can review (or change) the avatar
    // we pulled from their Google profile. Returning users go straight home.
    return res.redirect(this.successRedirectUrl(result.isNew));
  }

  private successRedirectUrl(isNew: boolean): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
    const path = isNew ? '/welcome' : '/';
    return `${base}${path}`;
  }

  private failureRedirectUrl(): string {
    const base = this.config.get<string>('APP_URL') ?? '';
    return base
      ? `${base.replace(/\/$/, '')}/login?error=oauth`
      : '/login?error=oauth';
  }

  // Thin delegates to the shared helpers in ./cookies (also used by
  // UsersController for account deletion) — keeps call sites above tidy.
  private setAuthCookies(res: Response, tokens: TokenPair) {
    setAuthCookiesShared(res, this.config, tokens);
  }

  private clearAuthCookies(res: Response) {
    clearAuthCookiesShared(res, this.config);
  }
}
