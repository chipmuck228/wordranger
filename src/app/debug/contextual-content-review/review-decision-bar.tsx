"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HumanContentReviewDecision } from "@/server/contextual-content-review/types";

export function ReviewDecisionBar({
  fingerprint,
  revision,
  writeEnabled,
  onSubmit,
}: {
  fingerprint: string;
  revision: number;
  writeEnabled: boolean;
  onSubmit(input: {
    fingerprint: string;
    revision: number;
    decision: Exclude<HumanContentReviewDecision, "PENDING">;
    notes: string[];
  }): Promise<{ ok: boolean; message?: string; code?: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Exclude<HumanContentReviewDecision, "PENDING"> | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!pending) {
      return;
    }
    const trimmed = notes
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    setBusy(true);
    const result = await onSubmit({
      fingerprint,
      revision,
      decision: pending,
      notes: trimmed,
    });
    setBusy(false);
    setMessage(
      result.ok
        ? "已保存人工审核记录。不会修改 registry 或 promotion。"
        : result.message ?? "保存失败",
    );
    if (result.ok) {
      setPending(null);
      router.refresh();
      return;
    }
    if (result.code === "CONTENT_REVIEW_CONFLICT" || result.code === "CONTENT_REVIEW_STALE") {
      router.refresh();
    }
  }

  return (
    <section aria-label="人工审核决定" className="space-y-3">
      {!writeEnabled ? (
        <p data-testid="review-readonly" className="text-muted-foreground text-sm">
          只读模式。写入需要本地 CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED=1。
        </p>
      ) : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        <Button
          type="button"
          disabled={!writeEnabled}
          onClick={() => setPending("APPROVED")}
        >
          通过审核
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!writeEnabled}
          onClick={() => setPending("REVISE")}
        >
          需要修改
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!writeEnabled}
          onClick={() => setPending("REJECTED")}
        >
          拒绝
        </Button>
      </div>
      {pending ? (
        <div
          role="dialog"
          aria-label="确认审核决定"
          className="bg-card space-y-3 rounded-2xl p-4 ring-1 ring-black/5"
        >
          <p className="text-sm leading-relaxed">
            你正在{pending === "APPROVED" ? "通过" : pending === "REVISE" ? "要求修改" : "拒绝"}
            fingerprint{" "}
            <code data-testid="review-confirm-fingerprint" className="break-all">
              {fingerprint}
            </code>{" "}
            对应的内容。
          </p>
          {pending === "APPROVED" ? (
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              <li>这不会修改 Candidate pack 状态</li>
              <li>不会自动进入 Context Lab</li>
              <li>不会接入 /train</li>
              <li>不会发布到生产</li>
              <li>后续仍需要独立 promotion commit</li>
            </ul>
          ) : (
            <label className="block text-sm">
              {pending === "REVISE" ? "Required revisions" : "拒绝理由"}
              <textarea
                required
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="border-border mt-2 min-h-24 w-full rounded-lg border px-3 py-2"
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              aria-busy={busy}
              data-testid="review-confirm"
              onClick={() => void confirm()}
            >
              {busy ? "保存中…" : "确认"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p data-testid="review-save-message" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
