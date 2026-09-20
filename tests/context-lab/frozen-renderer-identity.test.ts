import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RANGER_TRIAL_GAME_ID } from "@/server/auth/v1-user";
import { CONTEXT_LAB_FROZEN_RENDERER_GAME_ID } from "@/server/context-lab/context-lab-frozen-renderer";

describe("Context Lab frozen renderer identity", () => {
  it("uses the Ranger Trial text-input renderer and its game ID", () => {
    const preview = readFileSync(
      join(process.cwd(), "src/components/context-lab/FrozenTaskPreview.tsx"),
      "utf8",
    );
    expect(preview).toContain("TextInputTaskRenderer");
    expect(preview).toContain("@/components/game/ranger-trial/TextInputTaskRenderer");
    expect(preview).not.toContain("英文答案预览");
    expect(CONTEXT_LAB_FROZEN_RENDERER_GAME_ID).toBe(RANGER_TRIAL_GAME_ID);
    expect(CONTEXT_LAB_FROZEN_RENDERER_GAME_ID).not.toBe("CONTEXT_LAB");
  });
});
