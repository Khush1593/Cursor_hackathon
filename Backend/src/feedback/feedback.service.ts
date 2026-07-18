import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async flag(userId: string, dto: CreateFeedbackDto) {
    const log = await this.prisma.healthLog.findUnique({
      where: { id: dto.healthLogId },
    });
    if (!log) {
      throw new NotFoundException('HealthLog not found');
    }
    if (log.userId !== userId) {
      throw new ForbiddenException('HealthLog does not belong to this user');
    }

    const flag = await this.prisma.feedbackFlag.create({
      data: {
        userId,
        healthLogId: dto.healthLogId,
        flaggedIncorrect: dto.flaggedIncorrect,
        note: dto.note,
      },
    });

    await this.audit.write({
      userId,
      action: 'feedback_flagged',
      resourceId: flag.id,
      metadata: {
        healthLogId: dto.healthLogId,
        flaggedIncorrect: dto.flaggedIncorrect,
      },
    });

    return {
      id: flag.id,
      healthLogId: flag.healthLogId,
      flaggedIncorrect: flag.flaggedIncorrect,
      createdAt: flag.createdAt.toISOString(),
    };
  }
}
