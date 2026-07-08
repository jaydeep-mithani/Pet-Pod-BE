import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteMeDto {
  // Required by the service for accounts that have a password; Google-only
  // accounts (passwordHash null) confirm in the UI instead.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;
}
