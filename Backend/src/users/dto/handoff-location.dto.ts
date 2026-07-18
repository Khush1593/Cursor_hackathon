import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHandoffDto {
  @ApiPropertyOptional({
    example: 'I still feel unsafe after the triage questions.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ShareLocationDto {
  @ApiProperty({ example: 37.7749 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -122.4194 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
