export type FrontendExaInsight = {
  title: string;
  url: string;
  summary: string;
} | null;

export type NearestErResult = {
  name: string;
  address: string;
  distance_miles: number;
} | null;

export type FrontendTriageResponse = {
  action_type:
    'ask_follow_up' | 'resolve' | 'emergency_escalation' | 'general_response';
  detected_mode: 'preventive' | 'urgent_care' | 'emergency';
  ai_spoken_response: string;
  audio_base64: string | null;
  is_emergency_state: boolean;
  updated_metrics: Record<string, unknown>;
  exa_insight: FrontendExaInsight;
  reasoning_trace: string[];
  /** Present on emergency when location is known. */
  nearest_er: NearestErResult;
  /** True on emergency when FE should prompt “Share location?” */
  ask_share_location: boolean;
};

export type TriageRequestPayload = {
  transcript: string;
  baseline: {
    age: number;
    sex: string;
    chronicConditions: string[];
    currentMeds: string[];
  };
  recentLogs: Array<{
    rawAudioText: string;
    detectedConditionId: string | null;
    extractedMetrics: Record<string, unknown>;
    createdAt: string;
  }>;
  recurringConditions: string[];
  pendingTriage: { condition_id: string; turn: number } | null;
};
