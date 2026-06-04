import {
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
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @ApiCookieAuth('pp_access')
  @ApiOperation({
    summary:
      'Sign a Cloudinary direct-upload — client uses the signature to PUT the file straight to Cloudinary without proxying it through this API.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('signature')
  @HttpCode(HttpStatus.OK)
  sign(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.cloudinary.signUpload(user.id);
  }
}
