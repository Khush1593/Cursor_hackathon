"use client";

import { AuraHeader } from "@/components/AuraHeader";
import { AuthGate } from "@/components/AuthGate";
import { CarePanel } from "@/components/CarePanel";
import { ConsentGate } from "@/components/ConsentGate";
import { ConversationOverlay } from "@/components/ConversationOverlay";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EmergencyLock } from "@/components/EmergencyLock";
import { ExaInsightCard } from "@/components/ExaInsightCard";
import { HistoryPanel } from "@/components/HistoryPanel";
import { MetricsChart } from "@/components/MetricsChart";
import { PushToTalkButton } from "@/components/PushToTalkButton";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import { useAuraStore } from "@/store/aura.store";
import { TIER_META } from "@/lib/theme";

export default function Home() {
  const mode = useAuraStore((s) => s.mode);
  const activeTab = useAuraStore((s) => s.activeTab);
  const apiError = useAuraStore((s) => s.apiError);
  const clearApiError = useAuraStore((s) => s.clearApiError);
  const reasoning = useAuraStore((s) => s.reasoning);
  const currentExa = useAuraStore((s) => s.currentExa);

  return (
    <AuthGate>
      <DashboardLayout>
        <AuraHeader />

        {apiError && (
          <div className="mx-auto mt-4 w-full max-w-6xl px-6 sm:px-10">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{apiError}</p>
              <button
                type="button"
                onClick={clearApiError}
                className="shrink-0 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-7 sm:px-8 lg:px-10">
          {activeTab === "overview" && (
            <div className="space-y-9">
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
                <section className="lg:sticky lg:top-6">
                  <div className="aura-panel flex flex-col items-center gap-3 rounded-[2rem] px-5 py-7 text-center">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-aura-accent uppercase">
                        Aura · {TIER_META[mode].label}
                      </p>
                      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-aura-ink">
                        How are you feeling?
                      </h1>
                      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-aura-muted">
                        {TIER_META[mode].description}
                      </p>
                    </div>
                    <PushToTalkButton />
                  </div>
                </section>

                <ConversationOverlay />
              </div>

              <section>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-aura-accent uppercase">
                      Your health picture
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-aura-ink">
                      Insights, clearly separated
                    </h2>
                  </div>
                  <p className="hidden max-w-sm text-right text-xs text-aura-muted sm:block">
                    Supporting context stays below your conversation so the check-in
                    remains the focus.
                  </p>
                </div>

                <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
                  <MetricsChart />
                  <div className="flex flex-col gap-5">
                    {reasoning.length > 0 ? (
                      <ReasoningPanel />
                    ) : (
                      <EmptyInsight
                        title="Clinical reasoning"
                        text="Aura’s decision path will appear here after a symptom check-in."
                      />
                    )}
                    {currentExa ? (
                      <ExaInsightCard />
                    ) : (
                      <EmptyInsight
                        title="Trusted research"
                        text="When useful, Aura will surface a relevant source here—with your consent."
                      />
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "history" && <HistoryPanel />}

          {activeTab === "care" && <CarePanel />}
        </main>

        <ConsentGate />
        <EmergencyLock />
      </DashboardLayout>
    </AuthGate>
  );
}

function EmptyInsight({ title, text }: { title: string; text: string }) {
  return (
    <div className="aura-panel rounded-3xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-aura-accent-soft ring-4 ring-aura-accent-soft" />
        <div>
          <h3 className="text-sm font-semibold text-aura-ink">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-aura-muted">{text}</p>
        </div>
      </div>
    </div>
  );
}
