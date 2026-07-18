"use client";

import { useEffect, useState } from "react";
import { useAuraStore } from "@/store/aura.store";
import { TIER_META } from "@/lib/theme";

/** Paginated conversation history with feedback on each health log. */
export function HistoryPanel() {
  const sessions = useAuraStore((s) => s.historySessions);
  const hasMore = useAuraStore((s) => s.historyHasMore);
  const loading = useAuraStore((s) => s.historyLoading);
  const loadHistory = useAuraStore((s) => s.loadHistory);
  const flagFeedback = useAuraStore((s) => s.flagFeedback);
  const feedbackBusyId = useAuraStore((s) => s.feedbackBusyId);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadHistory(true);
  }, [loadHistory]);

  const onFlag = async (id: string) => {
    const ok = await flagFeedback(id, "Flagged incorrect from history");
    if (ok) setFlagged((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section className="aura-panel aura-transition flex flex-col gap-4 rounded-3xl p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-aura-ink">Care history</h2>
          <p className="text-xs text-aura-muted">Past check-ins, grouped by day</p>
        </div>
        <button
          type="button"
          onClick={() => void loadHistory(true)}
          disabled={loading}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-aura-accent hover:bg-aura-accent-soft disabled:opacity-50"
        >
          Refresh
        </button>
      </header>

      {sessions.length === 0 && !loading && (
        <p className="rounded-2xl bg-aura-accent-soft/50 px-4 py-6 text-center text-sm text-aura-muted">
          No history yet — talk with Aura to start a trail.
        </p>
      )}

      <div className="flex max-h-[28rem] flex-col gap-5 overflow-y-auto pr-1">
        {sessions.map((session) => (
          <div key={session.date} className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-aura-muted uppercase">
              {session.date}
            </p>
            {session.entries.map((entry) => {
              const meta = TIER_META[entry.detectedMode];
              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-[var(--aura-panel-border)] bg-white/50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-aura-accent-soft px-2.5 py-0.5 text-[10px] font-semibold text-aura-ink">
                      {meta.label}
                    </span>
                    <time className="text-[10px] text-aura-muted">
                      {new Date(entry.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="text-sm text-aura-ink">
                    <span className="font-medium">You:</span> {entry.userMessage}
                  </p>
                  <p className="mt-1.5 text-sm text-aura-muted">
                    <span className="font-medium text-aura-accent">Aura:</span>{" "}
                    {entry.auraReply}
                  </p>
                  <div className="mt-3 flex justify-end">
                    {flagged[entry.id] ? (
                      <span className="text-xs text-aura-muted">Flagged — thank you</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onFlag(entry.id)}
                        disabled={feedbackBusyId === entry.id}
                        className="text-xs font-medium text-red-600/80 hover:underline disabled:opacity-50"
                      >
                        {feedbackBusyId === entry.id ? "Sending…" : "Flag as incorrect"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => void loadHistory(false)}
          disabled={loading}
          className="rounded-full bg-aura-accent-soft px-4 py-2 text-sm font-medium text-aura-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
