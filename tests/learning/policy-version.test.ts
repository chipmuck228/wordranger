import { describe, expect, it } from "vitest";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { DEFAULT_LEARNING_POLICY } from "@/domain/learning/policies/default-learning-policy";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { makeEvidence } from "./helpers";

const T0 = "2026-03-01T09:00:00.000Z";

describe("policyVersion on StudentLexemeModel", () => {
  it("records policy.version v1 on the snapshot", async () => {
    const result = await processEvidence({
      evidence: makeEvidence("pv1", "s1", T0),
      repository: new InMemoryLearningRepository(),
      policy: DEFAULT_LEARNING_POLICY,
    });
    expect(result.model.policyVersion).toBe("v1");
  });

  it("records a custom policy version on the snapshot", async () => {
    const result = await processEvidence({
      evidence: makeEvidence("pv2", "s1", T0),
      repository: new InMemoryLearningRepository(),
      policy: { ...DEFAULT_LEARNING_POLICY, version: "test-v2" },
    });
    expect(result.model.policyVersion).toBe("test-v2");
  });
});
