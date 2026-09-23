import { describe, expect, it } from "vitest";
import {
  CONTEXT_LAB_HREF,
  DAILY_TRAINING_HREF,
  resolveHomeLearningPaths,
  resolveSceneLearningAvailability,
} from "@/server/home/resolve-home-learning-paths";

describe("Homepage learning-path projection", () => {
  it("keeps Daily Training as the only primary entry", () => {
    expect(resolveHomeLearningPaths({}).primaryHref).toBe(DAILY_TRAINING_HREF);
    expect(DAILY_TRAINING_HREF).toBe("/train");
  });

  it("keeps scene learning unclickable when Context Lab is off", () => {
    expect(resolveSceneLearningAvailability({})).toEqual({ status: "preparing" });
    expect(
      resolveSceneLearningAvailability({ CONTEXT_LAB_ENABLED: "true" }),
    ).toEqual({ status: "preparing" });
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "active-release",
      }),
    ).toEqual({ status: "preparing" });
  });

  it("exposes Context Lab only for an explicit static source", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
      }),
    ).toEqual({ status: "ready", href: CONTEXT_LAB_HREF });
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
      }),
    ).toEqual({ status: "ready", href: CONTEXT_LAB_HREF });
  });

  it("fail-closes invalid or unverifiable content sources", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "latest",
      }),
    ).toEqual({ status: "preparing" });
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "active-release",
      }),
    ).toEqual({ status: "preparing" });
  });
});
