"use client";

import { useEffect, useState } from "react";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useAuraStore } from "@/store/aura.store";

/**
 * The living Aura orb — press and hold to speak.
 *
 * It is the emotional centerpiece: it breathes at rest, flares while listening,
 * and spins a ring while Aura is thinking. Its color follows the active tier
 * through CSS variables, so the orb itself reflects the severity state.
 */
export function PushToTalkButton() {
  const { press, release, submitText, supported } = usePushToTalk();
  const isRecording = useAuraStore((s) => s.isRecording);
  const isProcessing = useAuraStore((s) => s.isProcessing);
  const liveTranscript = useAuraStore((s) => s.liveTranscript);

  const [held, setHeld] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedInvalid, setTypedInvalid] = useState(false);

  // Safety: release if the pointer leaves the window mid-press.
  useEffect(() => {
    if (!held) return;
    const up = () => {
      setHeld(false);
      release();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [held, release]);

  const onDown = () => {
    if (isProcessing) return;
    setHeld(true);
    press();
  };

  const orbState = isProcessing ? "thinking" : isRecording ? "listening" : "idle";

  const label =
    orbState === "thinking"
      ? "Aura is thinking…"
      : orbState === "listening"
        ? "Listening — release to send"
        : "Hold to speak";

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* outer breathing halo */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "radial-gradient(circle, var(--aura-glow), transparent 62%)",
            animation: "breathe 6s ease-in-out infinite",
          }}
        />

        {/* thinking ring */}
        {orbState === "thinking" && (
          <span
            className="animate-spin-slow pointer-events-none absolute inset-3 rounded-full border-2 border-transparent"
            style={{ borderTopColor: "var(--aura-accent)" }}
          />
        )}

        {/* the orb button */}
        <button
          type="button"
          aria-label={label}
          aria-pressed={isRecording}
          disabled={isProcessing}
          onPointerDown={onDown}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative flex h-44 w-44 items-center justify-center rounded-full outline-none transition-transform duration-200 focus-visible:ring-4 focus-visible:ring-aura-accent/40 active:scale-95 disabled:cursor-wait"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--aura-accent) 78%, white), var(--aura-accent) 70%, color-mix(in srgb, var(--aura-accent) 60%, black))",
            animation:
              orbState === "listening"
                ? "orb-listen 1.4s ease-in-out infinite"
                : "orb-pulse 4s ease-in-out infinite",
          }}
        >
          {/* glass sheen */}
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 26%, rgba(255,255,255,0.55), transparent 45%)",
            }}
          />
          <MicIcon active={orbState === "listening"} />
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-aura-ink">{label}</p>
        {isRecording && liveTranscript && (
          <p className="mt-2 max-w-xs text-sm text-aura-muted italic">
            “{liveTranscript}”
          </p>
        )}
      </div>

      {!supported && (
        <form
          noValidate
          className="flex w-full max-w-sm items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = typed.trim();
            if (!value) {
              setTypedInvalid(true);
              return;
            }
            if (isProcessing) return;
            submitText(value);
            setTyped("");
            setTypedInvalid(false);
          }}
        >
          <input
            value={typed}
            aria-invalid={typedInvalid}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(v);
              if (typedInvalid) setTypedInvalid(!v.trim());
            }}
            placeholder="Voice unavailable — type how you feel"
            className={[
              "aura-transition flex-1 rounded-full bg-white/70 px-4 py-2 text-sm text-aura-ink outline-none placeholder:text-aura-muted/70",
              typedInvalid
                ? "border-2 border-red-500 focus:ring-2 focus:ring-red-400/30"
                : "aura-panel border border-[var(--aura-panel-border)] focus:ring-2 focus:ring-aura-accent/40",
            ].join(" ")}
          />
          <button
            type="submit"
            className="rounded-full bg-aura-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={isProcessing}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="relative h-14 w-14 text-white drop-shadow"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.92 }}
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
