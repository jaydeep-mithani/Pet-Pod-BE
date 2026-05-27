import { PetSize, PetSpecies } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PhotoInputDto } from './photo-input.dto';

export class CreatePetDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsEnum(PetSpecies)
  species!: PetSpecies;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @IsInt()
  @Min(0)
  @Max(360)
  ageMonths!: number;

  @IsEnum(PetSize)
  size!: PetSize;

  @IsString()
  @MinLength(10)
  @MaxLength(280)
  shortDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonForRehoming?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsString()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PhotoInputDto)
  photos?: PhotoInputDto[];
}
