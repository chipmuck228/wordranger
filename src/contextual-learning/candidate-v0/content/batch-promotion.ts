/**
 * Generic fingerprint-bound batch promotion. Candidate V0 / Experimental.
 * Not Standard. Not /train. Does not write Evidence or mutate authored packs.
 */

import { createHash } from "node:crypto";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextFrame, SemanticSkeleton } from "../domain/types";
import type { SceneVocabularyCluster } from "../memory-routing/types";
import { fingerprintAuthoredPack, fingerprintContent } from "./content-fingerprint";
import { currentPackTargetFingerprint } from "./validate-experiment-promotion";
import { validateSceneContent } from "./validate-scene-content";
import type {
  ContextualSceneContentPack,
  ContextualSceneContentRegistryEntry,
  SceneLexemeLoader,
} from "./types";
import { SCENE_CONTENT_SCHEMA_VERSION } from "./types";

export const CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND =
  "CONTEXTUAL_CONTENT_BATCH_PROMOTION" as const;

export const BATCH_PROMOTION_SCHEMA_VERSION = "candidate-v0" as const;

export interface BatchPromotionTargetBinding {
  reviewKey: string;
  target: LexemeSenseRef;
  reviewRevision: number;
  reviewDecision: "APPROVED";
  reviewedContentFingerprint: string;
  packTargetFingerprint: string;
  approvalPackId: string;
  sourceRefs: readonly string[];
}

export interface ContextualContentBatchPromotionRecord {
  schemaVersion: typeof SCENE_CONTENT_SCHEMA_VERSION;
  kind: typeof CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND;
  sceneId: string;
  packId: string;
  parentPackId: string | null;
  packFingerprint: string;
  lineageFingerprint: string;
  targetApprovalBindings: BatchPromotionTargetBinding[];
  decision: "PROMOTED";
  revision: number;
  promotedAt: string;
  promotedBy: string;
}

export type BatchPromotionIssueCode =
  | "PROMOTION_PACK_MISSING"
  | "PROMOTION_STATUS_INVALID"
  | "PROMOTION_ELIGIBILITY_INVALID"
  | "PROMOTION_PARENT_MISSING"
  | "PROMOTION_LINEAGE_INVALID"
  | "PROMOTION_LINEAGE_CYCLE"
  | "PROMOTION_PACK_INVALID"
  | "PROMOTION_TARGET_DUPLICATE"
  | "PROMOTION_REVIEW_MISSING"
  | "PROMOTION_REVIEW_PENDING"
  | "PROMOTION_REVIEW_REJECTED"
  | "PROMOTION_REVIEW_STALE"
  | "PROMOTION_REVIEW_MISMATCH"
  | "PROMOTION_REVIEW_DUPLICATE"
  | "PROMOTION_INHERITED_DRIFT"
  | "PROMOTION_REMOVAL_UNSUPPORTED"
  | "PROMOTION_BINDING_EXTRA"
  | "PROMOTION_BINDING_MISSING"
  | "PROMOTION_FINGERPRINT_MISMATCH"
  | "PROMOTION_RECORD_INVALID"
  | "PROMOTION_CONFLICT";

export interface BatchPromotionIssue {
  code: BatchPromotionIssueCode;
  path: string;
  detail: string;
}

export interface BatchPromotionReviewRecord {
  reviewKey: string;
  packId: string;
  target: LexemeSenseRef;
  contentFingerprint: string;
  decision: string;
  revision: number;
}

export interface BatchPromotionReviewTarget {
  reviewKey: string;
  packId: string;
  target: LexemeSenseRef;
  sourceRefs: readonly string[];
}

export interface BatchPromotionReadiness {
  ok: boolean;
  issues: BatchPromotionIssue[];
  packFingerprint: string | null;
  lineageFingerprint: string | null;
  bindings: BatchPromotionTargetBinding[];
}

function issue(
  code: BatchPromotionIssueCode,
  path: string,
  detail: string,
): BatchPromotionIssue {
  return { code, path, detail };
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function targetKey(target: LexemeSenseRef): string {
  return `${target.lexemeId}::${target.senseId}`;
}

export function compareTargets(left: LexemeSenseRef, right: LexemeSenseRef): number {
  return targetKey(left).localeCompare(targetKey(right));
}

export function newTargetsAgainstParent(
  pack: ContextualSceneContentPack,
  parent: ContextualSceneContentPack | null,
): ContextualSceneContentPack["lexemes"] {
  if (!parent) {
    return [...pack.lexemes];
  }
  return pack.lexemes.filter(
    (lexeme) => !parent.lexemes.some((item) => sameLexemeSense(item.target, lexeme.target)),
  );
}

export function lineageFingerprintFor(input: {
  parentPackId: string | null;
  parent: ContextualSceneContentPack | null;
}): string {
  const inherited =
    input.parent?.lexemes
      .map((lexeme) => ({
        target: lexeme.target,
        fingerprint: fingerprintContent({
          packId: input.parent!.id,
          lexeme,
          sourceRefs: input.parent!.provenance.sourceRefs,
        }),
      }))
      .sort((left, right) => compareTargets(left.target, right.target)) ?? [];
  return sha256({
    parentPackId: input.parentPackId,
    inherited,
  });
}

export function fingerprintBatchPromotionRecord(
  record: Pick<
    ContextualContentBatchPromotionRecord,
    | "schemaVersion"
    | "kind"
    | "sceneId"
    | "packId"
    | "parentPackId"
    | "packFingerprint"
    | "lineageFingerprint"
    | "targetApprovalBindings"
    | "decision"
  >,
): string {
  return sha256({
    schemaVersion: record.schemaVersion,
    kind: record.kind,
    sceneId: record.sceneId,
    packId: record.packId,
    parentPackId: record.parentPackId,
    packFingerprint: record.packFingerprint,
    lineageFingerprint: record.lineageFingerprint,
    targetApprovalBindings: [...record.targetApprovalBindings].sort((left, right) =>
      compareTargets(left.target, right.target),
    ),
    decision: record.decision,
  });
}

export function parseBatchPromotionRecord(
  value: unknown,
): ContextualContentBatchPromotionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<ContextualContentBatchPromotionRecord>;
  if (
    record.schemaVersion !== BATCH_PROMOTION_SCHEMA_VERSION ||
    record.kind !== CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND ||
    record.decision !== "PROMOTED" ||
    typeof record.sceneId !== "string" ||
    typeof record.packId !== "string" ||
    typeof record.packFingerprint !== "string" ||
    typeof record.lineageFingerprint !== "string" ||
    typeof record.promotedAt !== "string" ||
    typeof record.promotedBy !== "string" ||
    !Number.isInteger(record.revision) ||
    (record.revision ?? 0) < 1 ||
    !Array.isArray(record.targetApprovalBindings)
  ) {
    return null;
  }
  const revision = record.revision as number;
  if (record.parentPackId !== null && typeof record.parentPackId !== "string") {
    return null;
  }
  const forbidden = ["answerKey", "LearningEvidence", "StudentLexemeModel", "score", "mastery"];
  const raw = value as Record<string, unknown>;
  if (forbidden.some((key) => key in raw)) {
    return null;
  }
  const bindings: BatchPromotionTargetBinding[] = [];
  for (const item of record.targetApprovalBindings) {
    if (
      !item ||
      typeof item.reviewKey !== "string" ||
      typeof item.reviewRevision !== "number" ||
      item.reviewDecision !== "APPROVED" ||
      typeof item.reviewedContentFingerprint !== "string" ||
      typeof item.packTargetFingerprint !== "string" ||
      typeof item.approvalPackId !== "string" ||
      !item.target?.lexemeId ||
      !item.target.senseId ||
      !Array.isArray(item.sourceRefs)
    ) {
      return null;
    }
    bindings.push({
      reviewKey: item.reviewKey,
      target: { lexemeId: item.target.lexemeId, senseId: item.target.senseId },
      reviewRevision: item.reviewRevision,
      reviewDecision: "APPROVED",
      reviewedContentFingerprint: item.reviewedContentFingerprint,
      packTargetFingerprint: item.packTargetFingerprint,
      approvalPackId: item.approvalPackId,
      sourceRefs: [...item.sourceRefs],
    });
  }
  const sorted = [...bindings].sort((left, right) => compareTargets(left.target, right.target));
  return {
    schemaVersion: BATCH_PROMOTION_SCHEMA_VERSION,
    kind: CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND,
    sceneId: record.sceneId,
    packId: record.packId,
    parentPackId: record.parentPackId ?? null,
    packFingerprint: record.packFingerprint,
    lineageFingerprint: record.lineageFingerprint,
    targetApprovalBindings: sorted,
    decision: "PROMOTED",
    revision,
    promotedAt: record.promotedAt,
    promotedBy: record.promotedBy,
  };
}

function uniqueReviewSpec(
  reviewTargets: readonly BatchPromotionReviewTarget[],
  packId: string,
  target: LexemeSenseRef,
): BatchPromotionReviewTarget | null {
  const matches = reviewTargets.filter(
    (item) => item.packId === packId && sameLexemeSense(item.target, target),
  );
  return matches.length === 1 ? matches[0]! : null;
}

function walkLineage(
  registry: readonly ContextualSceneContentRegistryEntry[],
  start: string | null,
): BatchPromotionIssue[] {
  const issues: BatchPromotionIssue[] = [];
  const walked = new Set<string>();
  let cursor = start;
  while (cursor) {
    if (walked.has(cursor)) {
      issues.push(issue("PROMOTION_LINEAGE_CYCLE", "parentPackId", "Pack lineage contains a cycle."));
      break;
    }
    walked.add(cursor);
    const matches = registry.filter((entry) => entry.packId === cursor);
    if (matches.length !== 1) {
      issues.push(issue("PROMOTION_LINEAGE_INVALID", cursor, "Lineage parent is missing or ambiguous."));
      break;
    }
    cursor = matches[0]!.parentPackId ?? null;
  }
  return issues;
}

export function evaluateBatchPromotionReadiness(input: {
  pack: ContextualSceneContentPack | null;
  registryEntry: ContextualSceneContentRegistryEntry | null;
  reviewTargets: readonly BatchPromotionReviewTarget[];
  reviewRecords: readonly BatchPromotionReviewRecord[];
  parentPack: ContextualSceneContentPack | null;
  registry: readonly ContextualSceneContentRegistryEntry[];
  frames: readonly ContextFrame[];
  skeleton: SemanticSkeleton;
  cluster: SceneVocabularyCluster;
  loadLexeme: SceneLexemeLoader;
  blockedPlannedLemmas?: readonly string[];
}): BatchPromotionReadiness {
  const issues: BatchPromotionIssue[] = [];
  const pack = input.pack;
  const entry = input.registryEntry;
  if (!pack || !entry || entry.packId !== pack.id) {
    return {
      ok: false,
      issues: [issue("PROMOTION_PACK_MISSING", "packId", "Candidate pack is missing from the authored registry.")],
      packFingerprint: null,
      lineageFingerprint: null,
      bindings: [],
    };
  }
  if (entry.status !== "CANDIDATE" || pack.provenance.status !== "CANDIDATE") {
    issues.push(issue("PROMOTION_STATUS_INVALID", "status", "Only CANDIDATE packs can be batch-promoted."));
  }
  if ((entry.releaseEligibility ?? "NONE") !== "NONE") {
    issues.push(
      issue("PROMOTION_ELIGIBILITY_INVALID", "releaseEligibility", "Authored eligibility must stay NONE until projection."),
    );
  }
  if (!entry.parentPackId || !input.parentPack || input.parentPack.id !== entry.parentPackId) {
    issues.push(issue("PROMOTION_PARENT_MISSING", "parentPackId", "Parent pack cannot be resolved."));
  }
  issues.push(...walkLineage(input.registry, entry.parentPackId ?? null));

  const seenTargets = new Set<string>();
  const seenOrders = new Map<string, Set<number>>();
  for (const lexeme of pack.lexemes) {
    const key = targetKey(lexeme.target);
    if (seenTargets.has(key)) {
      issues.push(issue("PROMOTION_TARGET_DUPLICATE", key, "Pack contains a duplicate LexemeSenseRef."));
    }
    seenTargets.add(key);
    for (const binding of lexeme.membership.frameBindings) {
      const orders = seenOrders.get(binding.frameId) ?? new Set<number>();
      if (orders.has(binding.sceneOrder)) {
        issues.push(
          issue("PROMOTION_TARGET_DUPLICATE", `${binding.frameId}.${binding.sceneOrder}`, "Scene order is not unique."),
        );
      }
      orders.add(binding.sceneOrder);
      seenOrders.set(binding.frameId, orders);
    }
  }

  const validated = validateSceneContent({
    pack,
    frame: input.frames[0]!,
    frames: input.frames,
    skeleton: input.skeleton,
    cluster: input.cluster,
    loadLexeme: input.loadLexeme,
  });
  if (!validated.ok) {
    issues.push(issue("PROMOTION_PACK_INVALID", "pack", "Scene Content validators rejected the Candidate pack."));
  }

  const parent = input.parentPack;
  if (parent) {
    for (const parentLexeme of parent.lexemes) {
      const child = pack.lexemes.find((item) => sameLexemeSense(item.target, parentLexeme.target));
      if (!child) {
        issues.push(
          issue(
            "PROMOTION_REMOVAL_UNSUPPORTED",
            targetKey(parentLexeme.target),
            "Silent inherited target removal is not supported.",
          ),
        );
        continue;
      }
      const parentPrint = fingerprintContent({
        packId: parent.id,
        lexeme: parentLexeme,
        sourceRefs: parent.provenance.sourceRefs,
      });
      const childPrint = fingerprintContent({
        packId: parent.id,
        lexeme: child,
        sourceRefs: parent.provenance.sourceRefs,
      });
      if (parentPrint !== childPrint) {
        issues.push(
          issue(
            "PROMOTION_INHERITED_DRIFT",
            targetKey(child.target),
            "Inherited target content changed without a new human review.",
          ),
        );
      }
    }
  }

  const added = newTargetsAgainstParent(pack, parent);
  const reviewKeys = new Set<string>();
  const bindings: BatchPromotionTargetBinding[] = [];
  for (const lexeme of added) {
    const spec = uniqueReviewSpec(input.reviewTargets, pack.id, lexeme.target);
    if (!spec) {
      const duplicates = input.reviewTargets.filter(
        (item) => item.packId === pack.id && sameLexemeSense(item.target, lexeme.target),
      );
      issues.push(
        issue(
          duplicates.length > 1 ? "PROMOTION_REVIEW_DUPLICATE" : "PROMOTION_REVIEW_MISSING",
          targetKey(lexeme.target),
          duplicates.length > 1
            ? "New target matches more than one review registration."
            : "New target has no unique review registration.",
        ),
      );
      continue;
    }
    if (reviewKeys.has(spec.reviewKey)) {
      issues.push(issue("PROMOTION_REVIEW_DUPLICATE", spec.reviewKey, "Review key is duplicated for this pack."));
      continue;
    }
    reviewKeys.add(spec.reviewKey);
    const records = input.reviewRecords.filter((item) => item.reviewKey === spec.reviewKey);
    if (records.length !== 1) {
      issues.push(
        issue(
          records.length === 0 ? "PROMOTION_REVIEW_PENDING" : "PROMOTION_REVIEW_DUPLICATE",
          spec.reviewKey,
          records.length === 0 ? "Required review record is missing." : "Duplicate review records exist.",
        ),
      );
      continue;
    }
    const record = records[0]!;
    const current = currentPackTargetFingerprint(pack, lexeme.target);
    if (!current) {
      issues.push(issue("PROMOTION_FINGERPRINT_MISMATCH", spec.reviewKey, "Pack target fingerprint cannot be recomputed."));
      continue;
    }
    if (record.decision === "REJECTED") {
      issues.push(issue("PROMOTION_REVIEW_REJECTED", spec.reviewKey, "REJECTED targets cannot be promoted."));
      continue;
    }
    if (record.decision === "REVISE" || record.decision === "PENDING") {
      issues.push(issue("PROMOTION_REVIEW_PENDING", spec.reviewKey, "Target review is not APPROVED."));
      continue;
    }
    if (record.decision !== "APPROVED") {
      issues.push(issue("PROMOTION_REVIEW_PENDING", spec.reviewKey, "Target review is not APPROVED."));
      continue;
    }
    if (
      record.packId !== pack.id ||
      !sameLexemeSense(record.target, lexeme.target) ||
      !sameLexemeSense(record.target, spec.target) ||
      !Number.isInteger(record.revision) ||
      record.revision < 1
    ) {
      issues.push(issue("PROMOTION_REVIEW_MISMATCH", spec.reviewKey, "Review record identity does not match the pack target."));
      continue;
    }
    if (record.contentFingerprint !== current) {
      issues.push(issue("PROMOTION_REVIEW_STALE", spec.reviewKey, "Approved review fingerprint does not match current content."));
      continue;
    }
    bindings.push({
      reviewKey: spec.reviewKey,
      target: lexeme.target,
      reviewRevision: record.revision,
      reviewDecision: "APPROVED",
      reviewedContentFingerprint: record.contentFingerprint,
      packTargetFingerprint: current,
      approvalPackId: pack.id,
      sourceRefs: [...spec.sourceRefs],
    });
  }

  const extraSpecs = input.reviewTargets.filter((item) => item.packId === pack.id);
  for (const spec of extraSpecs) {
    if (added.some((lexeme) => sameLexemeSense(lexeme.target, spec.target))) {
      continue;
    }
    issues.push(
      issue("PROMOTION_BINDING_EXTRA", spec.reviewKey, "Review registration does not match a new pack target."),
    );
  }

  const packFingerprint = fingerprintAuthoredPack(pack);
  const lineageFingerprint = lineageFingerprintFor({
    parentPackId: entry.parentPackId ?? null,
    parent,
  });
  const sortedBindings = [...bindings].sort((left, right) => compareTargets(left.target, right.target));
  void input.blockedPlannedLemmas;
  return {
    ok: issues.length === 0 && sortedBindings.length === added.length,
    issues,
    packFingerprint,
    lineageFingerprint,
    bindings: sortedBindings,
  };
}

export function promotionRecordIsCurrent(input: {
  record: ContextualContentBatchPromotionRecord;
  readiness: BatchPromotionReadiness;
}): boolean {
  if (!input.readiness.ok || !input.readiness.packFingerprint || !input.readiness.lineageFingerprint) {
    return false;
  }
  if (
    input.record.packFingerprint !== input.readiness.packFingerprint ||
    input.record.lineageFingerprint !== input.readiness.lineageFingerprint
  ) {
    return false;
  }
  if (input.record.targetApprovalBindings.length !== input.readiness.bindings.length) {
    return false;
  }
  return input.readiness.bindings.every((binding) => {
    const stored = input.record.targetApprovalBindings.find((item) => item.reviewKey === binding.reviewKey);
    return (
      stored &&
      stored.reviewedContentFingerprint === binding.reviewedContentFingerprint &&
      stored.packTargetFingerprint === binding.packTargetFingerprint &&
      stored.reviewRevision === binding.reviewRevision
    );
  });
}

export function projectEffectiveSceneContentRegistry(input: {
  authoredRegistry: readonly ContextualSceneContentRegistryEntry[];
  sceneClusterId: string;
  effectivePromotionPackIds: readonly string[];
}): {
  ok: boolean;
  registry: ContextualSceneContentRegistryEntry[];
  issues: BatchPromotionIssue[];
  activatedPackId: string | null;
} {
  const issues: BatchPromotionIssue[] = [];
  const authored = input.authoredRegistry.map((entry) => structuredClone(entry));
  const scenePacks = authored.filter((entry) => entry.pack.sceneClusterId === input.sceneClusterId);
  const authoredEligible = scenePacks.filter(
    (entry) => entry.releaseEligibility === "RELEASE_ELIGIBLE" && entry.status === "APPROVED_FOR_EXPERIMENT",
  );
  if (authoredEligible.length !== 1) {
    issues.push(
      issue("PROMOTION_CONFLICT", "releaseEligibility", "Authored scene does not have a unique RELEASE_ELIGIBLE pack."),
    );
    return { ok: false, registry: authored, issues, activatedPackId: null };
  }
  const effective = new Set(input.effectivePromotionPackIds);
  let cursor = authoredEligible[0]!.packId;
  let activated: string | null = null;
  const chain: string[] = [];
  while (cursor) {
    const children = scenePacks.filter(
      (entry) => entry.parentPackId === cursor && effective.has(entry.packId),
    );
    if (children.length > 1) {
      issues.push(
        issue("PROMOTION_CONFLICT", cursor, "Multiple valid child promotions exist; selection is fail-closed."),
      );
      return { ok: false, registry: authored, issues, activatedPackId: null };
    }
    if (children.length === 0) {
      break;
    }
    activated = children[0]!.packId;
    chain.push(activated);
    cursor = activated;
  }
  if (!activated) {
    return { ok: true, registry: authored, issues, activatedPackId: null };
  }
  for (const entry of authored) {
    if (entry.packId === authoredEligible[0]!.packId || chain.includes(entry.packId)) {
      entry.releaseEligibility = "NONE";
    }
    if (entry.packId === activated) {
      entry.status = "APPROVED_FOR_EXPERIMENT";
      entry.approvalBasis = "HUMAN_REVIEW_PROMOTION";
      entry.releaseEligibility = "RELEASE_ELIGIBLE";
    }
  }
  const eligible = authored.filter(
    (entry) =>
      entry.pack.sceneClusterId === input.sceneClusterId &&
      entry.releaseEligibility === "RELEASE_ELIGIBLE",
  );
  if (eligible.length !== 1) {
    issues.push(issue("PROMOTION_CONFLICT", "releaseEligibility", "Projected scene eligibility is not unique."));
    return { ok: false, registry: authored.map((entry) => structuredClone(entry)), issues, activatedPackId: null };
  }
  return { ok: true, registry: authored, issues, activatedPackId: activated };
}
