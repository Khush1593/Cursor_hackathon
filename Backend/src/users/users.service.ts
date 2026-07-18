import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type MetricsPoint = {
  date: string;
  pain_level: number | null;
  sleep_hours: number | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const logs = await this.prisma.healthLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const metricsHistory = this.buildMetricsHistory(logs);
    const recentMessages = this.buildRecentMessages(logs).slice(-6);

    await this.audit.write({
      userId,
      action: 'dashboard_view',
      metadata: { logCount: logs.length },
    });

    return {
      user: {
        id: user.id,
        age: user.age,
        sex: user.sex,
        activeMode: user.activeMode,
        isEmergencyState: user.isEmergencyState,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
      },
      metricsHistory,
      recentMessages,
    };
  }

  async resetEmergency(userId: string): Promise<{
    is_emergency_state: boolean;
    active_mode: string;
  }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmergencyState: false,
        activeMode: 'preventive',
      },
    });

    return { is_emergency_state: false, active_mode: 'preventive' };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        healthLogs: { orderBy: { createdAt: 'asc' } },
        exaInsights: { orderBy: { createdAt: 'asc' } },
        consentRecords: { orderBy: { createdAt: 'asc' } },
        feedbackFlags: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.audit.write({
      userId,
      action: 'data_export',
      metadata: {
        healthLogs: user.healthLogs.length,
        exaInsights: user.exaInsights.length,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        age: user.age,
        sex: user.sex,
        chronicConditions: user.chronicConditions,
        currentMeds: user.currentMeds,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        activeMode: user.activeMode,
        isEmergencyState: user.isEmergencyState,
        dataRetentionDays: user.dataRetentionDays,
        healthLogs: user.healthLogs,
        exaInsights: user.exaInsights,
        consentRecords: user.consentRecords,
        feedbackFlags: user.feedbackFlags,
      },
    };
  }

  async deleteData(
    userId: string,
  ): Promise<{ deleted: boolean; deletedAt: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.feedbackFlag.deleteMany({ where: { userId } }),
      this.prisma.healthLog.deleteMany({ where: { userId } }),
      this.prisma.exaInsight.deleteMany({ where: { userId } }),
    ]);

    const deletedAt = new Date().toISOString();
    await this.audit.write({
      userId,
      action: 'data_delete',
      metadata: { deletedAt },
    });

    return { deleted: true, deletedAt };
  }

  private buildMetricsHistory(
    logs: Array<{ createdAt: Date; extractedMetrics: Prisma.JsonValue }>,
  ): MetricsPoint[] {
    const byDate = new Map<string, MetricsPoint>();

    for (const log of logs) {
      const date = log.createdAt.toISOString().slice(0, 10);
      const metrics = this.asMetrics(log.extractedMetrics);
      const existing = byDate.get(date) ?? {
        date,
        pain_level: null,
        sleep_hours: null,
      };
      if (metrics.pain_level != null) existing.pain_level = metrics.pain_level;
      if (metrics.sleep_hours != null)
        existing.sleep_hours = metrics.sleep_hours;
      byDate.set(date, existing);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  private buildRecentMessages(
    logs: Array<{
      createdAt: Date;
      rawAudioText: string;
      aiResponseText: string;
    }>,
  ) {
    const messages: Array<{
      role: 'user' | 'aura';
      text: string;
      createdAt: string;
    }> = [];

    for (const log of logs) {
      const createdAt = log.createdAt.toISOString();
      if (log.rawAudioText) {
        messages.push({ role: 'user', text: log.rawAudioText, createdAt });
      }
      if (log.aiResponseText) {
        messages.push({ role: 'aura', text: log.aiResponseText, createdAt });
      }
    }

    return messages;
  }

  private asMetrics(value: Prisma.JsonValue): {
    pain_level: number | null;
    sleep_hours: number | null;
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { pain_level: null, sleep_hours: null };
    }
    const obj = value as Record<string, unknown>;
    return {
      pain_level: typeof obj.pain_level === 'number' ? obj.pain_level : null,
      sleep_hours: typeof obj.sleep_hours === 'number' ? obj.sleep_hours : null,
    };
  }
}
