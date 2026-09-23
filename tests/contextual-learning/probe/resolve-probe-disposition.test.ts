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
  it("routes independent recall to READY without recognition", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT)],
    });
    expect(result.disposition).toBe("READY");
    expect(result.reason).toBe("PROBE_INDEPENDENT_RECALL");
    expect(result.reason).not.toMatch(/mastery/i);
  });

  it("returns UNRESOLVED when independent recall is followed by recognition", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
      ],
    });
    expect(result.disposition).toBe("UNRESOLVED");
    expect(result.reason).toBe("PROBE_RECOGNITION_AFTER_INDEPENDENT_RECALL");
  });

  it("routes failed recall + independent recognition to STRENGTHEN", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
      ],
    });
    expect(result.disposition).toBe("STRENGTHEN");
  });

  it("routes timeout recall + assisted recognition to STRENGTHEN", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.TIMEOUT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.ASSISTED_CORRECT),
      ],
    });
    expect(result.disposition).toBe("STRENGTHEN");
  });

  it("routes failed recall + failed recognition to BUILD", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
      ],
    });
    expect(result.disposition).toBe("BUILD");
  });

  it("routes skipped recall + timeout recognition to BUILD", () => {
    const result = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.SKIPPED),
        observation("MEANING_RECOGNITION", EvidenceOutcome.TIMEOUT),
      ],
    });
    expect(result.disposition).toBe("BUILD");
  });

  it("returns UNRESOLVED when recall is missing", () => {
    expect(
      resolveProbeDisposition({
        target,
        observations: [
          observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
        ],
      }).disposition,
    ).toBe("UNRESOLVED");
  });

  it("returns UNRESOLVED when failed recall has no recognition", () => {
    expect(
      resolveProbeDisposition({
        target,
        observations: [observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT)],
      }).reason,
    ).toBe("PROBE_MISSING_RECOGNITION_AFTER_FAILED_RECALL");
  });

  it("returns UNRESOLVED for conflicting task IDs", () => {
    expect(
      resolveProbeDisposition({
        target,
        observations: [
          observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT, {
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
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT, {
          target: { lexemeId: "other", senseId: target.senseId },
        }),
      ],
    });
    expect(result.disposition).toBe("UNRESOLVED");
  });

  it("does not mutate frozen observation objects", () => {
    const observations = [
      observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
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
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
      ],
    });
    expect(planningIntentFromProbeDisposition(build, target)).toEqual({
      ok: true,
      mode: "BUILD",
    });
    const strengthen = resolveProbeDisposition({
      target,
      observations: [
        observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
        observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
      ],
    });
    expect(planningIntentFromProbeDisposition(strengthen, target)).toEqual({
      ok: true,
      mode: "STRENGTHEN",
    });
    const ready = resolveProbeDisposition({
      target,
      observations: [observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT)],
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
