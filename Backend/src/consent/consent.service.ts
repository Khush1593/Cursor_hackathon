import { Injectable, NotImplementedException } from '@nestjs/common';
import { CreateConsentDto } from './dto/create-consent.dto';

@Injectable()
export class ConsentService {
  record(_dto: CreateConsentDto): Promise<unknown> {
    throw new NotImplementedException(
      'ConsentService.record not implemented yet',
    );
  }
}
