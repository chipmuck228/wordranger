import { describe, expect, it } from "vitest";
import {
  CONTEXT_LAB_HREF,
  DAILY_TRAINING_HREF,
  resolveHomeLearningPaths,
  resolveSceneLearningAvailability,
} from "@/server/home/resolve-home-learning-paths";

const preparing = { status: "preparing" as const };
const ready = { status: "ready" as const, href: CONTEXT_LAB_HREF };

describe("Homepage learning-path projection", () => {
  it("keeps Daily Training as the only primary entry", () => {
    expect(resolveHomeLearningPaths({}).primaryHref).toBe(DAILY_TRAINING_HREF);
    expect(DAILY_TRAINING_HREF).toBe("/train");
  });

  it("keeps scene learning unclickable when Context Lab is off", () => {
    expect(resolveSceneLearningAvailability({})).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({ CONTEXT_LAB_ENABLED: "true" }),
    ).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({ CONTEXT_LAB_ENABLED: "0" }),
    ).toEqual(preparing);
  });

  it("fail-closes when the lab is enabled but runtime is unset", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
      }),
    ).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
      }),
    ).toEqual(preparing);
  });

  it("fail-closes an invalid runtime", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "maps",
      }),
    ).toEqual(preparing);
  });

  it("marks local static + memory as ready", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toEqual(ready);
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toEqual(ready);
  });

  it("rejects memory on Vercel production and preview", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "memory",
        VERCEL_ENV: "production",
      }),
    ).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "memory",
        VERCEL_ENV: "preview",
      }),
    ).toEqual(preparing);
  });

  it("does not guess active-release or supabase startability", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "active-release",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "supabase",
      }),
    ).toEqual(preparing);
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toEqual(preparing);
  });

  it("fail-closes invalid content sources even with a legal runtime", () => {
    expect(
      resolveSceneLearningAvailability({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "latest",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toEqual(preparing);
  });
});
