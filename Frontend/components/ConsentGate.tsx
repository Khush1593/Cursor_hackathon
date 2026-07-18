"use client";

import { useEffect, useState } from "react";
import { useAuraStore } from "@/store/aura.store";

/**
 * Server-backed consent gate. Triage stays locked until required consents
 * are granted via GET/POST /api/consent. Decline does NOT unlock the UI.
 */
export function ConsentGate() {
  const consents = useAuraStore((s) => s.consents);
  const consentsLoaded = useAuraStore((s) => s.consentsLoaded);
  const loadConsents = useAuraStore((s) => s.loadConsents);
  const grantConsents = useAuraStore((s) => s.grantConsents);
  const denyConsents = useAuraStore((s) => s.denyConsents);
  const [busy, setBusy] = useState(false);
  const [deniedHint, setDeniedHint] = useState(false);

  useEffect(() => {
    if (!consentsLoaded) void loadConsents();
  }, [consentsLoaded, loadConsents]);

  const needsCore =
    consents.data_collection !== true || consents.voice_recording !== true;

  if (!consentsLoaded || !needsCore) return null;

  const accept = async () => {
    setBusy(true);
    setDeniedHint(false);
    await grantConsents(["data_collection", "voice_recording"]);
    setBusy(false);
  };

  const decline = async () => {
    setBusy(true);
    await denyConsents(["data_collection", "voice_recording"]);
    setDeniedHint(true);
    setBusy(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="aura-panel aura-transition flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-aura-ink">Privacy before care</p>
          <p className="mt-1 text-sm text-aura-muted">
            Aura needs your OK to store health logs and voice transcripts so it can track
            trends and keep you safe. You can export or delete this data anytime.
          </p>
          {deniedHint && (
            <p className="mt-2 text-xs font-medium text-red-600">
              Without consent, triage stays locked. You can still browse your account.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-medium text-aura-muted transition hover:bg-aura-accent-soft disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="rounded-full bg-aura-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            I agree
          </button>
        </div>
      </div>
    </div>
  );
}
