import { describe, expect, it } from "vitest";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import type { TaskCompilationRequest } from "@/contextual-learning/candidate-v0/compilation/types";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { MINIMAL_SUPPORT } from "@/contextual-learning/candidate-v0/fixtures/shared";

describe("Candidate V0 ambiguous sense → lexeme projection", () => {
  it("rejects issue#problem vs issue#publish when Evidence can only store issue", () => {
    const request: TaskCompilationRequest = {
      experienceId: "issue-ambiguity",
      learningNeedId: "need-issue",
      step: {
        id: "recall-issue-problem",
        purpose: "RECALL",
        targetIds: ["target-issue-problem"],
        semanticAction: "TYPE",
        promptIntent: {
          instructionKey: "Type the word for a difficulty.",
          semanticQuestion: {
            predicate: "name_problem",
            arguments: [],
            expected: true,
          },
          mustNotRevealTargetForm: true,
        },
        expectedResponse: {
          kind: "LEXICAL_FORM",
          sense: { lexemeId: "issue", senseId: "issue#problem" },
        },
        supportPolicy: MINIMAL_SUPPORT,
        requiredCapabilities: ["frozen-text-input:TYPE"],
        transition: { onTaskCompleted: "END", onSupportExhausted: "END" },
      },
      resolvedContext: {
        contextFrameId: "frame-issue",
        skeletonId: "skeleton-issue",
        entityBindings: [
          {
            entityId: "problem-issue",
            roleId: "TOPIC",
            label: "problem",
            conceptIds: [],
            lexemeSenseBindings: [
              {
                sense: { lexemeId: "issue", senseId: "issue#problem" },
                bindingKind: "NAMES_ENTITY",
              },
            ],
          },
          {
            entityId: "publish-issue",
            roleId: "TOPIC",
            label: "publication",
            conceptIds: [],
            lexemeSenseBindings: [
              {
                sense: { lexemeId: "issue", senseId: "issue#publish" },
                bindingKind: "NAMES_ENTITY",
              },
            ],
          },
        ],
        facts: [],
        activeGoalId: "NAME_ISSUE",
        allowedSemanticActions: ["TYPE", "RECALL"],
        sourceVersions: { "skeleton-issue": 0 },
      },
      resolvedTargets: [
        {
          targetId: "target-issue-problem",
          sense: { lexemeId: "issue", senseId: "issue#problem" },
          displayForm: "issue",
          focus: "MEANING_TO_FORM",
        },
        {
          targetId: "target-issue-publish",
          sense: { lexemeId: "issue", senseId: "issue#publish" },
          displayForm: "issue",
          focus: "MEANING_TO_FORM",
        },
      ],
      supportPolicy: MINIMAL_SUPPORT,
      now: "2026-09-17T12:00:00.000Z",
      createId: () => "issue-task-1",
    };

    const compiled = compileExperienceStep(request);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(
      DomainErrorCode.COMPILATION_AMBIGUOUS_SENSE_PROJECTION,
    );
  });
});
