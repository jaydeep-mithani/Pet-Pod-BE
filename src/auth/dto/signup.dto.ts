import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @IsStrongPassword()
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;
}
