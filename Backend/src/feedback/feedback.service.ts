import { Injectable, NotImplementedException } from '@nestjs/common';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  flag(_dto: CreateFeedbackDto): Promise<unknown> {
    throw new NotImplementedException(
      'FeedbackService.flag not implemented yet',
    );
  }
}
