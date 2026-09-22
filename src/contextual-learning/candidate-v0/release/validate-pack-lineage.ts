/**
 * Cumulative pack lineage for Candidate V0 releases.
 * Silent target removal is not a supported publish path.
 */

import { fingerprintContent } from "../content/content-fingerprint";
import type { ContextualSceneContentPack, ContextualSceneContentRegistryEntry } from "../content/types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import { findUniqueApprovalSource, type ReleaseApprovalSource } from "./approval-source-registry";
import type { ReleaseValidationIssue, ReleaseValidationResult } from "./types";

function issue(
  code: ReleaseValidationIssue["code"],
  path: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path, detail };
}

function packById(
  registry: readonly ContextualSceneContentRegistryEntry[],
  extraPacks: readonly ContextualSceneContentPack[],
  packId: string,
): ContextualSceneContentPack | null {
  const fromRegistry = registry.filter((entry) => entry.packId === packId);
  if (fromRegistry.length === 1) {
    return fromRegistry[0]!.pack;
  }
  const extras = extraPacks.filter((pack) => pack.id === packId);
  return extras.length === 1 ? extras[0]! : null;
}

function parentIdFor(
  registry: readonly ContextualSceneContentRegistryEntry[],
  packId: string,
): string | null | undefined {
  const matches = registry.filter((entry) => entry.packId === packId);
  if (matches.length !== 1) {
    return undefined;
  }
  return matches[0]!.parentPackId ?? null;
}

export function validateCumulativePackLineage(input: {
  pack: ContextualSceneContentPack;
  parentPackId: string | null;
  registry: readonly ContextualSceneContentRegistryEntry[];
  approvalSources: readonly ReleaseApprovalSource[];
  extraPacks?: readonly ContextualSceneContentPack[];
  sceneId: string;
}): ReleaseValidationResult {
  const issues: ReleaseValidationIssue[] = [];
  const extraPacks = input.extraPacks ?? [];
  const seenTargets = new Set<string>();
  const seenOrders = new Map<string, Set<number>>();
  for (const lexeme of input.pack.lexemes) {
    const key = `${lexeme.target.lexemeId}::${lexeme.target.senseId}`;
    if (seenTargets.has(key)) {
      issues.push(issue("RELEASE_DUPLICATE_SENSE", key, "Pack contains a duplicate LexemeSenseRef."));
    }
    seenTargets.add(key);
    for (const binding of lexeme.membership.frameBindings) {
      const orders = seenOrders.get(binding.frameId) ?? new Set<number>();
      if (orders.has(binding.sceneOrder)) {
        issues.push(
          issue(
            "RELEASE_TARGET_ORDER",
            `${binding.frameId}.${binding.sceneOrder}`,
            "Scene order conflicts inside the pack.",
          ),
        );
      }
      orders.add(binding.sceneOrder);
      seenOrders.set(binding.frameId, orders);
    }
  }

  const reviewKeys = new Set<string>();
  for (const lexeme of input.pack.lexemes) {
    const found = findUniqueApprovalSource({
      sources: input.approvalSources,
      target: lexeme.target,
      sceneId: input.sceneId,
    });
    if (!found.ok) {
      issues.push(...found.issues);
      continue;
    }
    if (reviewKeys.has(found.source.reviewKey)) {
      issues.push(
        issue("RELEASE_DUPLICATE_TARGET", found.source.reviewKey, "Approval source reviewKey is duplicated."),
      );
    }
    reviewKeys.add(found.source.reviewKey);
  }

  if (input.pack.sceneClusterId && input.parentPackId) {
    const parent = packById(input.registry, extraPacks, input.parentPackId);
    if (!parent) {
      issues.push(
        issue("RELEASE_LINEAGE_INVALID", "parentPackId", "Declared parent pack does not exist."),
      );
      return { ok: false, issues };
    }
    if (parent.sceneClusterId !== input.pack.sceneClusterId) {
      issues.push(issue("RELEASE_LINEAGE_INVALID", "sceneClusterId", "Parent pack belongs to a different scene."));
    }

    const walked = new Set<string>([input.pack.id]);
    let cursor: string | null = input.parentPackId;
    while (cursor) {
      if (walked.has(cursor)) {
        issues.push(issue("RELEASE_LINEAGE_CYCLE", "parentPackId", "Pack lineage contains a cycle."));
        break;
      }
      walked.add(cursor);
      const next = parentIdFor(input.registry, cursor);
      if (next === undefined) {
        const extra = extraPacks.find((item) => item.id === cursor);
        if (!extra && !packById(input.registry, extraPacks, cursor)) {
          issues.push(issue("RELEASE_LINEAGE_INVALID", cursor, "Lineage parent is missing."));
        }
        break;
      }
      cursor = next;
    }

    for (const parentLexeme of parent.lexemes) {
      const child = input.pack.lexemes.find((item) => sameLexemeSense(item.target, parentLexeme.target));
      if (!child) {
        issues.push(
          issue(
            "RELEASE_REMOVAL_UNSUPPORTED",
            `${parentLexeme.target.lexemeId}:${parentLexeme.target.senseId}`,
            "Silent target removal is not a supported Candidate release path.",
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
        const found = findUniqueApprovalSource({
          sources: input.approvalSources,
          target: child.target,
          sceneId: input.sceneId,
        });
        if (!found.ok || found.source.approvalBasis !== "HUMAN_REVIEW_PROMOTION") {
          issues.push(
            issue(
              "RELEASE_FINGERPRINT_DRIFT",
              `${child.target.lexemeId}:${child.target.senseId}`,
              "Inherited target content changed without a new human review.",
            ),
          );
        }
      }
    }

    for (const child of input.pack.lexemes) {
      const inherited = parent.lexemes.some((item) => sameLexemeSense(item.target, child.target));
      if (inherited) {
        continue;
      }
      const found = findUniqueApprovalSource({
        sources: input.approvalSources,
        target: child.target,
        sceneId: input.sceneId,
      });
      if (!found.ok || found.source.approvalBasis !== "HUMAN_REVIEW_PROMOTION") {
        issues.push(
          issue(
            "RELEASE_REVIEW_MISSING",
            `${child.target.lexemeId}:${child.target.senseId}`,
            "New cumulative target requires an APPROVED human review.",
          ),
        );
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
