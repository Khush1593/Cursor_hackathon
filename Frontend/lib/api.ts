/**
 * Backend API client — cookie session auth (HttpOnly).
 * Never stores tokens in localStorage/sessionStorage.
 *
 * In the browser we call same-origin `/api-proxy/*` (Next.js rewrite →
 * NEXT_PUBLIC_API_URL) so Set-Cookie sticks on the FE origin even when the
 * real API is ngrok/Railway HTTPS. Server-side can still hit the absolute URL.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api-proxy";
  }
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function isMockTriage(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "1";
}

export type Tier = "preventive" | "urgent_care" | "emergency";

export type AuthUser = {
  id: string;
  email: string;
  age: number;
  sex: string;
  chronicConditions?: string[];
  currentMeds?: string[];
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  activeMode: Tier;
  isEmergencyState: boolean;
};

export type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const msg = Array.isArray(body?.message)
      ? body.message.join(", ")
      : typeof body?.message === "string"
        ? body.message
        : fallback;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip the 401 → refresh → retry cycle (used by auth endpoints themselves). */
  skipRefresh?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;
let onAuthFailure: (() => void) | null = null;

/** Register a handler invoked when refresh fails mid-session (clear + redirect). */
export function setOnAuthFailure(handler: (() => void) | null) {
  onAuthFailure = handler;
}

async function parseJson(res: Response): Promise<ApiErrorBody | null> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      return res.ok;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Low-level fetch with cookies + single refresh retry on 401. */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const doFetch = () =>
    fetch(url, {
      ...rest,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        // Free ngrok interstitial blocks fetch unless this header is present.
        "ngrok-skip-browser-warning": "true",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401 && !skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      onAuthFailure?.();
      throw new ApiError(401, await parseJson(res), "Session expired");
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      await parseJson(res),
      res.statusText || "Request failed",
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/*  Auth endpoints                                                    */
/* ------------------------------------------------------------------ */

export type AuthSessionResponse = {
  user: AuthUser;
  message: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  age: number;
  sex: string;
  chronicConditions?: string[];
  currentMeds?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export function register(payload: RegisterPayload) {
  return apiFetch<AuthSessionResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
    skipRefresh: true,
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthSessionResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    skipRefresh: true,
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function refreshSession() {
  return apiFetch<AuthSessionResponse>("/api/auth/refresh", {
    method: "POST",
    skipRefresh: true,
  });
}

export function getMe() {
  return apiFetch<AuthUser>("/api/auth/me", { method: "GET" });
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string; resetToken?: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
    skipRefresh: true,
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    skipRefresh: true,
  });
}

/* ------------------------------------------------------------------ */
/*  PHI / triage                                                      */
/* ------------------------------------------------------------------ */

export type DashboardResponse = {
  user: {
    id: string;
    age: number;
    sex: string;
    activeMode: Tier;
    isEmergencyState: boolean;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
  metricsHistory: {
    date: string;
    pain_level: number | null;
    sleep_hours: number | null;
  }[];
  recentMessages: {
    role: "user" | "aura";
    text: string;
    createdAt: string;
  }[];
};

export type UpdatedMetrics = {
  pain_level?: number | null;
  sleep_hours?: number | null;
};

export type NearestEr = {
  name: string;
  address: string;
  distance_miles: number;
};

export type TurnResponse = {
  action_type: "ask_follow_up" | "resolve" | "emergency_escalation" | "general_response";
  detected_mode: Tier;
  ai_spoken_response: string;
  audio_base64: string | null;
  is_emergency_state: boolean;
  updated_metrics: UpdatedMetrics | null;
  exa_insight: { title: string; url: string; summary: string } | null;
  reasoning_trace?: string[] | null;
  nearest_er?: NearestEr | null;
  ask_share_location?: boolean;
};

export type InputMode = "voice" | "text";

export type TriageTurnPayload = {
  transcript: string;
  inputMode?: InputMode;
  latitude?: number;
  longitude?: number;
};

/** :userId must equal the JWT user (OwnershipGuard → 403 otherwise). */
export function fetchDashboard(userId: string) {
  return apiFetch<DashboardResponse>(`/api/users/${userId}/dashboard`);
}

/** userId comes from the JWT cookie — never sent in the body. */
export function postTriageTurn(payload: TriageTurnPayload) {
  const body: Record<string, unknown> = {
    transcript: payload.transcript,
    inputMode: payload.inputMode ?? "voice",
  };
  if (payload.latitude !== undefined) body.latitude = payload.latitude;
  if (payload.longitude !== undefined) body.longitude = payload.longitude;
  return apiFetch<TurnResponse>("/api/triage/turn", {
    method: "POST",
    body,
  });
}

/** No body — userId from JWT. */
export function patchResetEmergency() {
  return apiFetch<{ is_emergency_state: boolean; active_mode: Tier }>(
    "/api/users/reset-emergency",
    { method: "PATCH" },
  );
}

/* ------------------------------------------------------------------ */
/*  History                                                           */
/* ------------------------------------------------------------------ */

export type HistoryEntry = {
  id: string;
  createdAt: string;
  detectedMode: Tier;
  detectedConditionId?: string | null;
  userMessage: string;
  auraReply: string;
};

export type HistorySession = {
  date: string;
  entries: HistoryEntry[];
};

export type HistoryResponse = {
  sessions: HistorySession[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type HistoryQuery = {
  limit?: number;
  days?: number;
  cursor?: string;
};

export function fetchHistory(userId: string, query: HistoryQuery = {}) {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.days !== undefined) params.set("days", String(query.days));
  if (query.cursor) params.set("cursor", query.cursor);
  const qs = params.toString();
  return apiFetch<HistoryResponse>(`/api/users/${userId}/history${qs ? `?${qs}` : ""}`);
}

/* ------------------------------------------------------------------ */
/*  Consent, feedback, handoff, location, data rights                 */
/* ------------------------------------------------------------------ */

export type ConsentType = "data_collection" | "third_party_sharing" | "voice_recording";

export type ConsentStatusItem = {
  consentType: ConsentType;
  granted: boolean;
  version?: string;
  updatedAt?: string;
};

export type ConsentStatusResponse = {
  consents?: ConsentStatusItem[];
  /** Some backends return a flat map instead of an array. */
  data_collection?: boolean;
  third_party_sharing?: boolean;
  voice_recording?: boolean;
};

export function postConsent(consentType: ConsentType, granted: boolean, version = "v1") {
  return apiFetch<{ message?: string }>("/api/consent", {
    method: "POST",
    body: { consentType, granted, version },
  });
}

export function getConsentStatus() {
  return apiFetch<ConsentStatusResponse>("/api/consent/status", { method: "GET" });
}

/** Normalize consent status into a predictable map. */
export function normalizeConsentStatus(
  res: ConsentStatusResponse,
): Record<ConsentType, boolean | null> {
  const map: Record<ConsentType, boolean | null> = {
    data_collection: null,
    third_party_sharing: null,
    voice_recording: null,
  };
  if (Array.isArray(res.consents)) {
    for (const item of res.consents) {
      map[item.consentType] = item.granted;
    }
  }
  if (typeof res.data_collection === "boolean") map.data_collection = res.data_collection;
  if (typeof res.third_party_sharing === "boolean") {
    map.third_party_sharing = res.third_party_sharing;
  }
  if (typeof res.voice_recording === "boolean") map.voice_recording = res.voice_recording;
  return map;
}

export function postFeedback(
  healthLogId: string,
  flaggedIncorrect: boolean,
  note?: string,
) {
  return apiFetch<{ message?: string }>("/api/feedback", {
    method: "POST",
    body: { healthLogId, flaggedIncorrect, note },
  });
}

export type HandoffResponse = {
  handoffId: string;
  status: string;
  message: string;
  emergencyContact: { name: string | null; phone: string | null } | null;
  createdAt: string;
};

export function postHandoff(note?: string) {
  return apiFetch<HandoffResponse>("/api/users/handoff", {
    method: "POST",
    body: note ? { note } : {},
  });
}

export type LocationResponse = {
  saved: boolean;
  nearest_er: NearestEr | null;
  message: string;
};

export function postLocation(latitude: number, longitude: number) {
  return apiFetch<LocationResponse>("/api/users/location", {
    method: "POST",
    body: { latitude, longitude },
  });
}

/** Full data export (password/refresh hashes omitted server-side). */
export function exportUserData(userId: string) {
  return apiFetch<Record<string, unknown>>(`/api/users/${userId}/export`);
}

/** Deletes HealthLogs, ExaInsights, FeedbackFlags, HumanHandoffRequests. */
export function deleteUserData(userId: string) {
  return apiFetch<{ message?: string }>(`/api/users/${userId}/data`, {
    method: "DELETE",
  });
}
