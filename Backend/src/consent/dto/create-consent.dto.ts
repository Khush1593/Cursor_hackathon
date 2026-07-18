import { IsBoolean, IsIn, IsString, IsUUID } from 'class-validator';
import { CONSENT_TYPES, ConsentType } from '../../common/constants';

export class CreateConsentDto {
  @IsUUID()
  userId!: string;

  @IsIn(CONSENT_TYPES)
  consentType!: ConsentType;

  @IsBoolean()
  granted!: boolean;

  @IsString()
  version!: string;
}
