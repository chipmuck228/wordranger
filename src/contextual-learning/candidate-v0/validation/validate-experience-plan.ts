import type {
  ContextFrame,
  LearningExperiencePlan,
  RuntimeCapability,
  SemanticSkeleton,
  SenseSemanticProfile,
  SupportBlock,
} from "../domain/types";
import { DomainErrorCode, errorIssue, validationResult } from "../domain/errors";
import type { DomainValidationResult } from "../domain/errors";
import { validateSupportPolicy } from "./validate-support-policy";

const LEARNER_MUTATION_KEYS = [
  "updateLearnerState",
  "writeEvidence",
  "mutateModel",
  "studentLexemeModel",
  "processEvidence",
] as const;

export interface ValidateExperiencePlanInput {
  plan: LearningExperiencePlan;
  frame: ContextFrame;
  skeleton: SemanticSkeleton;
  capabilities: readonly RuntimeCapability[];
  supportBlocks: ReadonlyMap<string, SupportBlock>;
  senseProfiles: ReadonlyMap<string, SenseSemanticProfile>;
}

/**
 * Structural checks for a LearningExperiencePlan.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function validateExperiencePlan(
  input: ValidateExperiencePlanInput,
): DomainValidationResult {
  const { plan, frame, skeleton, capabilities, supportBlocks, senseProfiles } =
    input;
  const issues = [];

  if (!plan.sourceLearningNeedRef.trim()) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_MISSING_LEARNING_NEED_REF,
        "sourceLearningNeedRef",
        "Experience plan must reference a frozen LearningNeed",
      ),
    );
  }

  if (plan.skeletonId !== skeleton.id || plan.contextFrameId !== frame.id) {
    issues.push(
      errorIssue(
        DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
        "contextFrameId",
        "Plan skeleton/frame ids do not match the supplied aggregates",
      ),
    );
  }

  const reachableSenseIds = collectReachableSenseIds(frame);
  const targetById = new Map(plan.targets.map((target) => [target.id, target]));

  for (const target of plan.targets) {
    if (!target.sense.senseId.trim()) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_MISSING_SENSE_ID,
          `targets.${target.id}`,
          "Target is missing senseId",
        ),
      );
    }
    if (!reachableSenseIds.has(target.sense.senseId)) {
      issues.push(
        errorIssue(
          DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
          `targets.${target.id}`,
          `Target sense ${target.sense.senseId} is not bound in frame ${frame.id}`,
        ),
      );
    }
  }

  for (const step of plan.steps) {
    for (const targetId of step.targetIds) {
      if (!targetById.has(targetId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.EXP_TARGET_NOT_REACHABLE,
            `steps.${step.id}.targetIds`,
            `Step ${step.id} references unknown target ${targetId}`,
          ),
        );
      }
    }

    if (!frame.allowedSemanticActions.includes(step.semanticAction)) {
      issues.push(
        errorIssue(
          DomainErrorCode.EXP_UNSUPPORTED_SEMANTIC_ACTION,
          `steps.${step.id}.semanticAction`,
          `Action ${step.semanticAction} is not allowed in frame ${frame.id}`,
        ),
      );
    }

    const matched = findCapability(capabilities, step.semanticAction, step.expectedResponse.kind);
    if (step.requiredCapabilities.length > 0) {
      const missing = step.requiredCapabilities.filter(
        (id) => !capabilities.some((capability) => capability.id === id),
      );
      if (missing.length > 0 || !matched) {
        issues.push(
          errorIssue(
            DomainErrorCode.EXP_NO_RUNTIME_CAPABILITY,
            `steps.${step.id}.requiredCapabilities`,
            `No frozen runtime capability for ${step.semanticAction}/${step.expectedResponse.kind}`,
          ),
        );
      }
    } else if (!matched) {
      issues.push(
        errorIssue(
          DomainErrorCode.EXP_NO_RUNTIME_CAPABILITY,
          `steps.${step.id}`,
          `No frozen runtime capability for ${step.semanticAction}/${step.expectedResponse.kind}`,
        ),
      );
    }

    issues.push(
      ...validateSupportPolicy(
        step.supportPolicy,
        supportBlocks,
        `steps.${step.id}.supportPolicy`,
      ),
    );

    const leaksAnswer =
      step.purpose === "RECALL" ||
      step.promptIntent.mustNotRevealTargetForm === true;
    if (leaksAnswer) {
      for (const targetId of step.targetIds) {
        const target = targetById.get(targetId);
        if (!target) {
          continue;
        }
        const profile = senseProfiles.get(target.sense.senseId);
        const form = profile?.displayForm ?? "";
        if (form && promptRevealsForm(step.promptIntent, form)) {
          issues.push(
            errorIssue(
              DomainErrorCode.EXP_RECALL_LEAKS_ANSWER,
              `steps.${step.id}.promptIntent`,
              `RECALL prompt reveals target form "${form}"`,
            ),
          );
        }
      }
    }
  }

  const completionRecord = plan.completionPolicy as unknown as Record<
    string,
    unknown
  >;
  for (const key of LEARNER_MUTATION_KEYS) {
    if (key in completionRecord) {
      issues.push(
        errorIssue(
          DomainErrorCode.EXP_COMPLETION_MUTATES_LEARNER,
          "completionPolicy",
          "Completion policy must not update learner state",
        ),
      );
    }
  }

  void skeleton;
  return validationResult(issues);
}

export function findCapability(
  capabilities: readonly RuntimeCapability[],
  action: string,
  responseKind: string,
): RuntimeCapability | undefined {
  return capabilities.find(
    (capability) =>
      capability.supportsAction === action &&
      capability.responseKinds.includes(
        responseKind as RuntimeCapability["responseKinds"][number],
      ),
  );
}

function collectReachableSenseIds(frame: ContextFrame): Set<string> {
  const ids = new Set<string>();
  for (const binding of frame.entityBindings) {
    for (const lexeme of binding.lexemeSenseBindings ?? []) {
      ids.add(lexeme.sense.senseId);
    }
  }
  for (const perspective of frame.perspectiveBindings ?? []) {
    ids.add(perspective.expressedSense.senseId);
  }
  for (const grounding of frame.claimGroundings ?? []) {
    ids.add(grounding.sense.senseId);
  }
  return ids;
}

function promptRevealsForm(
  prompt: LearningExperiencePlan["steps"][number]["promptIntent"],
  form: string,
): boolean {
  const needle = form.toLowerCase();
  if (prompt.instructionKey.toLowerCase().includes(needle)) {
    return true;
  }
  const literals: string[] = [];
  for (const value of prompt.semanticQuestion.arguments) {
    if (value.kind === "LITERAL") {
      literals.push(String(value.value).toLowerCase());
    }
  }
  if ("query" in prompt.semanticQuestion) {
    literals.push(prompt.semanticQuestion.query.toLowerCase());
  }
  return literals.some((text) => text.includes(needle));
}
