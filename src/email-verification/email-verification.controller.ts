import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types';
import { ChangeEmailDto } from './dto/change-email.dto';
import { CheckCodeDto } from './dto/check-code.dto';
import { EmailVerificationService } from './email-verification.service';

@ApiTags('Email Verification')
@ApiCookieAuth('pp_access')
@UseGuards(JwtAuthGuard)
@Controller('auth/verify')
export class EmailVerificationController {
  constructor(private readonly verification: EmailVerificationService) {}

  @ApiOperation({
    summary: 'Send a fresh 6-digit verification code to the user’s email.',
  })
  @Post('send')
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.verification.sendCode(user.id);
  }

  @ApiOperation({
    summary: 'Validate a 6-digit code and mark the user’s email as verified.',
  })
  @Post('check')
  @HttpCode(HttpStatus.OK)
  check(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CheckCodeDto,
  ) {
    return this.verification.checkCode(user.id, dto.code);
  }

  @ApiOperation({
    summary:
      'Replace the unverified user’s email and send a fresh code to the new address. Refuses if the email is already verified.',
  })
  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  changeEmail(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ChangeEmailDto,
  ) {
    return this.verification.changeEmail(user.id, dto.email);
  }
}
