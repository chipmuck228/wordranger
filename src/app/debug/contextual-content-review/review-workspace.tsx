"use client";

import { useMemo, useState } from "react";
import type { ContentReviewPacket } from "@/server/contextual-content-review/types";
import { ReviewDecisionBar } from "./review-decision-bar";
import { ReviewSceneDiagram } from "./review-scene-diagram";
import { ReviewStepPanel } from "./review-step-panel";

export function ReviewWorkspace({
  packet,
  onSubmit,
}: {
  packet: ContentReviewPacket;
  onSubmit(input: {
    fingerprint: string;
    revision: number;
    decision: "APPROVED" | "REVISE" | "REJECTED";
    notes: string[];
  }): Promise<{ ok: boolean; message?: string; code?: string }>;
}) {
  const [frameId, setFrameId] = useState(packet.frames[0]?.frameId ?? "");
  const frame = useMemo(
    () => packet.frames.find((item) => item.frameId === frameId) ?? packet.frames[0],
    [frameId, packet.frames],
  );
  if (!frame) {
    return <p>没有可审核的场景。</p>;
  }
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 overflow-x-hidden px-4 py-8">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs">内部内容审核</p>
        <h1 className="text-2xl font-semibold">Candidate / 尚未进入实验</h1>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Pack ID</dt>
            <dd data-testid="review-pack-id">{packet.pack.packId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Target</dt>
            <dd data-testid="review-target-sense">{packet.target.senseId}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-muted-foreground">content fingerprint</dt>
            <dd data-testid="review-fingerprint" className="break-all">
              {packet.pack.contentFingerprint}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">人工审核状态</dt>
            <dd data-testid="review-human-status">{packet.reviewStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Registry status</dt>
            <dd data-testid="review-registry-status">{packet.pack.registryStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">内容状态</dt>
            <dd data-testid="review-stale-state">{packet.staleState}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">review revision</dt>
            <dd data-testid="review-revision">{packet.reviewRevision}</dd>
          </div>
        </dl>
        <p className="text-sm">机器验证通过不等于人工批准</p>
        <div role="tablist" aria-label="场景切换" className="flex flex-wrap gap-2">
          {packet.frames.map((item) => (
            <button
              key={item.frameId}
              type="button"
              role="tab"
              aria-selected={item.frameId === frame.frameId}
              className="border-border h-10 rounded-lg border px-3 text-sm"
              onClick={() => setFrameId(item.frameId)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </header>
      <ReviewSceneDiagram
        frame={frame}
        hideTargetForm
      />
      <ol className="flex flex-col gap-4">
        {frame.steps.map((step) => (
          <li key={step.id}>
            <ReviewStepPanel
              step={step}
              hideTargetForm={
                step.stage === "PROBE_ACTIVE_RECALL" ||
                step.stage === "BUILD_FADE" ||
                step.stage === "BUILD_VERIFY" ||
                step.stage === "STRENGTHEN_FADE" ||
                step.stage === "STRENGTHEN_VERIFY"
              }
              targetForm={packet.target.displayForm}
            />
          </li>
        ))}
      </ol>
      <ReviewDecisionBar
        fingerprint={packet.pack.contentFingerprint}
        revision={packet.reviewRevision}
        writeEnabled={packet.writeEnabled}
        onSubmit={onSubmit}
      />
    </div>
  );
}
