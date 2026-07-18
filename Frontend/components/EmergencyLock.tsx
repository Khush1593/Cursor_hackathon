"use client";

import { useMemo, useState } from "react";
import {
  buildClinicalHandoffText,
  buildRelativeNotifyPreview,
} from "@/lib/clinicalHandoff";
import { useAuraStore } from "@/store/aura.store";

/**
 * Full-screen emergency lock when `isEmergency` is true.
 * Shows Aura's AI message, a clinical handoff TEXT card (no QR),
 * and a "would notify relatives" preview (demo — does not send SMS).
 */
export function EmergencyLock() {
  const isEmergency = useAuraStore((s) => s.isEmergency);
  const user = useAuraStore((s) => s.user);
  const messages = useAuraStore((s) => s.messages);
  const metrics = useAuraStore((s) => s.metrics);
  const reasoningTrace = useAuraStore((s) => s.lastReasoningTrace);
  const resetEmergency = useAuraStore((s) => s.resetEmergency);
  const [dismissing, setDismissing] = useState(false);
  const [showHandoff, setShowHandoff] = useState(true);

  const lastUser = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user"),
    [messages],
  );
  const lastAura = useMemo(
    () => [...messages].reverse().find((m) => m.role === "aura"),
    [messages],
  );

  const handoffText = useMemo(
    () =>
      buildClinicalHandoffText({
        age: user?.age,
        sex: user?.sex,
        chronicConditions: user?.chronicConditions,
        currentMeds: user?.currentMeds,
        chiefComplaint: lastUser?.text,
        aiSpoken: lastAura?.text,
        reasoningTrace,
        metrics,
      }),
    [user, lastUser, lastAura, reasoningTrace, metrics],
  );

  const notifyPreview = useMemo(
    () =>
      buildRelativeNotifyPreview({
        contactName: user?.emergencyContactName,
        handoffSummary: handoffText,
      }),
    [user?.emergencyContactName, handoffText],
  );

  if (!isEmergency) return null;

  const contactName = user?.emergencyContactName;
  const contactPhone = user?.emergencyContactPhone;
  const aiMessage =
    lastAura?.text?.trim() ||
    "Aura detected symptoms that may be life-threatening. Get help now.";

  const onDismiss = async () => {
    setDismissing(true);
    await resetEmergency();
    setDismissing(false);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
      style={{
        background:
          "radial-gradient(1200px 700px at 50% -10%, #dc2626, #991b1b 60%, #7f1d1d)",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 220px 40px rgba(0,0,0,0.5)",
          animation: "alarm 1.1s ease-in-out infinite",
        }}
      />

      <div className="relative w-full max-w-lg text-center text-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30">
          <svg
            viewBox="0 0 24 24"
            className="h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "alarm 1.1s ease-in-out infinite" }}
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight">Possible emergency</h1>

        {/* Prominent Aura AI message */}
        <p className="mx-auto mt-4 max-w-md rounded-2xl bg-black/25 px-4 py-3 text-left text-base leading-relaxed text-white shadow-inner ring-1 ring-white/20">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Aura says
          </span>
          {aiMessage}
        </p>

        {reasoningTrace.length > 0 && (
          <ul className="mx-auto mt-3 max-w-md list-disc space-y-1 px-6 text-left text-sm text-white/85">
            {reasoningTrace.slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="tel:911"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-bold text-red-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            <PhoneIcon />
            Call 911
          </a>

          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <PhoneIcon />
              Call {contactName ?? "emergency contact"}
              <span className="text-white/70">· {contactPhone}</span>
            </a>
          )}
        </div>

        {/* Clinical handoff TEXT card (no QR) */}
        <div className="mt-6 text-left">
          <button
            type="button"
            onClick={() => setShowHandoff((v) => !v)}
            className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            {showHandoff ? "Hide" : "Show"} 911 / EMT clinical handoff
          </button>

          {showHandoff && (
            <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/40 px-4 py-3 font-mono text-[12px] leading-relaxed text-white/95 ring-1 ring-white/25">
              {handoffText}
            </pre>
          )}
        </div>

        {/* Relatives notify preview — demo only, does not send */}
        <div className="mt-4 rounded-xl border border-amber-200/40 bg-amber-950/30 px-4 py-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/80">
            Relative alert (demo preview — not sent)
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-50/95">
            {notifyPreview}
          </p>
          {!contactPhone && (
            <p className="mt-2 text-xs text-amber-100/70">
              Add an emergency contact in your profile so Aura can preview who would
              be notified.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          className="mt-8 text-sm font-medium text-white/80 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
        >
          Crisis handled — dismiss
        </button>

        <p className="mt-5 text-[11px] leading-relaxed text-white/60">
          Aura is not a medical device and does not diagnose. The handoff is structured
          context for helpers — not a clinical diagnosis. If you are unsure, call
          emergency services.
        </p>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
