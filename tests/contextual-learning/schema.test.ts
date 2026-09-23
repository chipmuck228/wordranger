import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "./content/helpers";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { listFrozenRuntimeCapabilities } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createMealBuildPlan,
  createMealStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { isAssessableExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/meal/supports";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { validateSemanticSkeleton } from "@/contextual-learning/candidate-v0/validation/validate-semantic-skeleton";
import { profileMap, supportMap } from "@/contextual-learning/candidate-v0/fixtures/shared";

const capabilities = listFrozenRuntimeCapabilities();
const mealSupports = supportMap(MEAL_SUPPORTS);
const mealProfiles = profileMap(MEAL_PROFILES);

describe("Candidate V0 schema validators", () => {
  it("accepts the authored meal skeleton", () => {
    expect(validateSemanticSkeleton(mealSkeleton).ok).toBe(true);
  });

  it("rejects a relation that points at an unknown role", () => {
    const result = validateSemanticSkeleton({
      ...mealSkeleton,
      relationDefinitions: [
        ...mealSkeleton.relationDefinitions,
        {
          id: "BROKEN",
          label: "Broken",
          fromRole: "EATER",
          toRole: "MISSING_ROLE",
          directionality: "DIRECTED",
          temporalScope: "STATE",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === DomainErrorCode.CTX_UNKNOWN_ROLE)).toBe(
      true,
    );
  });

  it("rejects a lexeme binding without senseId", () => {
    const frame = structuredClone(homeBreakfastFrame);
    frame.entityBindings[3].lexemeSenseBindings = [
      { sense: { lexemeId: "lex-spoon", senseId: "" }, bindingKind: "NAMES_ENTITY" },
    ];
    const result = validateContextFrame({ frame, skeleton: mealSkeleton });
    expect(result.issues.some((issue) => issue.code === DomainErrorCode.CTX_MISSING_SENSE_ID)).toBe(
      true,
    );
  });

  it("rejects an ungrounded abstract claim", () => {
    const frame = structuredClone(homeBreakfastFrame);
    frame.entityBindings[1].lexemeSenseBindings = [
      {
        sense: { lexemeId: "lex-possible", senseId: "possible#goal-reachable" },
        bindingKind: "EXPRESSES_CLAIM",
      },
    ];
    const result = validateContextFrame({ frame, skeleton: mealSkeleton });
    expect(
      result.issues.some((issue) => issue.code === DomainErrorCode.CTX_UNGROUNDED_CLAIM),
    ).toBe(true);
  });

  it("rejects borrow/lend without perspective", () => {
    const frame = structuredClone(classroomRulerFrame);
    frame.perspectiveBindings = [];
    const result = validateContextFrame({
      frame,
      skeleton: borrowingSharingSkeleton,
    });
    expect(
      result.issues.some((issue) => issue.code === DomainErrorCode.CTX_MISSING_PERSPECTIVE),
    ).toBe(true);
  });

  it("rejects borrow/lend with ambiguous direction", () => {
    const frame = structuredClone(classroomRulerFrame);
    frame.perspectiveBindings = [
      {
        eventId: "TRANSFER_TEMPORARY_POSSESSION",
        observerRole: "REQUESTER",
        expressedSense: {
          lexemeId: "lex-borrow",
          senseId: "borrow#temporary-receive",
        },
        requiredDirection: {
          sourceRole: "OWNER",
          destinationRole: "OWNER",
        },
      },
    ];
    const result = validateContextFrame({
      frame,
      skeleton: borrowingSharingSkeleton,
    });
    expect(
      result.issues.some((issue) => issue.code === DomainErrorCode.CTX_AMBIGUOUS_DIRECTION),
    ).toBe(true);
  });

  it("rejects a support ladder that reveals the answer before weaker cues", () => {
    const plan = createMealStrengthenPlan(homeBreakfastFrame);
    const first = plan.steps[0];
    expect(isAssessableExperienceStep(first)).toBe(true);
    if (!isAssessableExperienceStep(first)) {
      return;
    }
    first.supportPolicy = {
      initialSupportBlockIds: [],
      ladder: [
        {
          level: 0,
          trigger: "ON_REQUEST",
          supportBlockIds: [],
          permitsAnotherAttempt: true,
        },
        {
          level: 1,
          trigger: "ON_REQUEST",
          supportBlockIds: ["meal-support-answer"],
          permitsAnotherAttempt: true,
        },
        {
          level: 2,
          trigger: "ON_REQUEST",
          supportBlockIds: ["meal-support-function"],
          permitsAnotherAttempt: true,
        },
      ],
    };
    const result = validateExperiencePlan({
      plan,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      capabilities,
      supportBlocks: mealSupports,
      senseProfiles: mealProfiles,
    });
    expect(
      result.issues.some((issue) => issue.code === DomainErrorCode.EXP_INVALID_SUPPORT_ORDER),
    ).toBe(true);
  });

  it("rejects a guided step that smuggles an answer spec", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const guided = plan.steps[0];
    Object.assign(guided, {
      expectedResponse: {
        kind: "ENTITY_REF",
        candidates: [],
        correctCandidateIds: ["secret-correct"],
      },
    });
    const result = validateExperiencePlan({
      plan,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      capabilities,
      supportBlocks: mealSupports,
      senseProfiles: mealProfiles,
    });
    expect(
      result.issues.some(
        (issue) => issue.code === DomainErrorCode.EXP_GUIDED_DECLARES_ASSESSMENT,
      ),
    ).toBe(true);
  });

  it("rejects a RECALL prompt that leaks the target form", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const recall = plan.steps.find((step) => step.purpose === "RECALL");
    expect(recall && isAssessableExperienceStep(recall)).toBe(true);
    if (!recall || !isAssessableExperienceStep(recall)) {
      return;
    }
    recall.promptIntent.instructionKey = "Type spoon now";
    const result = validateExperiencePlan({
      plan,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      capabilities,
      supportBlocks: mealSupports,
      senseProfiles: mealProfiles,
    });
    expect(
      result.issues.some((issue) => issue.code === DomainErrorCode.EXP_RECALL_LEAKS_ANSWER),
    ).toBe(true);
  });
});
