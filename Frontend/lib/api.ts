/**
 * Backend API client — cookie session auth (HttpOnly).
 * Never stores tokens in localStorage/sessionStorage.
 *
 * In the browser we call same-origin `/api-proxy/*` (Next.js rewrite →
 * NEXT_PUBLIC_API_URL) so Set-Cookie sticks on localhost:3001 even when the
 * real API is ngrok/HTTPS. Server-side / tooling can still hit the absolute URL.
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
/*  Auth endpoints (Backend/api_documentation.md)                     */
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
/*  PHI / triage (real backend when USE_MOCK=0)                       */
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

export type TurnResponse = {
  action_type: "ask_follow_up" | "resolve" | "emergency_escalation" | "general_response";
  detected_mode: Tier;
  ai_spoken_response: string;
  audio_base64: string | null;
  is_emergency_state: boolean;
  updated_metrics: { pain_level: number | null; sleep_hours: number | null } | null;
  exa_insight: { title: string; url: string; summary: string } | null;
  /** V6 explainability bullets from Nest/Python (optional for older mocks). */
  reasoning_trace?: string[];
};

export function fetchDashboard(userId: string) {
  return apiFetch<DashboardResponse>(`/api/users/${userId}/dashboard`);
}

export function postTriageTurn(userId: string, transcript: string) {
  return apiFetch<TurnResponse>("/api/triage/turn", {
    method: "POST",
    body: { userId, transcript, inputMode: "voice" },
  });
}

export function patchResetEmergency(userId: string) {
  return apiFetch<{ is_emergency_state: boolean; active_mode: Tier }>(
    "/api/users/reset-emergency",
    {
      method: "PATCH",
      body: { userId },
    },
  );
}
