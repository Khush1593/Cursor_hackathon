import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Safe user payload — never includes passwordHash or reset/refresh hashes. */
export class AuthUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  age!: number;

  @ApiProperty()
  sex!: string;

  @ApiProperty({ type: [String] })
  chronicConditions!: string[];

  @ApiProperty({ type: [String] })
  currentMeds!: string[];

  @ApiPropertyOptional()
  emergencyContactName?: string | null;

  @ApiPropertyOptional()
  emergencyContactPhone?: string | null;

  @ApiProperty()
  activeMode!: string;

  @ApiProperty()
  isEmergencyState!: boolean;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;

  @ApiProperty({
    example: 'Authenticated. Tokens set in HTTP-only cookies.',
  })
  message!: string;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}

export class ForgotPasswordResponseDto extends MessageResponseDto {
  @ApiPropertyOptional({
    description:
      'Only when NODE_ENV=development AND MAIL_DEV_EXPOSE_TOKEN=true. Prefer the emailed reset link.',
  })
  resetToken?: string;
}
