import { DomainErrorCode, errorIssue } from "../domain/errors";
import type { DomainValidationIssue } from "../domain/errors";
import type { StepSupportPolicy, SupportBlock } from "../domain/types";

const REVEAL_RANK: Record<SupportBlock["revealCost"], number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  ANSWER_REVEALING: 3,
};

/**
 * Level 0 has no help. Full answers may appear only at the terminal level.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function validateSupportPolicy(
  policy: StepSupportPolicy,
  blocks: ReadonlyMap<string, SupportBlock>,
  path: string,
): DomainValidationIssue[] {
  const issues: DomainValidationIssue[] = [];
  if (policy.ladder.length === 0) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
        path,
        "Support ladder must declare levels 0–4",
      ),
    );
    return issues;
  }

  const levels = policy.ladder.map((item) => item.level);
  for (let index = 0; index < levels.length; index += 1) {
    if (index > 0 && levels[index] <= levels[index - 1]) {
      issues.push(
        errorIssue(
          DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
          `${path}.ladder`,
          "Support levels must increase from weaker to stronger",
        ),
      );
    }
  }

  const level0 = policy.ladder.find((item) => item.level === 0);
  if (!level0) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
        `${path}.ladder`,
        "Level 0 (no help) is required",
      ),
    );
  } else if (level0.supportBlockIds.length > 0) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
        `${path}.ladder.0`,
        "Level 0 must contain no support blocks",
      ),
    );
  }

  let previousMax = -1;
  let answerRevealingLevel: number | null = null;
  for (const level of policy.ladder) {
    let levelMax = previousMax;
    for (const blockId of level.supportBlockIds) {
      const block = blocks.get(blockId);
      if (!block) {
        issues.push(
          errorIssue(
            DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
            `${path}.ladder.${level.level}`,
            `Unknown support block ${blockId}`,
          ),
        );
        continue;
      }
      const rank = REVEAL_RANK[block.revealCost];
      if (rank < previousMax) {
        issues.push(
          errorIssue(
            DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
            `${path}.ladder.${level.level}`,
            `Support ${blockId} is weaker than an earlier ladder step`,
          ),
        );
      }
      if (block.revealCost === "ANSWER_REVEALING") {
        answerRevealingLevel = level.level;
      }
      levelMax = Math.max(levelMax, rank);
    }
    previousMax = Math.max(previousMax, levelMax);
  }

  const terminalLevel = policy.ladder[policy.ladder.length - 1]?.level ?? 0;
  if (answerRevealingLevel !== null && answerRevealingLevel !== terminalLevel) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_INVALID_SUPPORT_ORDER,
        `${path}.ladder`,
        "Full answer may appear only at the terminal support level",
      ),
    );
  }

  return issues;
}

export function supportTextContainsAnswer(
  block: SupportBlock,
  answerForm: string,
): boolean {
  const needle = answerForm.toLowerCase();
  if (block.content.kind === "TEXT") {
    return block.content.text.toLowerCase().includes(needle);
  }
  if (block.content.kind === "PARTIAL_LEXICAL_CUE") {
    return block.content.pattern.toLowerCase() === needle;
  }
  return false;
}
