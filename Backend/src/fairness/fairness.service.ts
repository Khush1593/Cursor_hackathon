import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ageBand, sexGroup } from './fairness.buckets';

export type FairnessBucketRow = {
  age_band: string;
  sex_group: string;
  action_type: string;
  detected_mode: string;
  count: number;
};

export type FairnessStatsSnapshot = {
  total_triage_events: number;
  note: string;
  by_bucket: FairnessBucketRow[];
  emergency_escalations_by_bucket: FairnessBucketRow[];
  source: 'postgres' | 'postgres+python_sync';
};

type PythonFairnessSnapshot = {
  total_triage_events?: number;
  by_bucket?: FairnessBucketRow[];
  emergency_escalations_by_bucket?: FairnessBucketRow[];
  note?: string;
};

const NOTE =
  'Non-PHI aggregates only (age_band + sex_group + outcome). ' +
  'Durable in Postgres — Python /fairness/stats is in-memory and resets on restart.';

/**
 * Durable fairness counters. Never stores user IDs, transcripts, or narratives.
 */
@Injectable()
export class FairnessService {
  private readonly logger = new Logger(FairnessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Increment one bucket after a successful Nest triage (AI or stub).
   * Pass only demographic + outcome fields — never userId / transcript.
   */
  async recordOutcome(params: {
    age: number;
    sex: string;
    actionType: string;
    detectedMode: string;
  }): Promise<void> {
    const band = ageBand(params.age);
    const group = sexGroup(params.sex);

    await this.prisma.fairnessAggregate.upsert({
      where: {
        ageBand_sexGroup_actionType_detectedMode: {
          ageBand: band,
          sexGroup: group,
          actionType: params.actionType,
          detectedMode: params.detectedMode,
        },
      },
      create: {
        ageBand: band,
        sexGroup: group,
        actionType: params.actionType,
        detectedMode: params.detectedMode,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });

    this.logger.log(
      `fairness_event age_band=${band} sex_group=${group} action_type=${params.actionType} detected_mode=${params.detectedMode}`,
    );
  }

  async getStats(): Promise<FairnessStatsSnapshot> {
    const rows = await this.prisma.fairnessAggregate.findMany({
      orderBy: [{ count: 'desc' }, { ageBand: 'asc' }],
    });

    const by_bucket: FairnessBucketRow[] = rows.map((r) => ({
      age_band: r.ageBand,
      sex_group: r.sexGroup,
      action_type: r.actionType,
      detected_mode: r.detectedMode,
      count: r.count,
    }));

    const total = by_bucket.reduce((sum, r) => sum + r.count, 0);
    const emergency = by_bucket.filter(
      (r) => r.action_type === 'emergency_escalation',
    );

    return {
      total_triage_events: total,
      note: NOTE,
      by_bucket,
      emergency_escalations_by_bucket: emergency,
      source: 'postgres',
    };
  }

  /**
   * Scrape Python GET /fairness/stats and merge with GREATEST(db, python)
   * so Nest keeps durable history while picking up direct Python traffic.
   */
  async syncFromPython(): Promise<FairnessStatsSnapshot> {
    const baseUrl =
      this.config.get<string>('pythonServiceUrl') ?? 'http://localhost:8000';
    const timeoutMs =
      this.config.get<number>('pythonServiceTimeoutMs') ?? 50_000;

    let snap: PythonFairnessSnapshot;
    try {
      const response = await fetch(`${baseUrl}/fairness/stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(Math.min(timeoutMs, 10_000)),
      });
      if (!response.ok) {
        throw new Error(`Python fairness returned ${response.status}`);
      }
      snap = (await response.json()) as PythonFairnessSnapshot;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`Fairness sync from Python failed: ${message}`);
      return this.getStats();
    }

    for (const row of snap.by_bucket ?? []) {
      if (!this.isSafeBucket(row)) {
        continue;
      }
      const existing = await this.prisma.fairnessAggregate.findUnique({
        where: {
          ageBand_sexGroup_actionType_detectedMode: {
            ageBand: row.age_band,
            sexGroup: row.sex_group,
            actionType: row.action_type,
            detectedMode: row.detected_mode,
          },
        },
      });
      const nextCount = Math.max(existing?.count ?? 0, row.count);
      await this.prisma.fairnessAggregate.upsert({
        where: {
          ageBand_sexGroup_actionType_detectedMode: {
            ageBand: row.age_band,
            sexGroup: row.sex_group,
            actionType: row.action_type,
            detectedMode: row.detected_mode,
          },
        },
        create: {
          ageBand: row.age_band,
          sexGroup: row.sex_group,
          actionType: row.action_type,
          detectedMode: row.detected_mode,
          count: nextCount,
        },
        update: { count: nextCount },
      });
    }

    const stats = await this.getStats();
    return { ...stats, source: 'postgres+python_sync' };
  }

  private isSafeBucket(row: FairnessBucketRow): boolean {
    const keys = Object.keys(row);
    const allowed = new Set([
      'age_band',
      'sex_group',
      'action_type',
      'detected_mode',
      'count',
    ]);
    if (keys.some((k) => !allowed.has(k))) {
      return false;
    }
    return (
      typeof row.age_band === 'string' &&
      typeof row.sex_group === 'string' &&
      typeof row.action_type === 'string' &&
      typeof row.detected_mode === 'string' &&
      typeof row.count === 'number' &&
      row.count >= 0
    );
  }
}
