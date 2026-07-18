import { IsUUID } from 'class-validator';

export class ResetEmergencyDto {
  @IsUUID()
  userId!: string;
}
