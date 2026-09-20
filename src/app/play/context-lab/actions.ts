"use server";

import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { isAbortLike } from "@/lib/runtime/persistence-timeout";
import {
  ContextLabError,
  errorScreen,
  networkErrorScreen,
  runtimeInvalidScreen,
} from "@/server/context-lab/context-lab-errors";
import { createContextLabRuntime } from "@/server/context-lab/create-context-lab-runtime";
import { isContextLabEnabled } from "@/server/context-lab/is-context-lab-enabled";

export async function startMealContextLab(): Promise<ContextLabCurrentScreen> {
  return runController((controller) => controller.start());
}

export async function acknowledgeContextLabGuidedActivity(input: {
  runId: string;
  revision: number;
  activityId: string;
}): Promise<ContextLabCurrentScreen> {
  return runController((controller) =>
    controller.acknowledge({
      runId: input.runId,
      revision: input.revision,
      activityId: input.activityId,
    }),
  );
}

export async function restartMealContextLab(): Promise<ContextLabCurrentScreen> {
  return runController((controller) => controller.restart());
}

export async function loadCurrentMealContextLab(input: {
  runId: string;
}): Promise<ContextLabCurrentScreen> {
  return runController((controller) => controller.loadCurrent(input));
}

async function runController(
  operation: (
    controller: ReturnType<
      ReturnType<typeof createContextLabRuntime>["createController"]
    >,
  ) => Promise<ContextLabCurrentScreen>,
): Promise<ContextLabCurrentScreen> {
  if (!isContextLabEnabled()) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
  }
  try {
    const runtime = createContextLabRuntime();
    return await operation(runtime.createController());
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown): ContextLabCurrentScreen {
  if (error instanceof ContextLabError) {
    if (error.code === CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID) {
      return runtimeInvalidScreen();
    }
    return errorScreen(error.code, {
      recoverable: error.recoverable,
    });
  }
  if (isAbortLike(error)) {
    return networkErrorScreen();
  }
  console.error("[context-lab]", error);
  return networkErrorScreen();
}
