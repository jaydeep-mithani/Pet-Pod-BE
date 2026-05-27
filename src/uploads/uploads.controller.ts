import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('signature')
  @HttpCode(HttpStatus.OK)
  sign(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.cloudinary.signUpload(user.id);
  }
}
