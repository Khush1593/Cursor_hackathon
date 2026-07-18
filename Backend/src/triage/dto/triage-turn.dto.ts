import { IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
