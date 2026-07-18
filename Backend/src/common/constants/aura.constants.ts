/** Frozen enums & keys used across modules (DRY — single source). */

export const DETECTED_MODES = [
  'preventive',
  'urgent_care',
  'emergency',
] as const;

export type DetectedMode = (typeof DETECTED_MODES)[number];

export const ACTION_TYPES = [
  'ask_follow_up',
  'resolve',
  'emergency_escalation',
  'general_response',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Dashboard metric keys — chart contracts depend on these exact names. */
export const METRIC_KEYS = ['pain_level', 'sleep_hours'] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const CONSENT_TYPES = [
  'data_collection',
  'third_party_sharing',
  'voice_recording',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const AUDIT_ACTIONS = [
  'triage_turn',
  'dashboard_view',
  'emergency_escalation',
  'data_export',
  'data_delete',
  'consent_recorded',
  'feedback_flagged',
  'login',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const INPUT_MODES = ['voice', 'text'] as const;

export type InputMode = (typeof INPUT_MODES)[number];
