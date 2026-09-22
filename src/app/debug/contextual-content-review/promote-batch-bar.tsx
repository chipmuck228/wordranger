"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PromoteBatchBar({
  packId,
  expectedRevision,
  writeEnabled,
  ready,
  onPromote,
}: {
  packId: string;
  expectedRevision: number;
  writeEnabled: boolean;
  ready: boolean;
  onPromote(input: {
    packId: string;
    expectedRevision: number;
  }): Promise<{ ok: boolean; message?: string; code?: string }>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inflight = useRef(false);

  async function confirm() {
    if (inflight.current || busy || !ready) {
      return;
    }
    inflight.current = true;
    setBusy(true);
    const result = await onPromote({ packId, expectedRevision });
    inflight.current = false;
    setBusy(false);
    setMessage(
      result.ok
        ? "Batch promotion 已保存。不会立即发布到 Context Lab，不会进入 /train，也不产生 Evidence。"
        : result.message ?? "Promotion 失败",
    );
    if (result.ok) {
      setConfirming(false);
      router.refresh();
      return;
    }
    router.refresh();
  }

  if (!ready) {
    return null;
  }

  return (
    <section aria-label="Batch promotion" className="space-y-3">
      {!writeEnabled ? (
        <p className="text-muted-foreground text-sm">只读模式。Promotion 需要本地写入开关。</p>
      ) : null}
      <Button
        type="button"
        data-testid="promote-reviewed-batch"
        disabled={!writeEnabled || busy || confirming}
        onClick={() => setConfirming(true)}
      >
        Promote reviewed batch
      </Button>
      {confirming ? (
        <div
          role="dialog"
          aria-label="确认 batch promotion"
          className="bg-card space-y-3 rounded-2xl p-4 ring-1 ring-black/5"
        >
          <p className="text-sm">
            这是 Experimental Candidate promotion。不会立即发布到 Context Lab，不会进入 /train，
            不产生 Evidence。下一步仍需 Release Debug 中 preflight/publish。
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              data-testid="promote-confirm"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void confirm()}
            >
              {busy ? "保存中…" : "确认 promotion"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p data-testid="promote-save-message" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
