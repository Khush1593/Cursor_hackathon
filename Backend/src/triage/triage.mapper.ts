import { Injectable } from '@nestjs/common';
import { AuraResponse } from '../validation/aura.schema';
import { FrontendExaInsight, FrontendTriageResponse } from './triage.types';

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
  }): FrontendTriageResponse {
    const { ai, audioBase64, exaInsight, isEmergencyState } = params;

    return {
      action_type: ai.action_type,
      detected_mode: ai.detected_mode,
      ai_spoken_response: ai.ai_spoken_response,
      audio_base64: audioBase64,
      is_emergency_state:
        isEmergencyState || ai.action_type === 'emergency_escalation',
      updated_metrics: this.sanitizeMetrics(ai.extracted_dashboard_metrics),
      exa_insight: exaInsight,
      reasoning_trace: ai.reasoning_trace ?? [],
    };
  }

  sanitizeMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (typeof metrics.pain_level === 'number') {
      out.pain_level = metrics.pain_level;
    }
    if (typeof metrics.sleep_hours === 'number') {
      out.sleep_hours = metrics.sleep_hours;
    }
    return out;
  }
}
