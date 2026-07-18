import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';

/**
 * Quality-control loop — flag incorrect triage results.
 * @see project_knowledge.md §10.1 POST /api/feedback
 */
@Controller('feedback')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.flag(dto);
  }
}
