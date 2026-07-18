import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Opaque token from forgot-password (email link / dev response)',
    example: 'a1b2c3d4...',
  })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @ApiProperty({
    example: 'NewSecurePass1!',
    minLength: 8,
    format: 'password',
    description: 'New account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
