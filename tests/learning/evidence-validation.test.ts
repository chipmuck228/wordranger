import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { LearningDomainError } from "@/domain/learning/engine/math";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { makeEvidence } from "./helpers";

const T0 = "2026-03-01T09:00:00.000Z";

describe("Evidence semantic validation", () => {
  it("rejects INDEPENDENT_CORRECT with hintCount 1", async () => {
    await expect(
      processEvidence({
        evidence: makeEvidence("ind-hint", "s1", T0, {
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          hintCount: 1,
        }),
        repository: new InMemoryLearningRepository(),
      }),
    ).rejects.toBeInstanceOf(LearningDomainError);
  });

  it("rejects ASSISTED_CORRECT with hintCount 0", async () => {
    await expect(
      processEvidence({
        evidence: makeEvidence("ast-no-hint", "s1", T0, {
          outcome: EvidenceOutcome.ASSISTED_CORRECT,
          hintCount: 0,
        }),
        repository: new InMemoryLearningRepository(),
      }),
    ).rejects.toThrow(/ASSISTED_CORRECT/);
  });

  it("does not include CORRECT in EvidenceOutcome", () => {
    expect(Object.values(EvidenceOutcome)).not.toContain("CORRECT");
    expect(Object.keys(EvidenceOutcome)).not.toContain("CORRECT");
  });
});
