import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { INPUT_MODES, InputMode } from '../../common/constants';

/** userId comes from the JWT cookie — never accept it from the client body. */
export class TriageTurnDto {
  @ApiProperty({ example: 'My chest hurts' })
  @IsString()
  @MinLength(1)
  transcript!: string;

  @ApiProperty({ enum: INPUT_MODES, example: 'voice' })
  @IsIn(INPUT_MODES)
  inputMode!: InputMode;

  /** Optional — used on emergency to suggest nearest ER. */
  @ApiPropertyOptional({ example: 37.7749 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -122.4194 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
