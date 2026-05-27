import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  bio: true,
  city: true,
  region: true,
  country: true,
  createdAt: true,
} as const;

// Public-facing fields. Notably excludes email.
const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  bio: true,
  city: true,
  region: true,
  country: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(id: string, dto: UpdateMeDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) data.bio = dto.bio?.trim() || null;
    if (dto.city !== undefined) data.city = dto.city?.trim() || null;
    if (dto.region !== undefined) data.region = dto.region?.trim() || null;
    if (dto.country !== undefined) {
      data.country = dto.country ? dto.country.toUpperCase() : null;
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PROFILE_SELECT,
    });
  }
}
