import { z } from 'zod';

/**
 * Zod schemas for AI (Python) ↔ NestJS seam.
 * NestJS validates every AI response before persistence or frontend transform.
 */

export const PendingTriageSchema = z.object({
  condition_id: z.string(),
  turn: z.number().int(),
});

export const AuraResponseSchema = z.object({
  action_type: z.enum([
    'ask_follow_up',
    'resolve',
    'emergency_escalation',
    'general_response',
  ]),
  detected_mode: z.enum(['preventive', 'urgent_care', 'emergency']),
  detected_condition_id: z.string().nullable(),
  extracted_dashboard_metrics: z.record(z.any()),
  ai_spoken_response: z.string(),
  trigger_exa_search: z.string().nullable(),
  pending_triage_update: PendingTriageSchema.nullable(),
  reasoning_trace: z.array(z.string()).default([]),
});

export type AuraResponse = z.infer<typeof AuraResponseSchema>;
export type PendingTriage = z.infer<typeof PendingTriageSchema>;
