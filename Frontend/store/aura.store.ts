"use client";

/**
 * Aura Zustand store — components read from here only.
 * Auth uses cookie sessions (lib/api.ts). Triage stays mock when USE_MOCK=1.
 */

import { create } from "zustand";
import {
  ApiError,
  type AuthUser,
  type ConsentType,
  type HistorySession,
  type HandoffResponse,
  type InputMode,
  type NearestEr,
  type TurnResponse as ApiTurnResponse,
  fetchDashboard,
  fetchHistory,
  getConsentStatus,
  getMe,
  isMockTriage,
  logout as apiLogout,
  normalizeConsentStatus,
  patchResetEmergency,
  postConsent,
  postFeedback,
  postHandoff,
  postLocation,
  postTriageTurn,
  setOnAuthFailure,
} from "@/lib/api";
import { speakReply } from "@/lib/audio";

export type Tier = "preventive" | "urgent_care" | "emergency";

export type Msg = {
  role: "user" | "aura";
  text: string;
  createdAt: string;
};

export type Point = {
  date: string;
  pain_level: number | null;
  sleep_hours: number | null;
};

export type Exa = {
  title: string;
  url: string;
  summary: string;
} | null;

export type User = {
  id?: string;
  email?: string;
  age: number;
  sex: string;
  chronicConditions?: string[];
  currentMeds?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type TurnResponse = ApiTurnResponse;

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export type ConsentMap = Record<ConsentType, boolean | null>;

export type DashboardTab = "overview" | "history" | "care";

export interface AuraState {
  authStatus: AuthStatus;
  userId: string;
  user: User | null;
  mode: Tier;
  isEmergency: boolean;
  /** Last turn's explainability bullets (for emergency handoff / ReasoningPanel). */
  lastReasoningTrace: string[];
  messages: Msg[];
  metrics: Point[];
  currentExa: Exa;
  reasoning: string[];
  isRecording: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  booted: boolean;
  apiError: string | null;
  lastCoords: { latitude: number; longitude: number } | null;
  nearestEr: NearestEr | null;
  askShareLocation: boolean;
  consents: ConsentMap;
  consentsLoaded: boolean;
  historySessions: HistorySession[];
  historyCursor: string | null;
  historyHasMore: boolean;
  historyLoading: boolean;
  handoff: HandoffResponse | null;
  handoffBusy: boolean;
  feedbackBusyId: string | null;
  activeTab: DashboardTab;

  hydrateFromAuthUser: (user: AuthUser) => void;
  clearSession: () => void;
  restoreSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  bootstrapDashboard: () => Promise<void>;
  setRecording: (v: boolean) => void;
  setLiveTranscript: (t: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
  clearApiError: () => void;
  sendTurn: (transcript: string, inputMode?: InputMode) => Promise<void>;
  applyResponse: (res: TurnResponse) => void;
  resetEmergency: () => Promise<void>;
  loadConsents: () => Promise<void>;
  grantConsents: (types: ConsentType[]) => Promise<boolean>;
  denyConsents: (types: ConsentType[]) => Promise<void>;
  loadHistory: (reset?: boolean) => Promise<void>;
  flagFeedback: (healthLogId: string, note?: string) => Promise<boolean>;
  requestHandoff: (note?: string) => Promise<boolean>;
  shareLocation: () => Promise<boolean>;
  clearHealthDataLocally: () => void;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_CONSENTS: ConsentMap = {
  data_collection: null,
  third_party_sharing: null,
  voice_recording: null,
};

const SEED_METRICS: Point[] = [
  { date: isoDaysAgo(6), pain_level: 6, sleep_hours: 5 },
  { date: isoDaysAgo(5), pain_level: 5, sleep_hours: 6 },
  { date: isoDaysAgo(4), pain_level: 5, sleep_hours: 5.5 },
  { date: isoDaysAgo(3), pain_level: 4, sleep_hours: 7 },
  { date: isoDaysAgo(2), pain_level: 4, sleep_hours: 6.5 },
  { date: isoDaysAgo(1), pain_level: 3, sleep_hours: 7.5 },
  { date: isoDaysAgo(0), pain_level: 3, sleep_hours: 7 },
];

const SEED_MESSAGES: Msg[] = [
  {
    role: "aura",
    text: "Good to see you. Hold the orb and tell me how you're feeling today.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const SEED_HISTORY: HistorySession[] = [
  {
    date: isoDaysAgo(0),
    entries: [
      {
        id: "seed-1",
        createdAt: new Date().toISOString(),
        detectedMode: "preventive",
        detectedConditionId: null,
        userMessage: "Feeling alright today",
        auraReply: "Glad you're checking in. I'm here whenever something feels off.",
      },
    ],
  },
];

function mockTurn(transcript: string): TurnResponse {
  const t = transcript.toLowerCase();

  if (
    t.includes("droop") ||
    t.includes("slurred") ||
    (t.includes("face") && t.includes("numb"))
  ) {
    return {
      action_type: "emergency_escalation",
      detected_mode: "emergency",
      ai_spoken_response:
        "These signs can mean a stroke. Call emergency services now — every minute matters.",
      audio_base64: null,
      is_emergency_state: true,
      updated_metrics: null,
      exa_insight: null,
      reasoning_trace: [
        "Matched: stroke_tia (severity 10)",
        "Emergency bypass: empty secondary_symptoms_to_check",
      ],
      ask_share_location: true,
      nearest_er: null,
    };
  }

  if (t.includes("chest")) {
    return {
      action_type: "emergency_escalation",
      detected_mode: "emergency",
      ai_spoken_response:
        "This could be a serious cardiac warning. I'm escalating now — please call emergency services or use the buttons below.",
      audio_base64: null,
      is_emergency_state: true,
      updated_metrics: { pain_level: 9, sleep_hours: null },
      exa_insight: null,
      reasoning_trace: [
        "Matched: acute_myocardial_infarction (severity 10)",
        "Emergency bypass — no follow-up needed",
        "Escalating to emergency care",
      ],
      ask_share_location: true,
      nearest_er: null,
    };
  }

  if (t.includes("headache") || t.includes("head")) {
    return {
      action_type: "ask_follow_up",
      detected_mode: "urgent_care",
      ai_spoken_response:
        "I hear you. Is the headache sudden and the worst you've ever had, or does it come with a stiff neck or vision changes?",
      audio_base64: null,
      is_emergency_state: false,
      updated_metrics: { pain_level: 6, sleep_hours: null },
      exa_insight: null,
      reasoning_trace: [
        "Matched: tension_headache (severity 3), meningitis (severity 9)",
        "Ruling out red flags before downgrading",
        "Checking secondary: sudden onset, stiff neck, vision changes",
      ],
    };
  }

  if (t.includes("sleep") || t.includes("tired") || t.includes("slept")) {
    return {
      action_type: "resolve",
      detected_mode: "preventive",
      ai_spoken_response:
        "Thanks for logging that. Your sleep has been trending up this week — keep a consistent wind-down routine and we'll keep watching it together.",
      audio_base64: null,
      is_emergency_state: false,
      updated_metrics: { pain_level: null, sleep_hours: 6 },
      exa_insight: {
        title: "Sleep hygiene: evidence-based tips for better rest",
        url: "https://www.sleepfoundation.org/sleep-hygiene",
        summary:
          "Consistent sleep and wake times, a cool dark room, and limiting screens before bed measurably improve sleep quality over a few weeks.",
      },
      reasoning_trace: [
        "Matched: sleep_disturbance (severity 2)",
        "No red-flag secondaries present",
        "Resolving as preventive — researching guidance",
      ],
    };
  }

  return {
    action_type: "general_response",
    detected_mode: "preventive",
    ai_spoken_response:
      "Glad you're checking in. I'm here whenever something feels off — just hold the orb and talk.",
    audio_base64: null,
    is_emergency_state: false,
    updated_metrics: null,
    exa_insight: null,
    reasoning_trace: ["No clinical triggers matched"],
  };
}

function toUser(u: AuthUser): User {
  return {
    id: u.id,
    email: u.email,
    age: u.age,
    sex: u.sex,
    chronicConditions: u.chronicConditions ?? [],
    currentMeds: u.currentMeds ?? [],
    emergencyContactName: u.emergencyContactName ?? undefined,
    emergencyContactPhone: u.emergencyContactPhone ?? undefined,
  };
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}

export const useAuraStore = create<AuraState>((set, get) => {
  if (typeof window !== "undefined") {
    setOnAuthFailure(() => {
      get().clearSession();
      redirectToLogin();
    });
  }

  return {
    authStatus: "unknown",
    userId: "",
    user: null,
    mode: "preventive",
    isEmergency: false,
    lastReasoningTrace: [],
    messages: [],
    metrics: [],
    currentExa: null,
    reasoning: [],
    isRecording: false,
    isProcessing: false,
    liveTranscript: "",
    booted: false,
    apiError: null,
    lastCoords: null,
    nearestEr: null,
    askShareLocation: false,
    consents: { ...EMPTY_CONSENTS },
    consentsLoaded: false,
    historySessions: [],
    historyCursor: null,
    historyHasMore: false,
    historyLoading: false,
    handoff: null,
    handoffBusy: false,
    feedbackBusyId: null,
    activeTab: "overview",

    hydrateFromAuthUser: (authUser) => {
      set({
        authStatus: "authenticated",
        userId: authUser.id,
        user: toUser(authUser),
        mode: authUser.activeMode,
        isEmergency: authUser.isEmergencyState,
        booted: false,
        apiError: null,
      });
    },

    clearSession: () => {
      set({
        authStatus: "unauthenticated",
        userId: "",
        user: null,
        mode: "preventive",
        isEmergency: false,
        lastReasoningTrace: [],
        messages: [],
        metrics: [],
        currentExa: null,
        reasoning: [],
        booted: false,
        isRecording: false,
        isProcessing: false,
        liveTranscript: "",
        apiError: null,
        lastCoords: null,
        nearestEr: null,
        askShareLocation: false,
        consents: { ...EMPTY_CONSENTS },
        consentsLoaded: false,
        historySessions: [],
        historyCursor: null,
        historyHasMore: false,
        handoff: null,
        activeTab: "overview",
      });
    },

    restoreSession: async () => {
      try {
        const me = await getMe();
        get().hydrateFromAuthUser(me);
        return true;
      } catch {
        get().clearSession();
        return false;
      }
    },

    logout: async () => {
      try {
        await apiLogout();
      } catch {
        /* still clear local session */
      }
      get().clearSession();
    },

    bootstrapDashboard: async () => {
      if (get().booted) return;
      const { userId, user } = get();

      if (isMockTriage()) {
        set({
          booted: true,
          metrics: SEED_METRICS,
          messages: SEED_MESSAGES,
          currentExa: null,
          mode: get().mode || "preventive",
          isEmergency: get().isEmergency,
          consents: {
            data_collection: true,
            voice_recording: true,
            third_party_sharing: true,
          },
          consentsLoaded: true,
          historySessions: SEED_HISTORY,
          historyHasMore: false,
          historyCursor: null,
          apiError: null,
        });
        return;
      }

      if (!userId) return;

      try {
        const dash = await fetchDashboard(userId);
        set({
          booted: true,
          mode: dash.user.activeMode,
          isEmergency: dash.user.isEmergencyState,
          user: {
            id: dash.user.id,
            email: user?.email,
            age: dash.user.age,
            sex: dash.user.sex,
            chronicConditions: user?.chronicConditions ?? [],
            currentMeds: user?.currentMeds ?? [],
            emergencyContactName: dash.user.emergencyContactName ?? undefined,
            emergencyContactPhone: dash.user.emergencyContactPhone ?? undefined,
          },
          metrics: dash.metricsHistory,
          messages: dash.recentMessages,
          currentExa: null,
          apiError: null,
        });
        await get().loadConsents();
      } catch (err) {
        set({
          booted: true,
          apiError:
            err instanceof ApiError
              ? err.message
              : "Could not load your dashboard. Check the API connection.",
          metrics: [],
          messages: [],
        });
      }
    },

    setRecording: (v) => set({ isRecording: v }),
    setLiveTranscript: (t) => set({ liveTranscript: t }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    clearApiError: () => set({ apiError: null }),

    loadConsents: async () => {
      if (isMockTriage()) {
        set({
          consents: {
            data_collection: true,
            voice_recording: true,
            third_party_sharing: true,
          },
          consentsLoaded: true,
        });
        return;
      }
      try {
        const res = await getConsentStatus();
        set({
          consents: normalizeConsentStatus(res),
          consentsLoaded: true,
        });
      } catch {
        set({ consentsLoaded: true });
      }
    },

    grantConsents: async (types) => {
      if (isMockTriage()) {
        set((s) => {
          const next = { ...s.consents };
          for (const t of types) next[t] = true;
          return { consents: next };
        });
        return true;
      }
      try {
        await Promise.all(types.map((t) => postConsent(t, true)));
        set((s) => {
          const next = { ...s.consents };
          for (const t of types) next[t] = true;
          return { consents: next, apiError: null };
        });
        return true;
      } catch (err) {
        set({
          apiError: err instanceof ApiError ? err.message : "Could not save consent.",
        });
        return false;
      }
    },

    denyConsents: async (types) => {
      if (!isMockTriage()) {
        try {
          await Promise.all(types.map((t) => postConsent(t, false)));
        } catch {
          /* keep local deny */
        }
      }
      set((s) => {
        const next = { ...s.consents };
        for (const t of types) next[t] = false;
        return { consents: next };
      });
    },

    sendTurn: async (transcript, inputMode = "voice") => {
      const clean = transcript.trim();
      if (!clean) return;

      const { consents, lastCoords } = get();
      if (consents.data_collection !== true) {
        set({
          apiError: "Please accept data collection before talking with Aura.",
          activeTab: "overview",
        });
        return;
      }
      if (inputMode === "voice" && consents.voice_recording !== true) {
        set({
          apiError: "Please accept voice recording before using the microphone.",
        });
        return;
      }

      const now = new Date().toISOString();
      set((s) => ({
        messages: [...s.messages, { role: "user", text: clean, createdAt: now }],
        isProcessing: true,
        liveTranscript: "",
        apiError: null,
      }));

      try {
        let res: TurnResponse;
        if (isMockTriage()) {
          await new Promise((r) => setTimeout(r, 700));
          res = mockTurn(clean);
        } else {
          res = await postTriageTurn({
            transcript: clean,
            inputMode,
            latitude: lastCoords?.latitude,
            longitude: lastCoords?.longitude,
          });
        }
        get().applyResponse(res);
        speakReply(res.ai_spoken_response, res.audio_base64);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "I couldn't reach the care service just now. Please try again in a moment.";
        set({ apiError: message });
        get().applyResponse({
          action_type: "general_response",
          detected_mode: get().mode,
          ai_spoken_response: message,
          audio_base64: null,
          is_emergency_state: get().isEmergency,
          updated_metrics: null,
          exa_insight: null,
          reasoning_trace: [],
        });
        speakReply(message, null);
      } finally {
        set({ isProcessing: false });
      }
    },

    applyResponse: (res) => {
      const now = new Date().toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const trace = res.reasoning_trace ?? [];

      set((s) => {
        let metrics = s.metrics;
        if (res.updated_metrics) {
          const { pain_level, sleep_hours } = res.updated_metrics;
          const idx = metrics.findIndex((p) => p.date === today);
          const base: Point =
            idx >= 0
              ? metrics[idx]
              : { date: today, pain_level: null, sleep_hours: null };
          const merged: Point = {
            date: today,
            pain_level: pain_level ?? base.pain_level,
            sleep_hours: sleep_hours ?? base.sleep_hours,
          };
          metrics =
            idx >= 0
              ? metrics.map((p, i) => (i === idx ? merged : p))
              : [...metrics, merged];
        }

        return {
          mode: res.detected_mode,
          isEmergency: res.is_emergency_state,
          lastReasoningTrace: trace,
          messages: [
            ...s.messages,
            { role: "aura", text: res.ai_spoken_response, createdAt: now },
          ],
          metrics,
          currentExa: res.exa_insight ?? s.currentExa,
          reasoning: trace,
          nearestEr: res.nearest_er ?? s.nearestEr,
          askShareLocation: !!res.ask_share_location,
        };
      });
    },

    resetEmergency: async () => {
      if (!isMockTriage()) {
        try {
          const res = await patchResetEmergency();
          set({
            isEmergency: res.is_emergency_state,
            mode: res.active_mode,
            askShareLocation: false,
            lastReasoningTrace: [],
          });
          return;
        } catch {
          /* fall through to local reset */
        }
      }
      set({
        isEmergency: false,
        mode: "preventive",
        askShareLocation: false,
        lastReasoningTrace: [],
      });
    },

    loadHistory: async (reset = false) => {
      const { userId, historyLoading, historyCursor, historyHasMore } = get();
      if (historyLoading) return;
      if (!reset && !historyHasMore && historyCursor) return;

      if (isMockTriage()) {
        set({
          historySessions: SEED_HISTORY,
          historyHasMore: false,
          historyCursor: null,
          historyLoading: false,
        });
        return;
      }

      if (!userId) return;
      set({ historyLoading: true });
      try {
        const res = await fetchHistory(userId, {
          limit: 20,
          days: 30,
          cursor: reset ? undefined : (historyCursor ?? undefined),
        });
        set((s) => ({
          historySessions: reset
            ? res.sessions
            : mergeHistorySessions(s.historySessions, res.sessions),
          historyCursor: res.nextCursor,
          historyHasMore: res.hasMore,
          historyLoading: false,
          apiError: null,
        }));
      } catch (err) {
        set({
          historyLoading: false,
          apiError: err instanceof ApiError ? err.message : "Could not load history.",
        });
      }
    },

    flagFeedback: async (healthLogId, note) => {
      if (isMockTriage()) return true;
      set({ feedbackBusyId: healthLogId });
      try {
        await postFeedback(healthLogId, true, note);
        set({ feedbackBusyId: null, apiError: null });
        return true;
      } catch (err) {
        set({
          feedbackBusyId: null,
          apiError: err instanceof ApiError ? err.message : "Could not send feedback.",
        });
        return false;
      }
    },

    requestHandoff: async (note) => {
      set({ handoffBusy: true });
      if (isMockTriage()) {
        const mock: HandoffResponse = {
          handoffId: "mock-handoff",
          status: "open",
          message: "A care coordinator will follow up.",
          emergencyContact: {
            name: get().user?.emergencyContactName ?? null,
            phone: get().user?.emergencyContactPhone ?? null,
          },
          createdAt: new Date().toISOString(),
        };
        set({ handoff: mock, handoffBusy: false });
        return true;
      }
      try {
        const res = await postHandoff(note);
        set({ handoff: res, handoffBusy: false, apiError: null });
        return true;
      } catch (err) {
        set({
          handoffBusy: false,
          apiError:
            err instanceof ApiError ? err.message : "Could not request a human handoff.",
        });
        return false;
      }
    },

    shareLocation: async () => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        set({ apiError: "Location is not available in this browser." });
        return false;
      }

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
          });
        });
        const { latitude, longitude } = pos.coords;
        set({ lastCoords: { latitude, longitude } });

        if (isMockTriage()) {
          const mockEr: NearestEr = {
            name: "City General Hospital ER",
            address: "100 Care Ave",
            distance_miles: 1.2,
          };
          set({
            nearestEr: mockEr,
            askShareLocation: false,
            apiError: null,
          });
          return true;
        }

        const res = await postLocation(latitude, longitude);
        set({
          nearestEr: res.nearest_er,
          askShareLocation: false,
          apiError: null,
        });
        return true;
      } catch (err) {
        const geoDenied =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof (err as { code: unknown }).code === "number";
        const message = geoDenied
          ? "Location permission denied. You can still call emergency services."
          : err instanceof ApiError
            ? err.message
            : "Could not share location.";
        set({ apiError: message });
        return false;
      }
    },

    clearHealthDataLocally: () => {
      set({
        messages: SEED_MESSAGES.slice(0, 1),
        metrics: [],
        currentExa: null,
        reasoning: [],
        lastReasoningTrace: [],
        historySessions: [],
        historyCursor: null,
        historyHasMore: false,
        handoff: null,
        nearestEr: null,
      });
    },
  };
});

function mergeHistorySessions(
  existing: HistorySession[],
  incoming: HistorySession[],
): HistorySession[] {
  const byDate = new Map<string, HistorySession>();
  for (const s of existing) {
    byDate.set(s.date, {
      date: s.date,
      entries: [...s.entries],
    });
  }
  for (const s of incoming) {
    const prev = byDate.get(s.date);
    if (!prev) {
      byDate.set(s.date, { date: s.date, entries: [...s.entries] });
    } else {
      const seen = new Set(prev.entries.map((e) => e.id));
      for (const e of s.entries) {
        if (!seen.has(e.id)) prev.entries.push(e);
      }
    }
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}
