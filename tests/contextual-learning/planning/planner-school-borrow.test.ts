import { describe, expect, it } from "vitest";
import { PlanningErrorCode, planExperience } from "@/contextual-learning/candidate-v0/planning";
import { SCHOOL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { BORROW_SENSE } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import {
  TYPING_CAPABILITY,
  borrowTargets,
  capabilityById,
  planningInput,
  schoolAbilityTarget,
  schoolSuccessTarget,
} from "./helpers";

const CHOICE_SELECT = capabilityById("frozen-choice:SELECT");
const CHOICE_DISTINGUISH = capabilityById("frozen-choice:DISTINGUISH");

describe("Candidate V0 experience planner — School Challenge", () => {
  it("keeps abstract targets sense-level and does not select claim assessment", () => {
    const planned = planExperience(
      planningInput({
        mode: "BUILD",
        targets: [schoolAbilityTarget(), schoolSuccessTarget()],
        runtimeCapabilities: [CHOICE_DISTINGUISH, TYPING_CAPABILITY],
      }),
    );
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      throw new Error("CLAIM_CHOICE must not become executable");
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE,
    );
    expect(planned.trace.requestedTargetIdentities).toEqual([
      { lexemeId: SCHOOL_SENSE.ability.lexemeId, senseId: SCHOOL_SENSE.ability.senseId },
      { lexemeId: SCHOOL_SENSE.success.lexemeId, senseId: SCHOOL_SENSE.success.senseId },
    ]);
    expect(
      planned.trace.rejectedVariantReasons.some((item) =>
        item.reason.includes("semantic projection"),
      ),
    ).toBe(true);
    expect(
      planned.trace.rejectedVariantReasons.some((item) =>
        item.reason.includes("GUIDED_ONLY"),
      ),
    ).toBe(true);
  });

  it("does not count Guided presentation as STRENGTHEN or RETRIEVE", () => {
    const strengthen = planExperience(
      planningInput({
        mode: "STRENGTHEN",
        targets: [schoolAbilityTarget()],
        runtimeCapabilities: [CHOICE_DISTINGUISH],
      }),
    );
    expect(strengthen.ok).toBe(false);
    if (strengthen.ok) {
      throw new Error("School STRENGTHEN must fail");
    }
    expect(strengthen.error.code).toBe(PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT);

    const retrieve = planExperience(
      planningInput({
        mode: "RETRIEVE",
        targets: [schoolAbilityTarget()],
        runtimeCapabilities: [TYPING_CAPABILITY],
      }),
    );
    expect(retrieve.ok).toBe(false);
    if (retrieve.ok) {
      throw new Error("School RETRIEVE must not be invented");
    }
    expect(retrieve.error.code).toBe(PlanningErrorCode.PLAN_MODE_NOT_AVAILABLE);
  });
});

describe("Candidate V0 experience planner — Borrowing-Sharing", () => {
  it("requires both requester and owner senses and rejects omitted or swapped-only views", () => {
    const both = planExperience(
      planningInput({
        mode: "BUILD",
        targets: borrowTargets(),
        runtimeCapabilities: [CHOICE_SELECT],
      }),
    );
    expect(both.ok).toBe(false);
    if (both.ok) {
      throw new Error("RELATION_CHOICE must not be selected");
    }
    expect(both.error.code).toBe(
      PlanningErrorCode.PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE,
    );

    const omitted = planExperience(
      planningInput({
        mode: "BUILD",
        targets: [borrowTargets()[0]!],
        runtimeCapabilities: [CHOICE_SELECT],
      }),
    );
    expect(omitted.ok).toBe(false);
    if (omitted.ok) {
      throw new Error("omitting lend must fail");
    }
    expect(omitted.error.code).toBe(PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT);

    const giveInstead = planExperience(
      planningInput({
        mode: "BUILD",
        targets: [
          borrowTargets()[0]!,
          {
            id: "target-give",
            sense: BORROW_SENSE.give,
            focus: "RELATION_USE",
          },
        ],
        runtimeCapabilities: [CHOICE_SELECT],
      }),
    );
    expect(giveInstead.ok).toBe(false);
    if (giveInstead.ok) {
      throw new Error("give must not replace lend");
    }
    expect(giveInstead.error.code).toBe(PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED);
  });

  it("does not treat Guided observation as relational assessment", () => {
    const strengthen = planExperience(
      planningInput({
        mode: "STRENGTHEN",
        targets: borrowTargets(),
        runtimeCapabilities: [CHOICE_SELECT, TYPING_CAPABILITY],
      }),
    );
    expect(strengthen.ok).toBe(false);
    if (strengthen.ok) {
      throw new Error("Borrow STRENGTHEN must remain unsupported");
    }
    expect(strengthen.error.code).toBe(PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT);
    expect(
      strengthen.trace.rejectedVariantReasons.every(
        (item) => !item.reason.includes("downgrade"),
      ),
    ).toBe(true);
  });
});
