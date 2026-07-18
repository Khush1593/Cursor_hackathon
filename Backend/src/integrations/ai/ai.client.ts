import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuraResponse, AuraResponseSchema } from '../../validation/aura.schema';
import { TriageRequestPayload } from '../../triage/triage.types';

/**
 * HTTP client for the Python FastAPI triage service (+ local stub).
 * Timeout must exceed Python's Gemini ceiling (~45s) so free-tier retries
 * are not cut off by Nest before fallback can run cleanly.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);

  constructor(private readonly config: ConfigService) {}

  async triage(payload: TriageRequestPayload): Promise<AuraResponse> {
    if (this.config.get<boolean>('useAiStub')) {
      return this.stubResponse(payload);
    }

    const baseUrl =
      this.config.get<string>('pythonServiceUrl') ?? 'http://localhost:8000';
    const timeoutMs =
      this.config.get<number>('pythonServiceTimeoutMs') ?? 50_000;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error: unknown) {
      if (this.isTimeoutError(error)) {
        throw new Error(
          `AI service timed out after ${timeoutMs}ms (raise PYTHON_SERVICE_TIMEOUT_MS if needed)`,
        );
      }
      throw error;
    }

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const json: unknown = await response.json();
    return AuraResponseSchema.parse(json);
  }

  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('timeout')
    );
  }

  private stubResponse(payload: TriageRequestPayload): AuraResponse {
    const t = payload.transcript.toLowerCase();
    this.logger.debug(`AI stub handling transcript (${t.slice(0, 40)}…)`);

    if (
      t.includes('face') &&
      (t.includes('droop') || t.includes('slurred') || t.includes('stroke'))
    ) {
      return AuraResponseSchema.parse({
        action_type: 'emergency_escalation',
        detected_mode: 'emergency',
        detected_condition_id: 'stroke_tia',
        extracted_dashboard_metrics: {},
        ai_spoken_response:
          'Based on what you described, please seek emergency care immediately.',
        trigger_exa_search: null,
        pending_triage_update: null,
        reasoning_trace: ['Stub: stroke/face-droop pattern → emergency bypass'],
      });
    }

    if (t.includes('chest')) {
      return AuraResponseSchema.parse({
        action_type: 'ask_follow_up',
        detected_mode: 'emergency',
        detected_condition_id: null,
        extracted_dashboard_metrics: { pain_level: 7 },
        ai_spoken_response:
          'Are you experiencing crushing chest pressure or pain radiating to your arm or jaw?',
        trigger_exa_search: null,
        pending_triage_update: {
          condition_id: 'acute_myocardial_infarction',
          turn: (payload.pendingTriage?.turn ?? 0) + 1,
        },
        reasoning_trace: ['Stub: chest symptoms → rule out MI first'],
      });
    }

    if (payload.pendingTriage && (t.includes('no') || t.includes('meal'))) {
      return AuraResponseSchema.parse({
        action_type: 'resolve',
        detected_mode: 'preventive',
        detected_condition_id: 'gerd_reflux',
        extracted_dashboard_metrics: {},
        ai_spoken_response:
          'Sounds more like reflux. Rest upright and avoid heavy meals for now.',
        trigger_exa_search:
          '(site:mayoclinic.org OR site:cdc.gov OR site:nih.gov) acid reflux heartburn',
        pending_triage_update: null,
        reasoning_trace: ['Stub: secondary denied → resolve as GERD'],
      });
    }

    if (t.includes('sleep') || t.includes('slept')) {
      return AuraResponseSchema.parse({
        action_type: 'resolve',
        detected_mode: 'preventive',
        detected_condition_id: 'sleep_hygiene',
        extracted_dashboard_metrics: { sleep_hours: 5 },
        ai_spoken_response:
          'Noted — logging your sleep and keeping an eye on trends.',
        trigger_exa_search:
          '(site:mayoclinic.org OR site:cdc.gov OR site:nih.gov) sleep hygiene tips',
        pending_triage_update: null,
        reasoning_trace: ['Stub: sleep mention → preventive resolve'],
      });
    }

    if (t.includes('gym') || t.includes('hello') || t.includes('fine')) {
      return AuraResponseSchema.parse({
        action_type: 'general_response',
        detected_mode: 'preventive',
        detected_condition_id: null,
        extracted_dashboard_metrics: {},
        ai_spoken_response: 'Sounds good. I am here if any symptoms come up.',
        trigger_exa_search: null,
        pending_triage_update: null,
        reasoning_trace: ['Stub: non-clinical chatter'],
      });
    }

    return AuraResponseSchema.parse({
      action_type: 'ask_follow_up',
      detected_mode: 'urgent_care',
      detected_condition_id: null,
      extracted_dashboard_metrics: {},
      ai_spoken_response:
        'Can you tell me a bit more about when this started and how severe it feels?',
      trigger_exa_search: null,
      pending_triage_update: {
        condition_id: 'undifferentiated_symptom',
        turn: 1,
      },
      reasoning_trace: ['Stub: default follow-up'],
    });
  }
}
