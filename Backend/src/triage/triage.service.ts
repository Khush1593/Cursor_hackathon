import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsentService } from '../consent/consent.service';
import { AiClient } from '../integrations/ai/ai.client';
import { ExaClient } from '../integrations/exa/exa.client';
import { ElevenLabsClient } from '../integrations/elevenlabs/elevenlabs.client';
import { AuraResponse, AuraResponseSchema } from '../validation/aura.schema';
import { TriageTurnDto } from './dto/triage-turn.dto';
import { TriageMapper } from './triage.mapper';
import { FallbackService } from './fallback.service';
import { DatasetService } from './dataset.service';
import { findNearestEr } from '../common/utils/geo';
import { FairnessService } from '../fairness/fairness.service';
import {
  FrontendExaInsight,
  FrontendTriageResponse,
  NearestErResult,
  TriageRequestPayload,
} from './triage.types';

type PendingTriageJson = { condition_id: string; turn: number };

const CONSENT_MESSAGES: Record<string, string> = {
  data_collection: 'Please accept data collection first.',
  voice_recording: 'Please accept voice recording consent first.',
};

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClient,
    private readonly exa: ExaClient,
    private readonly elevenLabs: ElevenLabsClient,
    private readonly mapper: TriageMapper,
    private readonly fallback: FallbackService,
    private readonly dataset: DatasetService,
    private readonly audit: AuditService,
    private readonly consent: ConsentService,
    private readonly fairness: FairnessService,
    private readonly config: ConfigService,
  ) {}

  async handleTurn(
    userId: string,
    dto: TriageTurnDto,
  ): Promise<FrontendTriageResponse> {
    try {
      await this.assertConsent(userId, dto.inputMode);
      await this.assertRateLimits(userId);

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (dto.latitude != null && dto.longitude != null) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            lastLatitude: dto.latitude,
            lastLongitude: dto.longitude,
            lastLocationAt: new Date(),
          },
        });
        await this.audit.write({
          userId,
          action: 'location_shared',
          metadata: { source: 'triage_turn' },
        });
      }

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const recentLogRows = await this.prisma.healthLog.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const recurringConditions = await this.loadRecurringConditions(
        userId,
        since,
      );

      const pendingTriage = this.parsePendingTriage(user.pendingTriage);

      const payload: TriageRequestPayload = {
        transcript: dto.transcript,
        baseline: {
          age: user.age,
          sex: user.sex,
          chronicConditions: user.chronicConditions,
          currentMeds: user.currentMeds,
        },
        recentLogs: recentLogRows.map((log) => ({
          rawAudioText: log.rawAudioText,
          detectedConditionId: log.detectedConditionId,
          extractedMetrics: this.jsonToRecord(log.extractedMetrics),
          createdAt: log.createdAt.toISOString(),
        })),
        recurringConditions,
        pendingTriage,
      };

      const rawAi = await this.ai.triage(payload);
      const ai = AuraResponseSchema.parse(rawAi);

      // Durable non-PHI fairness bucket (age/sex + outcome only — never userId/transcript)
      await this.fairness.recordOutcome({
        age: user.age,
        sex: user.sex,
        actionType: ai.action_type,
        detectedMode: ai.detected_mode,
      });

      let exaInsight: FrontendExaInsight = null;
      if (ai.action_type === 'resolve' && ai.trigger_exa_search) {
        exaInsight = await this.exa.search(ai.trigger_exa_search);
        if (exaInsight) {
          await this.prisma.exaInsight.create({
            data: {
              userId,
              triggerSymptom: ai.detected_condition_id ?? 'resolve',
              articleTitle: exaInsight.title,
              articleUrl: exaInsight.url,
              aiSummary: exaInsight.summary,
            },
          });
        }
      }

      const audioBase64 = await this.elevenLabs.synthesize(
        ai.ai_spoken_response,
      );

      await this.persistTurn(userId, dto, ai);

      const refreshed = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      const { nearestEr, askShareLocation } = this.resolveEmergencyGeo(
        ai.action_type === 'emergency_escalation' || refreshed.isEmergencyState,
        dto.latitude ?? refreshed.lastLatitude,
        dto.longitude ?? refreshed.lastLongitude,
      );

      if (
        ai.action_type === 'resolve' ||
        ai.action_type === 'emergency_escalation'
      ) {
        await this.audit.write({
          userId,
          action:
            ai.action_type === 'emergency_escalation'
              ? 'emergency_escalation'
              : 'triage_turn',
          metadata: {
            action_type: ai.action_type,
            detected_mode: ai.detected_mode,
            inputMode: dto.inputMode,
            has_nearest_er: nearestEr != null,
          },
        });
      } else {
        await this.audit.write({
          userId,
          action: 'triage_turn',
          metadata: {
            action_type: ai.action_type,
            detected_mode: ai.detected_mode,
            inputMode: dto.inputMode,
          },
        });
      }

      return this.mapper.toFrontendResponse({
        ai,
        audioBase64,
        exaInsight,
        isEmergencyState: refreshed.isEmergencyState,
        nearestEr,
        askShareLocation,
        transcript: dto.transcript,
      });
    } catch (error: unknown) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`Triage turn failed — using fallback: ${message}`);
      return this.fallback.resolve(dto.transcript);
    }
  }

  private async assertConsent(
    userId: string,
    inputMode: TriageTurnDto['inputMode'],
  ): Promise<void> {
    const missing = await this.consent.getMissingConsentsForTriage(
      userId,
      inputMode,
    );
    if (missing.length === 0) {
      return;
    }

    const primary = missing[0];
    throw new ForbiddenException(
      CONSENT_MESSAGES[primary] ?? 'Please accept data collection first.',
    );
  }

  private async assertRateLimits(userId: string): Promise<void> {
    const perMinute = this.config.get<number>('rateLimitPerMinute') ?? 10;
    const perHour = this.config.get<number>('triageBudgetPerHour') ?? 60;

    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const oneHourAgo = new Date(Date.now() - 3_600_000);

    const [minuteCount, hourCount] = await Promise.all([
      this.prisma.healthLog.count({
        where: { userId, createdAt: { gte: oneMinuteAgo } },
      }),
      this.prisma.healthLog.count({
        where: { userId, createdAt: { gte: oneHourAgo } },
      }),
    ]);

    if (minuteCount >= perMinute) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "You're sending updates too fast — try again in a minute.",
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (hourCount >= perHour) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "You've reached your hourly triage limit — try again later.",
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private resolveEmergencyGeo(
    isEmergency: boolean,
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): { nearestEr: NearestErResult; askShareLocation: boolean } {
    if (!isEmergency) {
      return { nearestEr: null, askShareLocation: false };
    }

    if (
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return {
        nearestEr: findNearestEr(latitude, longitude),
        askShareLocation: false,
      };
    }

    return { nearestEr: null, askShareLocation: true };
  }

  private async persistTurn(
    userId: string,
    dto: TriageTurnDto,
    ai: AuraResponse,
  ): Promise<void> {
    // Prefer AI metrics; fill pain/sleep from transcript when LLM returns {}
    const metrics = this.mapper.resolveMetrics(
      ai.extracted_dashboard_metrics,
      dto.transcript,
    );
    const conditionId = ai.detected_condition_id;
    const severity =
      conditionId != null
        ? (this.dataset.getSeverityRank(conditionId) ?? null)
        : null;

    if (ai.action_type === 'general_response') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { pendingTriage: Prisma.DbNull },
      });
      return;
    }

    if (ai.action_type === 'ask_follow_up') {
      await this.prisma.$transaction([
        this.prisma.healthLog.create({
          data: {
            userId,
            rawAudioText: dto.transcript,
            detectedMode: ai.detected_mode,
            detectedConditionId: null,
            severityScore: null,
            extractedMetrics: metrics,
            aiResponseText: ai.ai_spoken_response,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            pendingTriage: (ai.pending_triage_update ??
              Prisma.DbNull) as Prisma.InputJsonValue,
          },
        }),
      ]);
      return;
    }

    if (ai.action_type === 'resolve') {
      await this.prisma.$transaction([
        this.prisma.healthLog.create({
          data: {
            userId,
            rawAudioText: dto.transcript,
            detectedMode: ai.detected_mode,
            detectedConditionId: conditionId,
            severityScore: severity,
            extractedMetrics: metrics,
            aiResponseText: ai.ai_spoken_response,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            pendingTriage: Prisma.DbNull,
            activeMode: ai.detected_mode,
          },
        }),
      ]);
      return;
    }

    // emergency_escalation
    await this.prisma.$transaction([
      this.prisma.healthLog.create({
        data: {
          userId,
          rawAudioText: dto.transcript,
          detectedMode: 'emergency',
          detectedConditionId: conditionId,
          severityScore: severity,
          extractedMetrics: metrics,
          aiResponseText: ai.ai_spoken_response,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingTriage: Prisma.DbNull,
          isEmergencyState: true,
          activeMode: 'emergency',
        },
      }),
    ]);
  }

  private async loadRecurringConditions(
    userId: string,
    since: Date,
  ): Promise<string[]> {
    const grouped = await this.prisma.healthLog.groupBy({
      by: ['detectedConditionId'],
      where: {
        userId,
        createdAt: { gte: since },
        detectedConditionId: { not: null },
      },
      _count: { detectedConditionId: true },
    });

    return grouped
      .filter((row) => row._count.detectedConditionId >= 2)
      .map((row) => row.detectedConditionId)
      .filter((id): id is string => typeof id === 'string');
  }

  private parsePendingTriage(value: unknown): PendingTriageJson | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.condition_id === 'string' && typeof obj.turn === 'number') {
      return { condition_id: obj.condition_id, turn: obj.turn };
    }
    return null;
  }

  private jsonToRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}
