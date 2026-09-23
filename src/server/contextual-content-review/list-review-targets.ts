import { registryStatusFor } from "@/contextual-learning/candidate-v0/content";
import { fileContentReviewRepository } from "./file-content-review-repository";
import { currentContentFingerprint, projectContentReviewPacket } from "./project-review-packet";
import { CONTENT_REVIEW_TARGETS, reviewHref } from "./review-target-registry";
import type { ContentReviewListItem } from "./types";

function stepSummary(
  packet: NonNullable<ReturnType<typeof projectContentReviewPacket>>,
  stagePrefix: string,
): string[] {
  const first = packet.frames[0];
  if (!first) {
    return [];
  }
  return first.steps
    .filter((step) => step.stage.startsWith(stagePrefix))
    .map((step) => `${step.title}: ${step.student.instruction}`);
}

export async function listContentReviewTargets(): Promise<ContentReviewListItem[]> {
  const items: ContentReviewListItem[] = [];
  for (const spec of CONTENT_REVIEW_TARGETS) {
    const record = await fileContentReviewRepository.get(spec.reviewKey);
    const fingerprint = currentContentFingerprint(spec) ?? "";
    const packet = projectContentReviewPacket({ spec, record, writeEnabled: false });
    const stale = Boolean(record && fingerprint && record.contentFingerprint !== fingerprint);
    const probe = packet
      ? stepSummary(packet, "PROBE")[0] ??
        packet.frames[0]?.steps.find((step) => step.purpose === "PROBE")?.student.instruction ??
        ""
      : "";
    items.push({
      reviewKey: spec.reviewKey,
      href: reviewHref(spec),
      title: spec.title,
      targetLabel: spec.target.senseId,
      statusLabel: stale
        ? "STALE_REVIEW"
        : record
          ? record.decision
          : "PENDING",
      frameLabels: [...spec.frameLabels],
      registryStatus: registryStatusFor(spec.packId) ?? "DRAFT",
      batchId: spec.batchId,
      lexemeId: packet?.target.lexemeId ?? spec.target.lexemeId,
      senseId: packet?.target.senseId ?? spec.target.senseId,
      lemma: packet?.target.lemma ?? spec.targetSlug,
      meaningGloss: packet?.target.meaningGloss ?? "",
      phonetic: packet?.target.phonetic,
      roleId: packet?.target.roleId ?? "",
      sceneMembership: `${spec.frameLabels.join(" / ")} · ${packet?.target.roleId ?? ""}`,
      probeSummary: probe,
      buildSummaries: packet ? stepSummary(packet, "BUILD_") : [],
      strengthenSummary: packet ? stepSummary(packet, "STRENGTHEN_").join(" | ") : "",
      contrastSummary: packet?.frames[0]?.contrast
        ? `${packet.frames[0].contrast.contrastDisplayLabel}: ${packet.frames[0].contrast.instruction}`
        : "",
      provenance: [...spec.sourceRefs],
      validationIssues:
        packet?.machineChecks.filter((check) => !check.ok).map((check) => `${check.id}: ${check.detail}`) ?? [],
      contentFingerprint: fingerprint,
      reviewRevision: packet?.reviewRevision ?? record?.revision ?? 0,
    });
  }
  return items;
}
