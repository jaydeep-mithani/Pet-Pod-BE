import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  emailVerified: true,
  createdAt: true,
} as const;

// The /me payload adds credential flags the settings page needs. The raw
// columns never leave this service — they're mapped to booleans in toMe().
const USER_ME_SELECT = {
  ...USER_PROFILE_SELECT,
  passwordHash: true,
  googleId: true,
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
      select: USER_ME_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toMe(user);
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
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_ME_SELECT,
    });
    return this.toMe(user);
  }

  /**
   * Anonymize-delete: the row survives (scrubbed) so conversations stay
   * readable for the other participant, but the account can never be used
   * again — deletedAt blocks login/refresh/JWT validation, the tombstoned
   * email frees the real address for a fresh signup, and listings flip to
   * REMOVED (kept because conversations cascade from Pet).
   */
  async anonymizeMe(id: string, password?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException();

    // Password-holding accounts must re-prove possession; Google-only
    // accounts have nothing to check (the UI adds a typed confirmation).
    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException(
          'Password is required to delete your account',
        );
      }
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('Password is incorrect');
      }
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          name: 'Deleted user',
          email: `deleted+${id}@petpod.invalid`,
          passwordHash: null,
          googleId: null,
          avatarUrl: null,
          bio: null,
          city: null,
          region: null,
          country: null,
          emailVerified: false,
          emailVerifiedAt: null,
          deletedAt: now,
        },
      }),
      this.prisma.pet.updateMany({
        where: { ownerId: id },
        data: { status: 'REMOVED' },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.emailVerification.deleteMany({ where: { userId: id } }),
      this.prisma.passwordReset.deleteMany({ where: { userId: id } }),
    ]);
  }

  /** Map a USER_ME_SELECT row to the /me payload: credential flags only. */
  private toMe<
    T extends { passwordHash: string | null; googleId: string | null },
  >(user: T) {
    const { passwordHash, googleId, ...profile } = user;
    return {
      ...profile,
      hasPassword: passwordHash !== null,
      googleLinked: googleId !== null,
    };
  }
}
