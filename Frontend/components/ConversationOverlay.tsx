"use client";

import { useEffect, useRef } from "react";
import { useAuraStore } from "@/store/aura.store";

/** Large, scrollable conversation workspace with the newest message in view. */
export function ConversationOverlay() {
  const messages = useAuraStore((s) => s.messages);
  const isProcessing = useAuraStore((s) => s.isProcessing);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isProcessing]);

  return (
    <section className="aura-panel aura-transition flex min-h-[28rem] flex-col overflow-hidden rounded-[2rem] shadow-sm">
      <header className="flex items-center justify-between border-b border-[var(--aura-panel-border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-aura-ink">Your conversation</h2>
          <p className="mt-0.5 text-xs text-aura-muted">
            {messages.length
              ? `${messages.length} message${messages.length === 1 ? "" : "s"} in this check-in`
              : "A private space to describe how you feel"}
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-aura-muted">
          <span className="h-2 w-2 rounded-full bg-aura-accent" />
          Live
        </span>
      </header>

      <div
        ref={scrollRef}
        className="aura-scrollbar flex max-h-[35rem] min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="m-auto max-w-xs text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-aura-accent-soft text-aura-accent">
              <ChatIcon />
            </span>
            <p className="mt-3 text-sm font-medium text-aura-ink">Start a check-in</p>
            <p className="mt-1 text-xs leading-relaxed text-aura-muted">
              Hold the orb or type a message. Aura will keep the full conversation here.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={`${m.createdAt}-${i}`}
            style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
            className={m.role === "aura" ? "flex justify-start" : "flex justify-end"}
          >
            <div
              className={[
                "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%]",
                m.role === "aura"
                  ? "rounded-tl-sm border border-[var(--aura-panel-border)] bg-white/65 text-aura-ink"
                  : "rounded-tr-sm bg-aura-accent text-white shadow-sm",
              ].join(" ")}
            >
              {m.role === "aura" && (
                <span className="mb-0.5 block text-[10px] font-semibold tracking-widest text-aura-accent uppercase opacity-80">
                  Aura
                </span>
              )}
              {m.text}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-aura-accent-soft px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 rounded-full bg-aura-accent"
                  style={{
                    animation: "breathe 1s ease-in-out infinite",
                    animationDelay: `${d * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}
