import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "./content/helpers";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { findSemanticProjection } from "@/contextual-learning/candidate-v0/compilation/semantic-projection";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES, MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createMealBuildPlan,
  createMealStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MINIMAL_SUPPORT, assessable } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import {
  isAssessableExperienceStep,
  type AssessableExperienceStepSpec,
} from "@/contextual-learning/candidate-v0/domain/types";
import { compilationRequest } from "./helpers";

function compileMealVariant(step: AssessableExperienceStepSpec) {
  const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
  return compileExperienceStep(
    compilationRequest({
      plan,
      step,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      profiles: profileMap(MEAL_PROFILES),
    }),
  );
}

const lexicalRecall: AssessableExperienceStepSpec = assessable({
  id: "proj-lexical-recall",
  purpose: "RECALL",
  targetIds: ["target-spoon-form"],
  semanticAction: "TYPE",
  promptIntent: {
    instructionKey: "Produce the English word for the required tool.",
    semanticQuestion: { predicate: "name_required_tool", arguments: [], expected: true },
    mustNotRevealTargetForm: true,
  },
  expectedResponse: { kind: "LEXICAL_FORM", sense: MEAL_SENSE.spoon },
  supportPolicy: MINIMAL_SUPPORT,
  requiredCapabilities: ["frozen-text-input:TYPE"],
  transition: { onTaskCompleted: "END", onSupportExhausted: "END" },
});

describe("Candidate V0 semantic projection whitelist", () => {
  it("maps LEXICAL_FORM + TYPE/RECALL + MEANING_TO_FORM + RECALL to ACTIVE_RECALL", () => {
    const typeProjection = findSemanticProjection({
      semanticAction: "TYPE",
      responseKind: "LEXICAL_FORM",
      targetFocus: "MEANING_TO_FORM",
      stepPurpose: "RECALL",
    });
    const recallProjection = findSemanticProjection({
      semanticAction: "RECALL",
      responseKind: "LEXICAL_FORM",
      targetFocus: "MEANING_TO_FORM",
      stepPurpose: "RECALL",
    });
    expect(typeProjection?.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(typeProjection?.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(recallProjection?.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(recallProjection?.id).not.toBe(typeProjection?.id);

    const compiled = compileMealVariant(lexicalRecall);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.value.publicLearningTask.taskType).toBe(
      LearningTaskType.ACTIVE_RECALL_TYPING,
    );
    expect(compiled.value.publicLearningTask.targetSkill).toBe(
      VocabularySkill.ACTIVE_RECALL,
    );
    expect(compiled.value.trace.semanticProjectionId).toBe(typeProjection?.id);
  });

  it("rejects LEXICAL_FORM + OBSERVE", () => {
    const compiled = compileMealVariant({
      ...lexicalRecall,
      id: "proj-lexical-observe",
      purpose: "OBSERVE",
      semanticAction: "OBSERVE",
    });
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("rejects CLAIM_CHOICE + PREDICT", () => {
    const compiled = compileMealVariant({
      ...lexicalRecall,
      id: "proj-claim-predict",
      purpose: "TRANSFER",
      semanticAction: "PREDICT",
      targetIds: ["target-spoon"],
      expectedResponse: {
        kind: "CLAIM_CHOICE",
        candidates: [
          {
            id: "claim-true",
            value: { predicate: "goal_satisfied", arguments: [], expected: true },
            displayText: "goal satisfied",
          },
          {
            id: "claim-false",
            value: { predicate: "goal_failed", arguments: [], expected: false },
            displayText: "goal failed",
          },
        ],
        correctCandidateIds: ["claim-true"],
      },
    });
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("rejects RELATION_CHOICE + OBSERVE", () => {
    const compiled = compileMealVariant({
      ...lexicalRecall,
      id: "proj-relation-observe",
      purpose: "OBSERVE",
      semanticAction: "OBSERVE",
      targetIds: ["target-spoon"],
      expectedResponse: {
        kind: "RELATION_CHOICE",
        candidates: [
          {
            id: "rel-a",
            value: "rel-suitable",
            displayText: "suitable",
          },
          {
            id: "rel-b",
            value: "rel-other",
            displayText: "other",
          },
        ],
        correctCandidateIds: ["rel-a"],
      },
    });
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("rejects SEMANTIC_CLASS + CLASSIFY", () => {
    const compiled = compileMealVariant({
      ...lexicalRecall,
      id: "proj-class-classify",
      purpose: "CONNECT",
      semanticAction: "CLASSIFY",
      targetIds: ["target-spoon"],
      expectedResponse: {
        kind: "SEMANTIC_CLASS",
        candidates: [
          {
            id: "class-tool",
            value: "concept-eating-tool",
            displayText: "eating tool",
          },
          {
            id: "class-food",
            value: "concept-food",
            displayText: "food",
          },
        ],
        correctCandidateIds: ["class-tool"],
      },
    });
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("rejects ENTITY_REF that requires situational / relation reasoning", () => {
    const plan = createMealStrengthenPlan(homeBreakfastFrame);
    const identify = plan.steps[0];
    expect(isAssessableExperienceStep(identify)).toBe(true);
    if (!isAssessableExperienceStep(identify)) {
      return;
    }
    expect(identify.semanticAction).toBe("IDENTIFY");
    expect(identify.expectedResponse.kind).toBe("ENTITY_REF");
    const compiled = compileMealVariant(identify);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });
});
