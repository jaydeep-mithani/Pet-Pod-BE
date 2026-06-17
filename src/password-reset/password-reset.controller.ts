import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Password Reset')
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly resets: PasswordResetService) {}

  @ApiOperation({
    summary:
      'Request a password reset email. Always returns 200 — never reveals whether an account exists.',
  })
  // IP-scoped throttle. Tighter than the default; per-user 3/hour is
  // enforced silently in the service to avoid leaking account existence.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  forgot(@Body() dto: RequestResetDto) {
    return this.resets.requestReset(dto.email);
  }

  @ApiOperation({
    summary:
      'Submit a reset token and new password. Returns 200 on success, 400 if the token is invalid or expired.',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Body() dto: ResetPasswordDto) {
    return this.resets.resetPassword(dto.token, dto.password);
  }
}
