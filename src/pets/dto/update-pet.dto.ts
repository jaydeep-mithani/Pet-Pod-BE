import { PartialType } from '@nestjs/mapped-types';
import { PetStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { CreatePetDto } from './create-pet.dto';

// REMOVED is system-only (set by account deletion), so clients may only pick
// from the user-facing statuses — IsIn instead of IsEnum on purpose.
const USER_SETTABLE_STATUSES = [
  PetStatus.AVAILABLE,
  PetStatus.PENDING,
  PetStatus.ADOPTED,
] as const;

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsOptional()
  @IsIn(USER_SETTABLE_STATUSES)
  status?: (typeof USER_SETTABLE_STATUSES)[number];
}
