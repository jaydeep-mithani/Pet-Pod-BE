import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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

  @ApiOperation({
    summary: 'Public profile view — used in chat and pet detail links.',
  })
  @Get(':id')
  getPublic(@Param('id') id: string) {
    return this.users.findPublicById(id);
  }
}
