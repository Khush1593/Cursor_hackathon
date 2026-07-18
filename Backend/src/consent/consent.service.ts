import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConsentDto } from './dto/create-consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async record(userId: string, dto: CreateConsentDto) {
    const record = await this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: dto.consentType,
        granted: dto.granted,
        version: dto.version,
      },
    });

    await this.audit.write({
      userId,
      action: 'consent_recorded',
      resourceId: record.id,
      metadata: {
        consentType: dto.consentType,
        granted: dto.granted,
        version: dto.version,
      },
    });

    return {
      id: record.id,
      consentType: record.consentType,
      granted: record.granted,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
