import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string | null;
}
