import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { ConsentType, InputMode } from '../common/constants';

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

  /**
   * Required before triage:
   * - always: data_collection granted
   * - voice input: also voice_recording granted
   */
  async getMissingConsentsForTriage(
    userId: string,
    inputMode: InputMode,
  ): Promise<ConsentType[]> {
    const required: ConsentType[] = ['data_collection'];
    if (inputMode === 'voice') {
      required.push('voice_recording');
    }

    const records = await this.prisma.consentRecord.findMany({
      where: {
        userId,
        granted: true,
        consentType: { in: [...required] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const granted = new Set(records.map((r) => r.consentType));
    return required.filter((type) => !granted.has(type));
  }

  async getStatus(userId: string) {
    const records = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const latestByType = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      if (!latestByType.has(record.consentType)) {
        latestByType.set(record.consentType, record);
      }
    }

    return {
      consents: Array.from(latestByType.values()).map((r) => ({
        consentType: r.consentType,
        granted: r.granted,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
