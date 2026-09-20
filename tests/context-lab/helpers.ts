import { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import type { ContextLabClientOps } from "@/app/play/context-lab/context-lab-client";

export const FORBIDDEN_CLIENT_FIELDS = [
  "answerKey",
  "correctOptionIds",
  "optionLexemeIds",
  "expectedAnswer",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "isCorrect",
  "LearningEvidence",
  "StudentLexemeModel",
] as const;

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

export function serializedContains(value: unknown, needle: string): boolean {
  return JSON.stringify(value).includes(needle);
}

export function createMealLabHarness(options: {
  userId?: string;
  enabled?: boolean;
  createId?: () => string;
} = {}) {
  const repository = new InMemoryContextLabRunRepository();
  let seq = 0;
  const controller = new MealContextLabController({
    repository,
    userId: options.userId ?? V1_PLACEHOLDER_USER_ID,
    enabled: options.enabled ?? true,
    now: () => "2026-09-20T00:00:00.000Z",
    createId: options.createId ?? (() => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`),
  });
  const ops: ContextLabClientOps = {
    start: () => controller.start(),
    acknowledge: (input) => controller.acknowledge(input),
    restart: () => controller.restart(),
    loadCurrent: (input) => controller.loadCurrent(input),
  };
  return { repository, controller, ops };
}

export async function startFirstGuided() {
  const harness = createMealLabHarness();
  const screen = await harness.controller.start();
  return { ...harness, screen };
}

export function assertGuided(
  screen: ContextLabCurrentScreen,
): asserts screen is Extract<ContextLabCurrentScreen, { kind: "GUIDED" }> {
  if (screen.kind !== "GUIDED") {
    throw new Error(`expected GUIDED, got ${screen.kind}`);
  }
}

export function assertFrozen(
  screen: ContextLabCurrentScreen,
): asserts screen is Extract<
  ContextLabCurrentScreen,
  { kind: "FROZEN_TASK_PREVIEW" }
> {
  if (screen.kind !== "FROZEN_TASK_PREVIEW") {
    throw new Error(`expected FROZEN_TASK_PREVIEW, got ${screen.kind}`);
  }
}
