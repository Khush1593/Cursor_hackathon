import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'demo@aura.health' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecurePass1!',
    minLength: 8,
    format: 'password',
    description: 'Account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
