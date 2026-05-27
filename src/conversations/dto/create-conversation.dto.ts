import { IsString, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MinLength(1)
  petId!: string;
}
