"use client";

import { useEffect } from "react";
import { AuraHeader } from "@/components/AuraHeader";
import { ConversationOverlay } from "@/components/ConversationOverlay";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EmergencyLock } from "@/components/EmergencyLock";
import { ExaInsightCard } from "@/components/ExaInsightCard";
import { MetricsChart } from "@/components/MetricsChart";
import { PushToTalkButton } from "@/components/PushToTalkButton";
import { useAuraStore } from "@/store/aura.store";
import { TIER_META } from "@/lib/theme";

export default function Home() {
  const bootstrap = useAuraStore((s) => s.bootstrap);
  const mode = useAuraStore((s) => s.mode);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <DashboardLayout>
      <AuraHeader />

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: the orb + intent copy */}
        <section className="flex flex-col items-center justify-center gap-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-aura-ink sm:text-3xl">
              How are you feeling?
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-aura-muted">
              {TIER_META[mode].description}
            </p>
          </div>

          <PushToTalkButton />
        </section>

        {/* Right: conversation, insight, trend */}
        <section className="flex flex-col gap-6">
          <ConversationOverlay />
          <ExaInsightCard />
          <MetricsChart />
        </section>
      </main>

      <EmergencyLock />
    </DashboardLayout>
  );
}
