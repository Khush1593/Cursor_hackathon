import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';

export interface WriteAuditParams {
  userId: string;
  action: AuditAction;
  actorId?: string;
  resourceId?: string;
  /** Must never contain PHI (no transcript / symptom text). */
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persists AuditLog rows. Keep metadata non-PHI by design.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: WriteAuditParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        actorId: params.actorId ?? params.userId,
        action: params.action,
        resourceId: params.resourceId,
        metadata:
          (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        ipAddress: params.ipAddress,
      },
    });
  }
}
