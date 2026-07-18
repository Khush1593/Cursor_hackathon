"use client";

import { useAuraStore } from "@/store/aura.store";

/** Shows the last 3 messages of the conversation, most recent at the bottom. */
export function ConversationOverlay() {
  const messages = useAuraStore((s) => s.messages);
  const isProcessing = useAuraStore((s) => s.isProcessing);
  const last3 = messages.slice(-3);

  return (
    <section className="aura-panel aura-transition flex flex-col gap-3 rounded-3xl p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-aura-muted uppercase">
          Conversation
        </h2>
        <span className="h-2 w-2 rounded-full bg-aura-accent" />
      </header>

      <div className="flex flex-col gap-3">
        {last3.map((m, i) => (
          <div
            key={`${m.createdAt}-${i}`}
            style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
            className={m.role === "aura" ? "flex justify-start" : "flex justify-end"}
          >
            <div
              className={[
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "aura"
                  ? "rounded-tl-sm bg-aura-accent-soft text-aura-ink"
                  : "rounded-tr-sm bg-aura-accent text-white",
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
