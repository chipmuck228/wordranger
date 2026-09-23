import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { cleanupContextualContentTestWorkspace } from "../tests/contextual-content-workspace";
import { ORDINARY_E2E_WORKSPACE_STATE } from "./ordinary-contextual-workspace";

export default async function globalTeardown(): Promise<void> {
  if (process.env.CONTEXT_LAB_REAL_RELEASE_E2E === "1") {
    return;
  }
  if (!existsSync(ORDINARY_E2E_WORKSPACE_STATE)) {
    return;
  }
  const state = JSON.parse(readFileSync(ORDINARY_E2E_WORKSPACE_STATE, "utf8")) as {
    root: string;
    token: string;
  };
  cleanupContextualContentTestWorkspace(state);
  unlinkSync(ORDINARY_E2E_WORKSPACE_STATE);
}
