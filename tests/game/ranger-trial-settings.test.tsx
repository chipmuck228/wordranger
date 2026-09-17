/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RangerTrialSettingsPanel } from "@/components/game/ranger-trial/RangerTrialSettingsPanel";
import {
  DEFAULT_RANGER_TRIAL_UI_SETTINGS,
  loadRangerTrialSettings,
  saveRangerTrialSettings,
} from "@/components/game/ranger-trial/ranger-trial-settings";
import { readFileSync } from "node:fs";
import path from "node:path";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Ranger Trial UI pilot settings", () => {
  it("persists motion locally and does not touch learner state", () => {
    expect(loadRangerTrialSettings()).toEqual(DEFAULT_RANGER_TRIAL_UI_SETTINGS);
    saveRangerTrialSettings({ motionEnabled: false });
    expect(loadRangerTrialSettings()).toEqual({ motionEnabled: false });
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/components/game/ranger-trial/ranger-trial-settings.ts",
      ),
      "utf8",
    );
    expect(source).toContain("localStorage");
    expect(source).not.toContain("StudentLexemeModel");
    expect(source).not.toContain("LearningEvidence");
    expect(source).not.toContain("createClient");
  });

  it("is visible without auth and documents future admin-only access", async () => {
    const user = userEvent.setup();
    let settings = { motionEnabled: true };
    render(
      <RangerTrialSettingsPanel
        settings={settings}
        onChange={(next) => {
          settings = next;
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();
    expect(screen.getByText(/目前对所有人开放/)).toBeTruthy();
    expect(screen.getByText(/8 题/)).toBeTruthy();
    await user.click(screen.getByRole("switch", { name: "界面动画" }));
    expect(settings.motionEnabled).toBe(false);
    const client = readFileSync(
      path.join(process.cwd(), "src/app/play/ranger-trial/ranger-trial-play-client.tsx"),
      "utf8",
    );
    expect(client).toContain("设置");
    expect(client).not.toContain("TaskAnswerKey");
    expect(client).not.toContain("userId");
    const training = readFileSync(
      path.join(process.cwd(), "src/components/training/TrainingRenderer.tsx"),
      "utf8",
    );
    expect(training).toContain("RangerTrial");
    expect(training).toContain("showProgress={false}");
    expect(training).not.toContain("RangerTrialSettingsPanel");
    expect(training).not.toContain("ranger-trial-pilot");
  });
});
