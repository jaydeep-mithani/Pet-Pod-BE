import { IsNumberString, Length } from 'class-validator';

export class CheckCodeDto {
  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
