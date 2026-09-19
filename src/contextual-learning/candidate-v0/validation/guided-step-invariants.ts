/**
 * Candidate V0 / Experimental / Not a Standard.
 * Structural Guided invariants shared by domain and execution validators.
 */

export type GuidedStepInvariantKind = "INVALID_INTENT" | "DECLARES_ASSESSMENT";

export interface GuidedStepInvariantIssue {
  kind: GuidedStepInvariantKind;
  path: string;
  message: string;
}

export function findGuidedStepInvariantIssues(step: {
  id?: string;
  executionIntent?: { completionMode?: string };
  presentation?: { instruction?: string };
}): GuidedStepInvariantIssue[] {
  const id = step.id?.trim() || "step";
  const issues: GuidedStepInvariantIssue[] = [];

  if (step.executionIntent?.completionMode !== "ACKNOWLEDGE_ONLY") {
    issues.push({
      kind: "INVALID_INTENT",
      path: `steps.${id}.executionIntent.completionMode`,
      message: "Guided steps must declare ACKNOWLEDGE_ONLY",
    });
  }

  const instruction = step.presentation?.instruction;
  if (typeof instruction !== "string" || !instruction.trim()) {
    issues.push({
      kind: "INVALID_INTENT",
      path: `steps.${id}.presentation.instruction`,
      message: "Guided steps must declare a presentation instruction",
    });
  }

  if ("expectedResponse" in step) {
    issues.push({
      kind: "DECLARES_ASSESSMENT",
      path: `steps.${id}.expectedResponse`,
      message:
        "Guided steps must not declare an answer spec or correctCandidateIds",
    });
  }
  if ("supportPolicy" in step) {
    issues.push({
      kind: "DECLARES_ASSESSMENT",
      path: `steps.${id}.supportPolicy`,
      message: "Guided steps must not declare a supportPolicy",
    });
  }
  if ("requiredCapabilities" in step) {
    issues.push({
      kind: "DECLARES_ASSESSMENT",
      path: `steps.${id}.requiredCapabilities`,
      message: "Guided steps must not declare requiredCapabilities",
    });
  }

  return issues;
}
