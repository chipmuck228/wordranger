import { describe, expect, it } from "vitest";
import {
  MappedLearningContentCapability,
  SchedulerBlockedReason,
  lexemeCapability,
} from "@/domain/scheduler";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import {
  MasteryStage,
  RetentionState,
  makeLexeme,
  makeModel,
  makeWeakness,
  plan,
} from "./helpers";

const PRACTICED = [
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
];

function fadingModel(skillScores: {
  active: number;
  spelling: number;
  semantic?: { score: number; attempts: number };
}) {
  return makeModel("fade", {
    masteryStage: MasteryStage.MASTERED,
    retentionState: RetentionState.FADING,
    nextReviewAt: null,
    skillScores: {
      [VocabularySkill.MEANING_RECOGNITION]: {
        score: 0.9,
        confidence: 0.8,
        attempts: 8,
      },
      [VocabularySkill.ACTIVE_RECALL]: {
        score: skillScores.active,
        confidence: 0.4,
        attempts: 6,
      },
      [VocabularySkill.SPELLING_RECALL]: {
        score: skillScores.spelling,
        confidence: 0.4,
        attempts: 6,
      },
      ...(skillScores.semantic
        ? {
            [VocabularySkill.SEMANTIC_CONNECTION]: {
              score: skillScores.semantic.score,
              confidence: 0.3,
              attempts: skillScores.semantic.attempts,
            },
          }
        : {}),
    },
    weaknesses: [
      makeWeakness({
        id: "w-context",
        type: WeaknessType.CONTEXT,
        severity: 0.9,
      }),
    ],
  });
}

function capability(supported: VocabularySkill[]) {
  return new MappedLearningContentCapability(
    new Map([
      [
        "fade",
        lexemeCapability({
          lexemeId: "fade",
          supportedSkills: supported,
          reasons: {
            [VocabularySkill.CONTEXT_USE]: [
              "Context content is not available in V1",
            ],
            ...(supported.includes(VocabularySkill.SEMANTIC_CONNECTION)
              ? {}
              : {
                  [VocabularySkill.SEMANTIC_CONNECTION]: [
                    "No production-approved relation available for SEMANTIC_CONNECTION",
                  ],
                }),
          },
        }),
      ],
    ]),
  );
}

describe("FADING recovery fallback", () => {
  it("FH1: blocked CONTEXT_USE remains and SPELLING fallback is generated", () => {
    const result = plan({
      lexemes: [makeLexeme("fade")],
      models: [fadingModel({ active: 0.8, spelling: 0.3 })],
      capability: capability(PRACTICED),
      requestedNeedCount: 5,
    });
    const blocked = result.trace.blockedCandidates.find(
      (item) =>
        item.reason === "FADING" &&
        item.skill === VocabularySkill.CONTEXT_USE,
    );
    expect(blocked?.blockedReason).toBe(
      SchedulerBlockedReason.UNSUPPORTED_CONTENT_CAPABILITY,
    );
    const fallback = [...result.trace.generatedCandidates, ...result.needs].find(
      (item) =>
        "targetSkill" in item
          ? item.reason === "FADING" &&
            item.targetSkill === VocabularySkill.SPELLING_RECALL
          : item.reason === "FADING" &&
            item.skill === VocabularySkill.SPELLING_RECALL,
    );
    expect(fallback).toBeTruthy();
    const selected = result.needs.find(
      (need) =>
        need.reason === "FADING" &&
        need.targetSkill === VocabularySkill.SPELLING_RECALL,
    );
    expect(selected).toBeTruthy();
    const generatedFallback = result.trace.generatedCandidates.find(
      (item) =>
        item.reason === "FADING" &&
        item.skill === VocabularySkill.SPELLING_RECALL,
    );
    expect(generatedFallback?.sourceRuleId).toBe("FADING_RECOVERY_FALLBACK");
    expect(generatedFallback?.explanation).toMatch(/CONTEXT_USE/);
  });

  it("FH2: weaker ACTIVE_RECALL is chosen over SPELLING_RECALL", () => {
    const result = plan({
      lexemes: [makeLexeme("fade")],
      models: [fadingModel({ active: 0.2, spelling: 0.8 })],
      capability: capability(PRACTICED),
      requestedNeedCount: 5,
    });
    const fadingNeed = result.needs.find((need) => need.reason === "FADING");
    expect(fadingNeed?.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
  });

  it("FH3: SEMANTIC_CONNECTION is only chosen when the lexeme supports it", () => {
    const unsupported = plan({
      lexemes: [makeLexeme("fade")],
      models: [
        fadingModel({
          active: 0.8,
          spelling: 0.8,
          semantic: { score: 0.1, attempts: 8 },
        }),
      ],
      capability: capability(PRACTICED),
      requestedNeedCount: 5,
    });
    expect(
      unsupported.needs.some(
        (need) =>
          need.reason === "FADING" &&
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(false);

    const supported = plan({
      lexemes: [makeLexeme("fade")],
      models: [
        fadingModel({
          active: 0.8,
          spelling: 0.8,
          semantic: { score: 0.1, attempts: 8 },
        }),
      ],
      capability: capability([...PRACTICED, VocabularySkill.SEMANTIC_CONNECTION]),
      requestedNeedCount: 5,
    });
    expect(
      supported.needs.some(
        (need) =>
          need.reason === "FADING" &&
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
  });

  it("FH4: no fake fallback when no supported recovery skill exists", () => {
    const result = plan({
      lexemes: [makeLexeme("fade")],
      models: [fadingModel({ active: 0.2, spelling: 0.3 })],
      capability: capability([]),
      requestedNeedCount: 5,
    });
    expect(
      result.trace.blockedCandidates.some(
        (item) =>
          item.reason === "FADING" &&
          item.skill === VocabularySkill.CONTEXT_USE,
      ),
    ).toBe(true);
    expect(
      result.trace.generatedCandidates.some(
        (item) =>
          item.reason === "FADING" &&
          item.sourceRuleId === "FADING_RECOVERY_FALLBACK",
      ),
    ).toBe(false);
    expect(result.needs.some((need) => need.reason === "FADING")).toBe(false);
  });
});
