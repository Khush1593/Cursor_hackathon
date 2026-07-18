import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';
import { INPUT_MODES, InputMode } from '../../common/constants';

export class TriageTurnDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(1)
  transcript!: string;

  @IsIn(INPUT_MODES)
  inputMode!: InputMode;
}
