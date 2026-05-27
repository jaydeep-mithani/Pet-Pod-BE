import { PartialType } from '@nestjs/mapped-types';
import { PetStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePetDto } from './create-pet.dto';

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;
}
