import { describe, expect, it } from "vitest";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";

describe("Candidate V0 school-challenge case", () => {
  it("grounds possible, difficult, and success in structured facts", () => {
    const result = validateContextFrame({
      frame: scienceTowerFrame,
      skeleton: schoolChallengeSkeleton,
    });
    expect(result.ok).toBe(true);

    const possible = scienceTowerFrame.claimGroundings?.find((item) =>
      sameLexemeSense(item.sense, SCHOOL_SENSE.possible),
    );
    const difficult = scienceTowerFrame.claimGroundings?.find((item) =>
      sameLexemeSense(item.sense, SCHOOL_SENSE.difficult),
    );
    const success = scienceTowerFrame.claimGroundings?.find((item) =>
      sameLexemeSense(item.sense, SCHOOL_SENSE.success),
    );
    expect(possible?.supportingFacts.length).toBeGreaterThan(0);
    expect(difficult?.supportingFacts.some((fact) => fact.predicate === "skill_level")).toBe(
      true,
    );
    expect(
      difficult?.supportingFacts.some((fact) => fact.predicate === "challenge_requirement"),
    ).toBe(true);
    expect(success?.claim.predicate).toBe("goal_satisfied");
  });

  it("binds ability as a scoped property, not a fake object", () => {
    const abilityBinding = scienceTowerFrame.entityBindings
      .flatMap((binding) => binding.lexemeSenseBindings ?? [])
      .find((binding) => sameLexemeSense(binding.sense, SCHOOL_SENSE.ability));
    expect(abilityBinding?.bindingKind).toBe("NAMES_PROPERTY");
  });

  it("rejects a general-ability claim built from one local result", () => {
    const frame = structuredClone(scienceTowerFrame);
    frame.claimGroundings = [
      ...(frame.claimGroundings ?? []),
      {
        sense: { lexemeId: "lex-ability", senseId: "ability#general-ability" },
        claim: {
          predicate: "has_general_ability",
          arguments: [],
          expected: true,
        },
        supportingFacts: [
          {
            predicate: "goal_satisfied",
            arguments: [{ kind: "ENTITY", entityId: "tower-attempt-2" }],
            expected: true,
          },
        ],
      },
    ];
    const result = validateContextFrame({
      frame,
      skeleton: schoolChallengeSkeleton,
    });
    expect(
      result.issues.some(
        (issue) => issue.code === DomainErrorCode.CTX_GENERAL_ABILITY_OVERCLAIM,
      ),
    ).toBe(true);
  });
});
