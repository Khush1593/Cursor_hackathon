import { Injectable, NotImplementedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  login(_dto: LoginDto): Promise<{ token: string; userId: string }> {
    throw new NotImplementedException('AuthService.login not implemented yet');
  }
}
