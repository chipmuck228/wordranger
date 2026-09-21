import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RUNTIME_FILES = [
  "src/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans.ts",
  "src/contextual-learning/candidate-v0/build/queue.ts",
  "src/contextual-learning/candidate-v0/strengthen/queue.ts",
  "src/server/context-lab/meal-context-lab-controller.ts",
  "src/server/context-lab/present-context-lab-screen.ts",
  "src/components/context-lab/GuidedActivityPanel.tsx",
  "src/app/play/context-lab/context-lab-client.tsx",
];

const FORBIDDEN = [/"soup"/, /"bowl"/, /"spoon"/, /"fork"/];

const CANDIDATE_IMPORT_FILES = [
  "src/contextual-learning/candidate-v0/content/validate-scene-content.ts",
  "src/contextual-learning/candidate-v0/content/resolve-scene-content.ts",
  "src/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans.ts",
  "src/contextual-learning/candidate-v0/content/project-from-resolved.ts",
];

describe("runtime engines do not hardcode Meal words", () => {
  it("keeps generic runtime files free of soup/bowl/spoon/fork switches", () => {
    for (const file of RUNTIME_FILES) {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(source, `${file} must not contain ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("does not import processEvidence or construct Evidence in Candidate content/runtime", () => {
    for (const file of CANDIDATE_IMPORT_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/processEvidence/);
      expect(source).not.toMatch(/createEvidence|LearningEvidence/);
    }
  });
});
