import { IsBoolean, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CONSENT_TYPES, ConsentType } from '../../common/constants';

/** userId comes from the JWT cookie — never accept it from the client body. */
export class CreateConsentDto {
  @ApiProperty({
    enum: CONSENT_TYPES,
    example: 'data_collection',
  })
  @IsIn([...CONSENT_TYPES])
  consentType!: ConsentType;

  @ApiProperty({ example: true })
  @IsBoolean()
  granted!: boolean;

  @ApiProperty({ example: 'v1' })
  @IsString()
  version!: string;
}
