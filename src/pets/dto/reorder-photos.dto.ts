import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photoIds!: string[];
}
