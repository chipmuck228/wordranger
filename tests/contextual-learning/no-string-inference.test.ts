import { describe, expect, it } from "vitest";
import { materializeExplicitChoiceOptions } from "@/contextual-learning/candidate-v0/compilation/adapters/choice-adapter";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES, BORROW_SENSE } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import { createBorrowBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import { MINIMAL_SUPPORT, profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import type {
  ChoiceExpectedResponse,
  ExperienceStepSpec,
} from "@/contextual-learning/candidate-v0/domain/types";
import { compilationRequest } from "./helpers";

const trapChoice: ChoiceExpectedResponse = {
  kind: "RELATION_CHOICE",
  candidates: [
    {
      id: "opt-not-borrowable",
      value: "not-borrowable",
      displayText: "not borrowable",
    },
    {
      id: "opt-actual-borrow",
      value: "renamed-temporary-receive",
      displayText: "temporary receive",
      lexemeRef: BORROW_SENSE.borrow,
    },
  ],
  correctCandidateIds: ["opt-actual-borrow"],
};

describe("Candidate V0 does not infer answers from strings", () => {
  it("does not treat relationId not-borrowable as correct just because senseId contains borrow", () => {
    const options = materializeExplicitChoiceOptions({
      ...trapChoice,
      candidates: [
        {
          id: "opt-not-borrowable",
          value: "not-borrowable",
          displayText: "not borrowable",
        },
        {
          id: "opt-actual-borrow",
          value: "rel-borrow",
          displayText: "borrow",
          lexemeRef: {
            lexemeId: "lex-borrow",
            senseId: "borrow#temporary-receive",
          },
        },
      ],
    });
    const inferredByIncludes = options.find((option) =>
      option.text.includes("borrowable"),
    );
    expect(inferredByIncludes?.correct).toBe(false);
    expect(options.find((option) => option.id === "opt-actual-borrow")?.correct).toBe(
      true,
    );
  });

  it("keeps the same correct candidate after semantic IDs are renamed", () => {
    const renamed = materializeExplicitChoiceOptions({
      ...trapChoice,
      candidates: trapChoice.candidates.map((candidate) =>
        candidate.id === "opt-actual-borrow"
          ? { ...candidate, value: "semantic-id-after-rename" }
          : candidate,
      ),
    });
    expect(renamed.find((option) => option.id === "opt-actual-borrow")?.correct).toBe(
      true,
    );
    expect(renamed.find((option) => option.id === "opt-not-borrowable")?.correct).toBe(
      false,
    );
  });

  it("does not treat every predicate.expected === true as the item answer", () => {
    const options = materializeExplicitChoiceOptions({
      kind: "CLAIM_CHOICE",
      candidates: [
        {
          id: "claim-asked",
          value: { predicate: "goal_satisfied", arguments: [], expected: true },
          displayText: "asked claim",
        },
        {
          id: "claim-also-true",
          value: { predicate: "attempt_is", arguments: [], expected: true },
          displayText: "other true predicate",
        },
        {
          id: "claim-false",
          value: { predicate: "has_general_ability", arguments: [], expected: false },
          displayText: "false claim",
        },
      ],
      correctCandidateIds: ["claim-asked"],
    });
    expect(options.filter((option) => option.correct).map((option) => option.id)).toEqual(
      ["claim-asked"],
    );
    expect(options.find((option) => option.id === "claim-also-true")?.correct).toBe(
      false,
    );
  });

  it("does not compile a trap RELATION_CHOICE into a guessed MEANING_CHOICE task", () => {
    const plan = createBorrowBuildPlan(classroomRulerFrame);
    const step: ExperienceStepSpec = {
      id: "trap-relation",
      purpose: "OBSERVE",
      targetIds: ["target-borrow"],
      semanticAction: "OBSERVE",
      promptIntent: {
        instructionKey: "Which relation holds?",
        semanticQuestion: {
          predicate: "expressed_from_observer",
          arguments: [],
          expected: true,
        },
      },
      expectedResponse: trapChoice,
      supportPolicy: MINIMAL_SUPPORT,
      requiredCapabilities: ["frozen-choice:OBSERVE"],
      transition: { onTaskCompleted: "END", onSupportExhausted: "END" },
    };
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: classroomRulerFrame,
        skeleton: borrowingSharingSkeleton,
        profiles: profileMap(BORROW_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });
});
