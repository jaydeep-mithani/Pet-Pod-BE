import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class AddPhotoDto {
  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
