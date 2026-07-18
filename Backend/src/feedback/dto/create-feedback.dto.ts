import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  healthLogId!: string;

  @IsBoolean()
  flaggedIncorrect!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
