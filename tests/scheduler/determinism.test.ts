import { describe, expect, it } from "vitest";
import { DeterministicScheduler } from "@/domain/scheduler";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import {
  MasteryStage,
  VocabularySkill,
  WeaknessType,
  makeLexeme,
  makeModel,
  makeWeakness,
  sequentialIdFactory,
  NOW,
  USER_ID,
} from "./helpers";

describe("Scheduler determinism", () => {
  const models = [
    makeModel("a", {
      masteryStage: MasteryStage.CONNECTED,
      weaknesses: [
        makeWeakness({ id: "wa", type: WeaknessType.SPELLING, severity: 0.7 }),
      ],
    }),
    makeModel("b", {
      masteryStage: MasteryStage.CONNECTED,
      weaknesses: [
        makeWeakness({ id: "wb", type: WeaknessType.SPELLING, severity: 0.7 }),
      ],
    }),
    makeModel("c", {
      masteryStage: MasteryStage.EXPOSED,
    }),
  ];
  const lexemes = [makeLexeme("a", 1), makeLexeme("b", 2), makeLexeme("c", 3)];

  function run(seed: string) {
    return new DeterministicScheduler().planSession({
      userId: USER_ID,
      now: NOW,
      lexemes,
      models,
      recentActivity: [],
      requestedNeedCount: 3,
      createId: sequentialIdFactory(`id-${seed}`),
      random: new SeededRandomSource(seed),
    });
  }

  it("DET1: same inputs yield the same selected needs in the same order", () => {
    const first = run("seed-a");
    const second = run("seed-a");
    expect(second.needs.map((need) => `${need.lexemeId}:${need.targetSkill}:${need.reason}`)).toEqual(
      first.needs.map((need) => `${need.lexemeId}:${need.targetSkill}:${need.reason}`),
    );
    expect(second.trace.selectedCandidates.map((item) => item.priorityBreakdown)).toEqual(
      first.trace.selectedCandidates.map((item) => item.priorityBreakdown),
    );
  });

  it("DET2: different seed does not change core priority scores", () => {
    const first = run("seed-a");
    const second = run("seed-b");
    const scoresA = first.trace.selectedCandidates
      .map((item) => item.priorityBreakdown?.finalRawScore)
      .sort();
    const scoresB = second.trace.selectedCandidates
      .map((item) => item.priorityBreakdown?.finalRawScore)
      .sort();
    expect(scoresB).toEqual(scoresA);
    const breakdownA = first.trace.selectedCandidates.find(
      (item) => item.lexemeId === "a" && item.skill === VocabularySkill.SPELLING_RECALL,
    )?.priorityBreakdown;
    const breakdownB = second.trace.selectedCandidates.find(
      (item) => item.lexemeId === "a" && item.skill === VocabularySkill.SPELLING_RECALL,
    )?.priorityBreakdown;
    expect(breakdownB).toEqual(breakdownA);
  });
});
