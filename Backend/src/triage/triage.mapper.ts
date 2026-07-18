import { Injectable } from '@nestjs/common';
import { AuraResponse } from '../validation/aura.schema';
import {
  FrontendExaInsight,
  FrontendTriageResponse,
  NearestErResult,
} from './triage.types';
import {
  asFiniteNumber,
  inferMetricsFromTranscript,
} from '../common/utils/metrics';

/**
 * Pure transforms: AuraResponse (AI) → frontend triage response shape.
 */
@Injectable()
export class TriageMapper {
  toFrontendResponse(params: {
    ai: AuraResponse;
    audioBase64: string | null;
    exaInsight: FrontendExaInsight;
    isEmergencyState: boolean;
    nearestEr?: NearestErResult;
    askShareLocation?: boolean;
    /** Optional transcript — fills pain/sleep when AI left metrics empty. */
    transcript?: string;
  }): FrontendTriageResponse {
    const {
      ai,
      audioBase64,
      exaInsight,
      isEmergencyState,
      nearestEr = null,
      askShareLocation = false,
      transcript,
    } = params;

    const isEmergency =
      isEmergencyState || ai.action_type === 'emergency_escalation';

    const updated = this.resolveMetrics(
      ai.extracted_dashboard_metrics,
      transcript,
    );

    return {
      action_type: ai.action_type,
      detected_mode: ai.detected_mode,
      ai_spoken_response: ai.ai_spoken_response,
      audio_base64: audioBase64,
      is_emergency_state: isEmergency,
      updated_metrics: updated,
      exa_insight: exaInsight,
      reasoning_trace: ai.reasoning_trace ?? [],
      nearest_er: isEmergency ? nearestEr : null,
      ask_share_location: isEmergency ? askShareLocation : false,
    };
  }

  /**
   * Prefer AI metrics; fill gaps from transcript heuristics so the 7-day chart gets data.
   */
  resolveMetrics(
    metrics: Record<string, unknown>,
    transcript?: string,
  ): Record<string, number> {
    const out = this.sanitizeMetrics(metrics);
    if (!transcript) {
      return out;
    }
    const inferred = inferMetricsFromTranscript(transcript);
    if (out.pain_level == null && inferred.pain_level != null) {
      out.pain_level = inferred.pain_level;
    }
    if (out.sleep_hours == null && inferred.sleep_hours != null) {
      out.sleep_hours = inferred.sleep_hours;
    }
    return out;
  }

  sanitizeMetrics(metrics: Record<string, unknown>): Record<string, number> {
    const out: Record<string, number> = {};
    const pain = asFiniteNumber(metrics?.pain_level);
    const sleep = asFiniteNumber(metrics?.sleep_hours);
    if (pain != null && pain >= 1 && pain <= 10) {
      out.pain_level = Math.round(pain);
    }
    if (sleep != null && sleep >= 0 && sleep <= 24) {
      out.sleep_hours = Math.round(sleep);
    }
    return out;
  }
}
