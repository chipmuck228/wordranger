import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CONTEXT_LAB_HREF,
  DAILY_TRAINING_HREF,
  resolveHomeLearningPaths,
} from "@/server/home/resolve-home-learning-paths";

const source = readFileSync(
  "src/server/home/resolve-home-learning-paths.ts",
  "utf8",
);

describe("Homepage learning-path projection", () => {
  it("keeps Daily Training as the only primary entry", () => {
    expect(resolveHomeLearningPaths().primaryHref).toBe(DAILY_TRAINING_HREF);
    expect(DAILY_TRAINING_HREF).toBe("/train");
  });

  it("does not read Context Lab availability", () => {
    expect(source).not.toContain("isContextLabEnabled");
    expect(source).not.toContain("CONTEXT_LAB_ENABLED");
    expect(source).not.toContain("CONTEXT_LAB_RUNTIME");
    expect(source).not.toContain("resolveContextLab");
    expect(CONTEXT_LAB_HREF).toBe("/play/context-lab");
  });
});
