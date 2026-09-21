import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "./content/helpers";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES, MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MINIMAL_SUPPORT, assessable, profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import type { AssessableExperienceStepSpec } from "@/contextual-learning/candidate-v0/domain/types";
import { compilationRequest } from "./helpers";

describe("Candidate V0 full-sense identity", () => {
  it("does not treat borrow#primary and lend#primary as the same sense", () => {
    expect(
      sameLexemeSense(
        { lexemeId: "borrow", senseId: "primary" },
        { lexemeId: "lend", senseId: "primary" },
      ),
    ).toBe(false);
    expect(
      sameLexemeSense(
        { lexemeId: "borrow", senseId: "primary" },
        { lexemeId: "borrow", senseId: "primary" },
      ),
    ).toBe(true);
  });

  it("fails compilation when expected senseId matches a target but lexemeId differs", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const step: AssessableExperienceStepSpec = assessable({
      id: "mismatched-lexeme",
      purpose: "RECALL",
      targetIds: ["target-spoon-form"],
      semanticAction: "TYPE",
      promptIntent: {
        instructionKey: "Produce the English word for the required tool.",
        semanticQuestion: {
          predicate: "name_required_tool",
          arguments: [],
          expected: true,
        },
        mustNotRevealTargetForm: true,
      },
      expectedResponse: {
        kind: "LEXICAL_FORM",
        sense: { lexemeId: "lex-fork", senseId: MEAL_SENSE.spoon.senseId },
      },
      supportPolicy: MINIMAL_SUPPORT,
      requiredCapabilities: ["frozen-text-input:TYPE"],
      transition: { onTaskCompleted: "END", onSupportExhausted: "END" },
    });
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });
});
