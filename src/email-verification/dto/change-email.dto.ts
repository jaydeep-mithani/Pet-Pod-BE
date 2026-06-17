import { IsEmail, MaxLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
