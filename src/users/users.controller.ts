import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types';
import { clearAuthCookies } from '../auth/cookies';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { DeleteMeDto } from './dto/delete-me.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  @ApiCookieAuth('pp_access')
  @ApiOperation({ summary: 'Current authenticated user profile.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.users.findById(user.id);
  }

  @ApiCookieAuth('pp_access')
  @ApiOperation({ summary: 'Update current user profile.' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.users.updateMe(user.id, dto);
  }

  @ApiCookieAuth('pp_access')
  @ApiOperation({
    summary:
      'Delete (anonymize) the current account. Conversations stay readable for the other side; listings are taken down and every session is revoked.',
  })
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteMe(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: DeleteMeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.users.anonymizeMe(user.id, dto.password);
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @ApiOperation({
    summary: 'Public profile view — used in chat and pet detail links.',
  })
  @Get(':id')
  getPublic(@Param('id') id: string) {
    return this.users.findPublicById(id);
  }
}
