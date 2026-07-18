"use client";

import { useState } from "react";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useAuraStore } from "@/store/aura.store";

/**
 * The living Aura orb — tap to start listening, tap again to stop & send.
 * Aura speaks its reply aloud so the experience feels like a conversation.
 */
export function PushToTalkButton() {
  const { toggle, submitText, supported, canVoice, canText } = usePushToTalk();
  const isRecording = useAuraStore((s) => s.isRecording);
  const isProcessing = useAuraStore((s) => s.isProcessing);
  const liveTranscript = useAuraStore((s) => s.liveTranscript);

  const [typed, setTyped] = useState("");
  const [typedInvalid, setTypedInvalid] = useState(false);
  const [showText, setShowText] = useState(false);

  const locked = !canVoice && !canText;

  const onToggle = () => {
    if (isProcessing || !canVoice) return;
    toggle();
  };

  const orbState = isProcessing ? "thinking" : isRecording ? "listening" : "idle";

  const label = locked
    ? "Accept privacy consent to talk"
    : !canVoice
      ? "Voice locked — type below"
      : orbState === "thinking"
        ? "Aura is thinking…"
        : orbState === "listening"
          ? "Listening — pause to send, or tap to stop"
          : "Tap to speak";

  const textFallback = !supported || showText || !canVoice;

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
        <span
          className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "radial-gradient(circle, var(--aura-glow), transparent 62%)",
            animation: "breathe 6s ease-in-out infinite",
            opacity: locked ? 0.35 : 1,
          }}
        />

        {orbState === "thinking" && (
          <span
            className="animate-spin-slow pointer-events-none absolute inset-3 rounded-full border-2 border-transparent"
            style={{ borderTopColor: "var(--aura-accent)" }}
          />
        )}

        <button
          type="button"
          aria-label={label}
          aria-pressed={isRecording}
          disabled={isProcessing || !canVoice}
          onClick={onToggle}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative flex h-40 w-40 items-center justify-center rounded-full outline-none transition-transform duration-200 focus-visible:ring-4 focus-visible:ring-aura-accent/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:h-44 sm:w-44"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--aura-accent) 78%, white), var(--aura-accent) 70%, color-mix(in srgb, var(--aura-accent) 60%, black))",
            animation:
              orbState === "listening"
                ? "orb-listen 1.4s ease-in-out infinite"
                : "orb-pulse 4s ease-in-out infinite",
          }}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 26%, rgba(255,255,255,0.55), transparent 45%)",
            }}
          />
          {orbState === "listening" ? <StopIcon /> : <MicIcon active={false} />}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-aura-ink">{label}</p>
        {isRecording && liveTranscript && (
          <p className="mt-2 max-w-xs text-sm text-aura-muted italic">
            “{liveTranscript}”
          </p>
        )}
        {orbState === "thinking" && (
          <p className="mt-2 text-xs text-aura-muted">Aura will speak the reply aloud</p>
        )}
        {supported && canVoice && (
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="mt-3 text-xs font-medium text-aura-accent hover:underline"
          >
            {showText ? "Hide text input" : "Prefer typing?"}
          </button>
        )}
      </div>

      {textFallback && (
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
            if (isProcessing || !canText) return;
            submitText(value);
            setTyped("");
            setTypedInvalid(false);
          }}
        >
          <input
            value={typed}
            aria-invalid={typedInvalid}
            disabled={!canText || isProcessing}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(v);
              if (typedInvalid) setTypedInvalid(!v.trim());
            }}
            placeholder={
              !canText ? "Accept data collection to type" : "Type how you feel…"
            }
            className={[
              "aura-transition flex-1 rounded-full bg-white px-4 py-2 text-sm text-aura-ink outline-none placeholder:text-aura-muted/70 disabled:opacity-50",
              typedInvalid
                ? "border-2 border-red-500 focus:ring-2 focus:ring-red-400/30"
                : "border border-[var(--aura-panel-border)] focus:ring-2 focus:ring-aura-accent/40",
            ].join(" ")}
          />
          <button
            type="submit"
            className="rounded-full bg-aura-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={isProcessing || !canText}
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

function StopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="relative h-12 w-12 text-white drop-shadow"
      fill="currentColor"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}
