import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/types';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { ListPetsQuery } from './dto/list-pets.query';

@Controller('pets')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  list(@Query() query: ListPetsQuery) {
    return this.pets.list(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.pets.listOwnedBy(user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.pets.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreatePetDto,
  ) {
    return this.pets.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdatePetDto,
  ) {
    return this.pets.update(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.pets.remove(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/photos')
  addPhoto(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: AddPhotoDto,
  ) {
    return this.pets.addPhoto(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/photos/order')
  reorderPhotos(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.pets.reorderPhotos(id, user.id, dto.photoIds);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.pets.removePhoto(id, photoId, user.id);
  }
}
