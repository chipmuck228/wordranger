/**
 * Release capability sufficiency. Transport inventory only.
 * Does not add frozen task types, evaluators, or Evidence outcomes.
 */

import {
  findFrozenCapability,
  findResponseTransport,
  listFrozenRuntimeCapabilities,
} from "../capabilities/capability-registry";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef, RuntimeCapability } from "../domain/types";
import { listPlanVariants } from "../planning/plan-variant-registry";
import type { ReleaseValidationIssue, ReleaseValidationResult } from "./types";

const PROBE_REQUIRED_CAPABILITY_IDS = [
  "frozen-text-input:TYPE",
  "frozen-text-input:RECALL",
  "frozen-choice:IDENTIFY",
] as const;

export function requiredCapabilityIdsForReleaseTargets(
  targets: readonly LexemeSenseRef[],
): string[] {
  const ids = new Set<string>(PROBE_REQUIRED_CAPABILITY_IDS);
  for (const variant of listPlanVariants()) {
    const covers = targets.some((target) =>
      variant.supportedSenses.some((sense) => sameLexemeSense(sense, target)),
    );
    if (!covers) {
      continue;
    }
    if (variant.mode !== "PROBE" && variant.mode !== "BUILD" && variant.mode !== "STRENGTHEN") {
      continue;
    }
    for (const id of variant.requiredCapabilityIds) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

export function validateMealReleaseCapabilities(input: {
  targets: readonly LexemeSenseRef[];
  capabilities?: readonly RuntimeCapability[];
}): ReleaseValidationResult {
  const issues: ReleaseValidationIssue[] = [];
  const capabilities = input.capabilities ?? listFrozenRuntimeCapabilities();
  const available = new Set(capabilities.map((item) => item.id));
  for (const id of requiredCapabilityIdsForReleaseTargets(input.targets)) {
    if (!available.has(id)) {
      issues.push({
        code: "RELEASE_CAPABILITY_GAP",
        path: `capabilities.${id}`,
        detail: `Required frozen runtime capability ${id} is missing.`,
      });
    }
  }
  if (!findFrozenCapability("TYPE", "LEXICAL_FORM")) {
    issues.push({
      code: "RELEASE_CAPABILITY_GAP",
      path: "capabilities.TYPE.LEXICAL_FORM",
      detail: "Probe/BUILD/STRENGTHEN recall requires TYPE/LEXICAL_FORM transport.",
    });
  }
  if (!findFrozenCapability("RECALL", "LEXICAL_FORM")) {
    issues.push({
      code: "RELEASE_CAPABILITY_GAP",
      path: "capabilities.RECALL.LEXICAL_FORM",
      detail: "Probe recall requires RECALL/LEXICAL_FORM transport.",
    });
  }
  if (!findResponseTransport("LEXICAL_FORM")) {
    issues.push({
      code: "RELEASE_CAPABILITY_GAP",
      path: "capabilities.transport.LEXICAL_FORM",
      detail: "Frozen TEXT_INPUT transport cannot carry LEXICAL_FORM.",
    });
  }
  return { ok: issues.length === 0, issues };
}
