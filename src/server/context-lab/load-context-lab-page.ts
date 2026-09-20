import "server-only";

import type { ContextLabPilotPayload } from "@/components/context-lab/types";
import { isContextLabEnabled } from "./is-context-lab-enabled";
import { prepareMealContextLab } from "./prepare-meal-context-lab";

export type ContextLabPageLoad =
  | { kind: "NOT_FOUND" }
  | { kind: "READY"; payload: ContextLabPilotPayload };

export function loadContextLabPage(
  env: Record<string, string | undefined> = process.env,
): ContextLabPageLoad {
  if (!isContextLabEnabled(env)) {
    return { kind: "NOT_FOUND" };
  }
  return { kind: "READY", payload: prepareMealContextLab() };
}
