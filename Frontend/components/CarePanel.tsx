"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApiError, deleteUserData, exportUserData } from "@/lib/api";
import { useAuraStore } from "@/store/aura.store";

/**
 * Care & privacy module: talk to a human, export/delete data, manage sharing.
 */
export function CarePanel() {
  const router = useRouter();
  const userId = useAuraStore((s) => s.userId);
  const user = useAuraStore((s) => s.user);
  const consents = useAuraStore((s) => s.consents);
  const grantConsents = useAuraStore((s) => s.grantConsents);
  const denyConsents = useAuraStore((s) => s.denyConsents);
  const handoff = useAuraStore((s) => s.handoff);
  const handoffBusy = useAuraStore((s) => s.handoffBusy);
  const requestHandoff = useAuraStore((s) => s.requestHandoff);
  const logout = useAuraStore((s) => s.logout);
  const clearHealthDataLocally = useAuraStore((s) => s.clearHealthDataLocally);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onHandoff = async () => {
    setStatus(null);
    const ok = await requestHandoff(note.trim() || undefined);
    if (ok) {
      setStatus("Handoff requested — a care coordinator will follow up.");
      setNote("");
    }
  };

  const onExport = async () => {
    if (!userId) return;
    setBusy("export");
    setStatus(null);
    try {
      const data = await exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Your data was exported.");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDeleteData = async () => {
    if (!userId) return;
    setBusy("delete");
    setStatus(null);
    try {
      await deleteUserData(userId);
      clearHealthDataLocally();
      setStatus("Your health data was deleted.");
      setConfirmDelete(false);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  };

  const onLogout = async () => {
    setBusy("logout");
    await logout();
    router.replace("/login");
  };

  const toggleSharing = async () => {
    if (consents.third_party_sharing === true) {
      await denyConsents(["third_party_sharing"]);
    } else {
      await grantConsents(["third_party_sharing"]);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="aura-panel aura-transition rounded-3xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-aura-ink">Talk to a human</h2>
        <p className="mt-1 text-sm text-aura-muted">
          Skip AI and request a care coordinator. We&apos;ll also surface your emergency
          contact.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Optional context for the care team…"
          className="aura-panel mt-3 w-full resize-none rounded-2xl border border-[var(--aura-panel-border)] bg-white/70 px-4 py-3 text-sm text-aura-ink outline-none focus:ring-2 focus:ring-aura-accent/35"
        />
        <button
          type="button"
          onClick={() => void onHandoff()}
          disabled={handoffBusy}
          className="mt-3 rounded-full bg-aura-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {handoffBusy ? "Requesting…" : "Request human handoff"}
        </button>
        {handoff && (
          <div className="mt-4 rounded-2xl bg-aura-accent-soft/60 p-3 text-sm text-aura-ink">
            <p className="font-medium">{handoff.message}</p>
            <p className="mt-1 text-xs text-aura-muted">
              Status: {handoff.status} · {new Date(handoff.createdAt).toLocaleString()}
            </p>
            {handoff.emergencyContact?.phone && (
              <a
                href={`tel:${handoff.emergencyContact.phone}`}
                className="mt-2 inline-flex text-sm font-semibold text-aura-accent hover:underline"
              >
                Call {handoff.emergencyContact.name ?? "emergency contact"} ·{" "}
                {handoff.emergencyContact.phone}
              </a>
            )}
          </div>
        )}
      </section>

      <section className="aura-panel aura-transition rounded-3xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-aura-ink">Research sharing</h2>
        <p className="mt-1 text-sm text-aura-muted">
          Allow Aura to show third-party research insights (Exa) relevant to your
          symptoms.
        </p>
        <button
          type="button"
          onClick={() => void toggleSharing()}
          className={[
            "mt-3 rounded-full px-4 py-2 text-sm font-semibold transition",
            consents.third_party_sharing === true
              ? "bg-aura-accent text-white"
              : "bg-aura-accent-soft text-aura-ink",
          ].join(" ")}
        >
          {consents.third_party_sharing === true
            ? "Third-party insights on"
            : "Enable third-party insights"}
        </button>
      </section>

      <section className="aura-panel aura-transition rounded-3xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-aura-ink">Privacy & account</h2>
        {user?.email && (
          <p className="mt-1 truncate text-sm text-aura-muted">{user.email}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionBtn onClick={onExport} busy={busy === "export"} label="Export my data" />
          <ActionBtn
            onClick={() => setConfirmDelete(true)}
            busy={busy === "delete"}
            label="Delete health data"
            danger
          />
          <ActionBtn onClick={onLogout} busy={busy === "logout"} label="Log out" />
        </div>
        {status && <p className="mt-3 text-xs text-aura-muted">{status}</p>}
      </section>

      <ConfirmModal
        open={confirmDelete}
        danger
        title="Delete health data?"
        description="This permanently removes your health logs, insights, feedback, and handoff requests. Your account stays active. This cannot be undone."
        confirmLabel="Delete data"
        cancelLabel="Keep my data"
        busy={busy === "delete"}
        onCancel={() => {
          if (busy !== "delete") setConfirmDelete(false);
        }}
        onConfirm={() => void confirmDeleteData()}
      />
    </div>
  );
}

function ActionBtn({
  onClick,
  label,
  busy,
  danger,
}: {
  onClick: () => void;
  label: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        danger
          ? "bg-red-50 text-red-700 hover:bg-red-100"
          : "bg-aura-accent-soft text-aura-ink hover:opacity-90",
      ].join(" ")}
    >
      {busy ? "…" : label}
    </button>
  );
}
