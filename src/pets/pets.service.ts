import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { ListPetsQuery } from './dto/list-pets.query';

const PET_LIST_SELECT = {
  id: true,
  name: true,
  species: true,
  breed: true,
  ageMonths: true,
  size: true,
  shortDescription: true,
  city: true,
  region: true,
  country: true,
  status: true,
  createdAt: true,
  photos: {
    select: { id: true, url: true, order: true },
    orderBy: { order: 'asc' },
    take: 5,
  },
} satisfies Prisma.PetSelect;

const PET_DETAIL_SELECT = {
  id: true,
  name: true,
  species: true,
  breed: true,
  ageMonths: true,
  size: true,
  shortDescription: true,
  story: true,
  reasonForRehoming: true,
  city: true,
  region: true,
  country: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  photos: {
    select: { id: true, url: true, order: true },
    orderBy: { order: 'asc' },
  },
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      city: true,
      region: true,
      country: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PetSelect;

@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  list(query: ListPetsQuery) {
    return this.prisma.pet.findMany({
      where: {
        status: query.status ?? 'AVAILABLE',
        species: query.species,
        ownerId: query.ownerId,
        ...(query.city
          ? { city: { contains: query.city, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 24,
      select: PET_LIST_SELECT,
    });
  }

  listOwnedBy(ownerId: string) {
    return this.prisma.pet.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: PET_LIST_SELECT,
    });
  }

  async getById(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      select: PET_DETAIL_SELECT,
    });
    if (!pet) throw new NotFoundException('Pet not found');
    return pet;
  }

  create(ownerId: string, dto: CreatePetDto) {
    const { photos, ...petData } = dto;
    return this.prisma.pet.create({
      data: {
        ...petData,
        ownerId,
        photos: photos?.length
          ? {
              create: photos.map((p, index) => ({
                url: p.url,
                publicId: p.publicId,
                order: index,
              })),
            }
          : undefined,
      },
      select: PET_DETAIL_SELECT,
    });
  }

  async update(id: string, ownerId: string, dto: UpdatePetDto) {
    await this.assertOwnership(id, ownerId);
    const { photos, ...rest } = dto;
    void photos;
    return this.prisma.pet.update({
      where: { id },
      data: rest,
      select: PET_DETAIL_SELECT,
    });
  }

  async remove(id: string, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    const photos = await this.prisma.photo.findMany({
      where: { petId: id, publicId: { not: null } },
      select: { publicId: true },
    });
    await this.prisma.pet.delete({ where: { id } });
    await Promise.all(
      photos
        .filter((p): p is { publicId: string } => Boolean(p.publicId))
        .map((p) => this.cloudinary.deleteByPublicId(p.publicId)),
    );
  }

  async addPhoto(petId: string, ownerId: string, dto: AddPhotoDto) {
    await this.assertOwnership(petId, ownerId);
    const existing = await this.prisma.photo.count({ where: { petId } });
    return this.prisma.photo.create({
      data: {
        petId,
        url: dto.url,
        publicId: dto.publicId,
        order: dto.order ?? existing,
      },
      select: { id: true, url: true, order: true, publicId: true },
    });
  }

  async reorderPhotos(petId: string, ownerId: string, photoIds: string[]) {
    await this.assertOwnership(petId, ownerId);

    // Two-actor races are real here: a stale reorder request may include ids
    // for photos the user just deleted. Skip those rather than 400-ing the
    // whole call — the remaining ids still reflect a meaningful intent.
    const existing = await this.prisma.photo.findMany({
      where: { petId, id: { in: photoIds } },
      select: { id: true },
    });
    const existingSet = new Set(existing.map((p) => p.id));
    const seen = new Set<string>();
    const filtered = photoIds.filter((id) => {
      if (!existingSet.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (filtered.length > 0) {
      await this.prisma.$transaction(
        filtered.map((id, order) =>
          this.prisma.photo.update({ where: { id }, data: { order } }),
        ),
      );
    }

    return this.prisma.photo.findMany({
      where: { petId },
      orderBy: { order: 'asc' },
      select: { id: true, url: true, order: true },
    });
  }

  async removePhoto(petId: string, photoId: string, ownerId: string) {
    await this.assertOwnership(petId, ownerId);
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.petId !== petId) {
      throw new NotFoundException('Photo not found');
    }
    await this.prisma.photo.delete({ where: { id: photoId } });
    if (photo.publicId) {
      await this.cloudinary.deleteByPublicId(photo.publicId);
    }
  }

  private async assertOwnership(petId: string, ownerId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { ownerId: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.ownerId !== ownerId) {
      throw new ForbiddenException("You don't own this pet");
    }
  }
}
