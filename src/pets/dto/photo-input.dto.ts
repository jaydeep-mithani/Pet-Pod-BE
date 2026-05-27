import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class PhotoInputDto {
  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicId?: string;
}
