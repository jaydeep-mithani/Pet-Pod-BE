import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Bucket a password into five tiers (1 Very weak -> 5 Very strong). Mirrors the
 * frontend scorer (Pet-Pod-FE/src/lib/validation/password.ts) so the client
 * strength meter and this server gate agree. One point each for reaching 8 and
 * 12 characters, mixing upper- and lower-case, including a digit, and including
 * a symbol.
 */
export function scorePasswordStrength(password: string): PasswordStrengthLevel {
  if (!password) return 0;
  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  return Math.max(1, points) as PasswordStrengthLevel;
}

/** Minimum tier accepted -- "Medium" (3). Keep in sync with the frontend. */
export const MIN_PASSWORD_STRENGTH: PasswordStrengthLevel = 3;

export function isPasswordStrongEnough(password: unknown): boolean {
  return (
    typeof password === 'string' &&
    scorePasswordStrength(password) >= MIN_PASSWORD_STRENGTH
  );
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isPasswordStrongEnough(value);
  }

  defaultMessage(): string {
    return 'password is too weak; use a stronger mix of letters, numbers, and symbols';
  }
}

/**
 * Property decorator rejecting passwords below the minimum strength tier. This
 * is the server-side backstop for the client strength meter -- the client gate
 * is UX only and can be bypassed, so the policy is enforced here too.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsStrongPasswordConstraint,
    });
  };
}
