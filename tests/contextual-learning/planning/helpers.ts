import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import type { ExperienceTarget, RuntimeCapability } from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { BORROW_SENSE } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import { SCHOOL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import type { CognitiveMode } from "@/contextual-learning/candidate-v0/domain/types";
import type { ExperiencePlanningInput } from "@/contextual-learning/candidate-v0/planning";

export const TYPING_CAPABILITY = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-text-input:TYPE",
)!;

export const CHOICE_IDENTIFY = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-choice:IDENTIFY",
)!;

export function capabilityById(id: string): RuntimeCapability {
  const found = FROZEN_RUNTIME_CAPABILITIES.find((capability) => capability.id === id);
  if (!found) {
    throw new Error(`Missing frozen capability ${id}`);
  }
  return found;
}

export function spoonTarget(): ExperienceTarget {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM",
  };
}

export function schoolAbilityTarget(): ExperienceTarget {
  return {
    id: "target-ability",
    sense: SCHOOL_SENSE.ability,
    focus: "CONTEXT_INTERPRETATION",
  };
}

export function schoolSuccessTarget(): ExperienceTarget {
  return {
    id: "target-success",
    sense: SCHOOL_SENSE.success,
    focus: "CONTEXT_INTERPRETATION",
  };
}

export function borrowTargets(): ExperienceTarget[] {
  return [
    {
      id: "target-borrow",
      sense: BORROW_SENSE.borrow,
      focus: "RELATION_USE",
    },
    {
      id: "target-lend",
      sense: BORROW_SENSE.lend,
      focus: "RELATION_USE",
    },
  ];
}

export function planningInput(
  partial: Partial<ExperiencePlanningInput> &
    Pick<ExperiencePlanningInput, "mode" | "targets">,
): ExperiencePlanningInput {
  return {
    learningNeedRef: "need-opaque-ref",
    runtimeCapabilities: [TYPING_CAPABILITY],
    ...partial,
  };
}

export function mealInput(
  mode: CognitiveMode,
  capabilities: RuntimeCapability[] = [TYPING_CAPABILITY],
): ExperiencePlanningInput {
  return {
    learningNeedRef: "need-opaque-ref",
    mode,
    targets: [spoonTarget()],
    runtimeCapabilities: capabilities,
  };
}
