import { IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  // Plaintext reset token from the email link (64 hex chars from 32 random
  // bytes). We don't validate length strictly to avoid leaking the token
  // format; the BE rejects mismatched tokens generically anyway.
  @IsString()
  @Length(16, 256)
  token!: string;

  // Bumped to 10 chars on the reset path per the security review — reset is
  // a privileged moment and slightly stricter than signup is appropriate.
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  @IsStrongPassword()
  password!: string;
}
