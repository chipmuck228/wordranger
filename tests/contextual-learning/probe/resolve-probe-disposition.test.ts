import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { resolveProbeDisposition } from "@/contextual-learning/candidate-v0/probe/resolve-probe-disposition";
import { planningIntentFromProbeDisposition } from "@/contextual-learning/candidate-v0/probe/planning-from-disposition";
import type { ProbeObservationRef } from "@/contextual-learning/candidate-v0/probe/types";

const target = {
  lexemeId: BUNDLED_SPOON_LEXEME_ID,
  senseId: MEAL_SENSE.spoon.senseId,
};

function observation(
  skill: ProbeObservationRef["skill"],
  outcome: EvidenceOutcome,
  extras: Partial<ProbeObservationRef> = {},
): ProbeObservationRef {
  return {
    target,
    skill,
    taskId: `task-${skill}`,
    evidenceId: `ev-${skill}`,
    outcome,
    ...extras,
  };
}

describe("resolveProbeDisposition", () => {
  it("routes recognition incorrect to BUILD", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT)],
    });
    expect(result.disposition).toBe("BUILD");
  });

  it("routes recognition assisted to STRENGTHEN", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.ASSISTED_CORRECT),
      ],
    });
    expect(result.disposition).toBe("STRENGTHEN");
  });

  it("routes independent recognition + recall wrong to STRENGTHEN", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
      ],
    });
    expect(result.disposition).toBe("STRENGTHEN");
  });

  it("routes two independent outcomes to READY without claiming mastery", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
      ],
    });
    expect(result.disposition).toBe("READY");
    expect(result.reason).not.toMatch(/mastery/i);
    expect(JSON.stringify(result)).not.toContain("masteryStage");
  });

  it("returns UNRESOLVED for missing or conflicting observations", () => {
    expect(
      resolveProbeDisposition({ target, observations: [] }).disposition,
    ).toBe("UNRESOLVED");
    expect(
      resolveProbeDisposition({
        target,
        observations: [
          observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
          observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT, {
            taskId: "other",
          }),
        ],
      }).disposition,
    ).toBe("UNRESOLVED");
  });

  it("returns UNRESOLVED when the observation target does not match", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT, {
          target: { lexemeId: "other", senseId: target.senseId },
        }),
      ],
    });
    expect(result.disposition).toBe("UNRESOLVED");
  });

  it("does not mutate frozen observation objects", () => {
    const observations = [
      observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
    ];
    const before = structuredClone(observations);
    resolveProbeDisposition({ target, observations });
    expect(observations).toEqual(before);
  });
});

describe("planningIntentFromProbeDisposition", () => {
  it("converts BUILD and STRENGTHEN and refuses READY/UNRESOLVED", () => {
    const build = resolveProbeDisposition({
      target,
      observations: [observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT)],
    });
    expect(planningIntentFromProbeDisposition(build, target)).toEqual({
      ok: true,
      mode: "BUILD",
    });
    const strengthen = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.ASSISTED_CORRECT),
      ],
    });
    expect(planningIntentFromProbeDisposition(strengthen, target)).toEqual({
      ok: true,
      mode: "STRENGTHEN",
    });
    const ready = resolveProbeDisposition({
      target,
      observations: [
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
      ],
    });
    expect(planningIntentFromProbeDisposition(ready, target).ok).toBe(false);
    expect(
      planningIntentFromProbeDisposition(build, {
        lexemeId: "other",
        senseId: target.senseId,
      }).ok,
    ).toBe(false);
  });
});
