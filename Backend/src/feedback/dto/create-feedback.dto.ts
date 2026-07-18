import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** userId comes from the JWT cookie — never accept it from the client body. */
export class CreateFeedbackDto {
  @ApiProperty({ example: 'uuid-of-health-log' })
  @IsUUID()
  healthLogId!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  flaggedIncorrect!: boolean;

  @ApiPropertyOptional({ example: 'This seems wrong' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
