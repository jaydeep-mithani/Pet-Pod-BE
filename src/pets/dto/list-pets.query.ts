import { PetSpecies, PetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPetsQuery {
  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
