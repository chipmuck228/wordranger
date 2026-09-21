"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HumanContentReviewDecision } from "@/server/contextual-content-review/types";

export function ReviewDecisionBar({
  fingerprint,
  writeEnabled,
  onSubmit,
}: {
  fingerprint: string;
  writeEnabled: boolean;
  onSubmit(input: {
    expectedFingerprint: string;
    decision: Exclude<HumanContentReviewDecision, "PENDING">;
    notes: string[];
  }): Promise<{ ok: boolean; message?: string }>;
}) {
  const expectedRef = useRef<HTMLInputElement>(null);
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
    const expected = expectedRef.current?.value.trim() || fingerprint;
    const result = await onSubmit({
      expectedFingerprint: expected,
      decision: pending,
      notes: trimmed,
    });
    setBusy(false);
    setMessage(result.ok ? "已保存人工审核记录。Registry 仍为 CANDIDATE。" : result.message ?? "保存失败");
    if (result.ok) {
      setPending(null);
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
            fingerprint
            <input
              ref={expectedRef}
              readOnly={!writeEnabled}
              data-testid="review-expected-fingerprint"
              defaultValue={fingerprint}
              className="mt-2 block w-full break-all rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs"
              aria-label="确认 fingerprint"
            />
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
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              确认
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
