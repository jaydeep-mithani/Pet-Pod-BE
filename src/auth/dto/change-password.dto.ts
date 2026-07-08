import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ChangePasswordDto {
  // Omitted only by Google-only accounts setting their first password — the
  // service enforces presence whenever the account already has a password.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentPassword?: string;

  // Matches the reset path (10-char minimum) — changing a password is a
  // privileged moment, so it gets the stricter minimum plus the strength gate.
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  @IsStrongPassword()
  newPassword!: string;
}
