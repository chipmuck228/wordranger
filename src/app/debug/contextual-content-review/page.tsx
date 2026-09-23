import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { isContextualContentReviewEnabled } from "@/server/contextual-content-review/gates";
import { listContentReviewBatches } from "@/server/contextual-content-review/list-review-batches";
import { promoteReviewedBatch } from "./actions";
import { PromoteBatchBar } from "./promote-batch-bar";

export const dynamic = "force-dynamic";

export default async function ContextualContentReviewIndexPage() {
  requireDebugTools();
  if (!isContextualContentReviewEnabled()) {
    notFound();
  }
  const batches = await listContentReviewBatches();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 overflow-x-hidden px-4 py-10">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs">内部内容审核</p>
        <h1 className="text-2xl font-semibold">内容审核工具</h1>
        <p className="text-sm">
          只审核明确登记的 Candidate 内容。批量状态是各词审核决定的投影。通过审核不会发布或接入
          /train。
        </p>
      </header>
      {batches.map((batch) => (
        <section
          key={batch.batchId}
          data-testid={`review-batch-${batch.batchId}`}
          aria-labelledby={`review-batch-${batch.batchId}-title`}
          className="space-y-4"
        >
          <header className="space-y-2">
            <h2 id={`review-batch-${batch.batchId}-title`} className="text-xl font-semibold">
              {batch.title}
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">总词数</dt>
                <dd data-testid={`${batch.batchId}-total`}>{batch.totalAuthored}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">待审核</dt>
                <dd data-testid={`${batch.batchId}-pending`}>{batch.pending}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">APPROVED</dt>
                <dd data-testid={`${batch.batchId}-approved`}>{batch.approved}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">REJECTED</dt>
                <dd data-testid={`${batch.batchId}-rejected`}>{batch.rejected}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">STALE</dt>
                <dd data-testid={`${batch.batchId}-stale`}>{batch.stale}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">BLOCKED</dt>
                <dd data-testid={`${batch.batchId}-blocked`}>{batch.blocked}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-sm">
              Registry: {batch.registryStatus} · Eligibility: {batch.releaseEligibility}
            </p>
            <p className="text-muted-foreground break-all text-xs">
              Pack fingerprint: {batch.packFingerprint ?? "—"}
            </p>
            <p className="text-muted-foreground text-xs">Parent: {batch.parentPackId ?? "—"}</p>
            {batch.promotionEnabled ? (
              <>
                <p className="text-muted-foreground text-xs">
                  Lineage: {batch.lineageOk ? "PASS" : "FAIL"} · Promotion: {batch.promotionStatus} ·
                  Revision: {batch.promotionRevision} · Effective eligibility:{" "}
                  {batch.effectiveReleaseEligibility}
                </p>
                {batch.promotionConfigError ? (
                  <p data-testid="promotion-config-error" className="text-sm">
                    {batch.promotionConfigError.code}: {batch.promotionConfigError.message}
                  </p>
                ) : null}
                {batch.promotedAt ? (
                  <p className="text-muted-foreground text-xs">
                    Promoted at {batch.promotedAt} by {batch.promotedBy}
                  </p>
                ) : null}
                {batch.reviewCompleteUnpromoted ? (
                  <p data-testid={`${batch.batchId}-unpromoted`} className="text-sm">
                    Batch 03 is review-complete but remains unpromoted.
                  </p>
                ) : null}
                {batch.registryStatus === "CANDIDATE" && batch.promotionReady ? (
                  <PromoteBatchBar
                    packId={batch.packId}
                    expectedRevision={batch.expectedPromotionRevision}
                    writeEnabled={batch.promotionWriteEnabled}
                    ready={batch.promotionReady}
                    onPromote={promoteReviewedBatch}
                  />
                ) : null}
                {batch.registryStatus === "CANDIDATE" && !batch.promotionReady ? (
                  <div data-testid={`${batch.batchId}-promotion-blocked`} className="space-y-1 text-sm">
                    {batch.promotionIssues.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </header>
          <ul className="space-y-3">
            {batch.targets.map((item) => (
              <li key={item.reviewKey}>
                <Link
                  href={item.href}
                  data-testid={`review-card-${item.reviewKey}`}
                  className="bg-card block rounded-2xl px-4 py-4 shadow-sm ring-1 ring-black/5"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-sm">Target: {item.targetLabel}</p>
                  <p className="text-sm">Status: {item.statusLabel}</p>
                  <p className="text-muted-foreground text-sm">
                    Frames: {item.frameLabels.join("、")}
                  </p>
                  <p className="text-xs">Registry: {item.registryStatus}</p>
                  <p className="text-muted-foreground break-all text-xs">
                    Identity: {item.lemma} · {item.lexemeId}
                  </p>
                  <p className="text-muted-foreground text-xs">Sense: {item.senseId}</p>
                  <p className="text-muted-foreground text-xs">
                    Meaning: {item.meaningGloss}
                    {item.phonetic ? ` · IPA ${item.phonetic}` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">Scene: {item.sceneMembership}</p>
                  {item.probeSummary ? (
                    <p className="text-muted-foreground text-xs">Probe: {item.probeSummary}</p>
                  ) : null}
                  {item.buildSummaries.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      BUILD: {item.buildSummaries.map((summary) => summary.split(":")[0]).join(" / ")}
                    </p>
                  ) : null}
                  {item.strengthenSummary ? (
                    <p className="text-muted-foreground text-xs">STRENGTHEN: present</p>
                  ) : null}
                  {item.contrastSummary ? (
                    <p className="text-muted-foreground text-xs">Contrast: {item.contrastSummary}</p>
                  ) : null}
                  <p className="text-muted-foreground break-all text-xs">
                    Fingerprint: {item.contentFingerprint}
                  </p>
                  <p className="text-muted-foreground text-xs">Revision: {item.reviewRevision}</p>
                  {item.validationIssues.length > 0 ? (
                    <p className="text-xs">Issues: {item.validationIssues.join(" · ")}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">Validation: no blocking issues</p>
                  )}
                </Link>
              </li>
            ))}
            {batch.blockedCandidates.map((item) => (
              <li
                key={`${item.batchId}-${item.plannedLemma}`}
                data-testid={`review-blocked-${item.plannedLemma}`}
                className="rounded-2xl px-4 py-4 ring-1 ring-black/10"
              >
                <p className="font-medium">BLOCKED · {item.plannedLemma}</p>
                <p className="text-sm">{item.reason}</p>
                <p className="text-muted-foreground text-xs">Status: BLOCKED</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
