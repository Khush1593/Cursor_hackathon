import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
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

  @ApiProperty({ example: 34, minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  age!: number;

  @ApiProperty({ example: 'female' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sex!: string;

  @ApiPropertyOptional({ example: ['mild eczema'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];

  @ApiPropertyOptional({ example: ['multivitamin'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentMeds?: string[];

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string;
}
