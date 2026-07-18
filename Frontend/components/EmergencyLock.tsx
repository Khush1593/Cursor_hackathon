"use client";

import { useState } from "react";
import { useAuraStore } from "@/store/aura.store";

/**
 * Full-screen emergency lock with 911, emergency contact, location share,
 * and nearest ER details when available.
 */
export function EmergencyLock() {
  const isEmergency = useAuraStore((s) => s.isEmergency);
  const user = useAuraStore((s) => s.user);
  const nearestEr = useAuraStore((s) => s.nearestEr);
  const askShareLocation = useAuraStore((s) => s.askShareLocation);
  const resetEmergency = useAuraStore((s) => s.resetEmergency);
  const shareLocation = useAuraStore((s) => s.shareLocation);
  const apiError = useAuraStore((s) => s.apiError);
  const [dismissing, setDismissing] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  if (!isEmergency) return null;

  const contactName = user?.emergencyContactName;
  const contactPhone = user?.emergencyContactPhone;

  const onDismiss = async () => {
    setDismissing(true);
    await resetEmergency();
    setDismissing(false);
  };

  const onShareLocation = async () => {
    setLocBusy(true);
    await shareLocation();
    setLocBusy(false);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
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

      <div className="relative w-full max-w-md text-center text-white">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30">
          <svg
            viewBox="0 0 24 24"
            className="h-11 w-11"
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

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Possible emergency</h1>
        <p className="mx-auto mt-2 max-w-sm text-white/85">
          Aura detected symptoms that may be life-threatening. Get help now — don&apos;t
          wait.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="tel:911"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-bold text-red-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            <PhoneIcon />
            Call emergency services
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

          {(askShareLocation || !nearestEr) && (
            <button
              type="button"
              onClick={() => void onShareLocation()}
              disabled={locBusy}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <PinIcon />
              {locBusy ? "Finding nearest ER…" : "Share location for nearest ER"}
            </button>
          )}
        </div>

        {nearestEr && (
          <div className="mt-5 rounded-2xl border border-white/30 bg-white/10 p-4 text-left backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">
              Nearest ER
            </p>
            <p className="mt-1 text-lg font-semibold">{nearestEr.name}</p>
            <p className="text-sm text-white/80">{nearestEr.address}</p>
            <p className="mt-1 text-sm font-medium text-white">
              ~{nearestEr.distance_miles.toFixed(1)} miles away
            </p>
          </div>
        )}

        {apiError && <p className="mt-3 text-xs text-white/75">{apiError}</p>}

        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          className="mt-8 text-sm font-medium text-white/80 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
        >
          Crisis handled — dismiss
        </button>

        <p className="mt-6 text-[11px] leading-relaxed text-white/60">
          Aura is not a medical device and does not diagnose. If you are unsure, always
          call emergency services.
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

function PinIcon() {
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
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
