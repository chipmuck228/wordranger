/**
 * Data-driven approval sources for Candidate V0 releases.
 * Authority looks up sources; it does not switch on lemma or batch number.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualSceneContentPack } from "../content/types";
import { MEAL_RELEASE_SCENE_ID } from "./types";
import type { ReleaseApprovalBasis, ReleaseValidationIssue } from "./types";

export interface ReleaseApprovalSource {
  sceneId: string;
  reviewKey: string;
  target: LexemeSenseRef;
  expectedTarget: LexemeSenseRef;
  approvalBasis: ReleaseApprovalBasis;
  approvalPackId: string;
  sourceRefs: readonly string[];
}

export function deriveLegacyApprovalSources(input: {
  sceneId: string;
  baselinePack: ContextualSceneContentPack;
  baselinePackId: string;
}): ReleaseApprovalSource[] {
  return input.baselinePack.lexemes.map((lexeme) => ({
    sceneId: input.sceneId,
    reviewKey: `legacy-meal-baseline-${lexeme.canonicalKey}`,
    target: lexeme.target,
    expectedTarget: lexeme.target,
    approvalBasis: "LEGACY_EXPERIMENT_BASELINE" as const,
    approvalPackId: input.baselinePackId,
    sourceRefs: [...input.baselinePack.provenance.sourceRefs],
  }));
}

export function deriveHumanApprovalSources(input: {
  sceneId: string;
  reviewTargets: readonly {
    reviewKey: string;
    packId: string;
    target: LexemeSenseRef;
    sourceRefs: readonly string[];
  }[];
}): ReleaseApprovalSource[] {
  return input.reviewTargets.map((item) => ({
    sceneId: input.sceneId,
    reviewKey: item.reviewKey,
    target: item.target,
    expectedTarget: item.target,
    approvalBasis: "HUMAN_REVIEW_PROMOTION" as const,
    approvalPackId: item.packId,
    sourceRefs: [...item.sourceRefs],
  }));
}

export function findUniqueApprovalSource(input: {
  sources: readonly ReleaseApprovalSource[];
  target: LexemeSenseRef;
  sceneId?: string;
}):
  | { ok: true; source: ReleaseApprovalSource }
  | { ok: false; code: "RELEASE_TARGET_UNAPPROVED" | "RELEASE_ELIGIBILITY_AMBIGUOUS"; issues: ReleaseValidationIssue[] } {
  const sceneId = input.sceneId ?? MEAL_RELEASE_SCENE_ID;
  const matches = input.sources.filter(
    (source) => source.sceneId === sceneId && sameLexemeSense(source.target, input.target),
  );
  if (matches.length === 0) {
    return {
      ok: false,
      code: "RELEASE_TARGET_UNAPPROVED",
      issues: [
        {
          code: "RELEASE_TARGET_UNAPPROVED",
          path: `${input.target.lexemeId}:${input.target.senseId}`,
          detail: "Pack target has no registered approval source.",
        },
      ],
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      code: "RELEASE_ELIGIBILITY_AMBIGUOUS",
      issues: [
        {
          code: "RELEASE_ELIGIBILITY_AMBIGUOUS",
          path: `${input.target.lexemeId}:${input.target.senseId}`,
          detail: "Pack target matches more than one approval source.",
        },
      ],
    };
  }
  return { ok: true, source: matches[0]! };
}

export function unusedApprovalSources(input: {
  sources: readonly ReleaseApprovalSource[];
  pack: ContextualSceneContentPack;
  sceneId?: string;
}): ReleaseApprovalSource[] {
  const sceneId = input.sceneId ?? MEAL_RELEASE_SCENE_ID;
  return input.sources.filter(
    (source) =>
      source.sceneId === sceneId &&
      !input.pack.lexemes.some((lexeme) => sameLexemeSense(lexeme.target, source.target)),
  );
}
