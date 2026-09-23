import { describe, expect, it, vi } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { InMemoryFreePracticePlanReadAdapter } from "@/server/free-practice/planning/in-memory-plan-read-adapter";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { planFreePractice } from "@/server/free-practice/planning/plan-free-practice";
import { tinyDataset } from "../../tasks/helpers";
import {
  assertPlanPayload,
  evidence,
  makeTestLexeme,
  sequentialIds,
  snapshot,
  USER_A,
  USER_B,
} from "./helpers";

describe("Free Practice planner isolation and read-only boundary", () => {
  it("keeps user A and user B query results isolated", async () => {
    const read = new InMemoryFreePracticePlanReadAdapter();
    read.seedSnapshots(USER_A, [snapshot("shared", MasteryStage.EXPOSED)]);
    read.seedSnapshots(USER_B, []);
    read.seedEvidence(USER_A, [
      evidence({
        id: "a-1",
        lexemeId: "shared",
        outcome: EvidenceOutcome.INCORRECT,
        occurredAt: "2026-09-20T12:00:00.000Z",
      }),
    ]);
    read.seedEvidence(USER_B, [
      evidence({
        id: "b-1",
        lexemeId: "shared",
        outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
        occurredAt: "2026-09-20T13:00:00.000Z",
      }),
    ]);
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [makeTestLexeme({ id: "shared" })] }),
    );

    const forA = await planFreePractice({
      userId: USER_A,
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      vocabulary,
      read,
      createId: sequentialIds("a"),
    });
    const forB = await planFreePractice({
      userId: USER_B,
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      vocabulary,
      read,
      createId: sequentialIds("b"),
    });

    expect(forA.status).toBe("PARTIAL");
    if (forA.status !== "REJECTED") {
      expect(forA.items.map((item) => item.lexemeId)).toEqual(["shared"]);
    }
    expect(forB.status).toBe("EMPTY");
    assertPlanPayload(forA);
    assertPlanPayload(forB);
  });

  it("does not call Scheduler, Need Generator, or TaskGenerator", async () => {
    const scheduler = await import("@/server/scheduler/plan-learning-session");
    const need = await import("@/domain/scheduler/learning-need-generator");
    const task = await import("@/domain/tasks/default-task-generator");
    const planSpy = vi.spyOn(scheduler, "planLearningSession");
    const needSpy = vi.spyOn(need, "DefaultLearningNeedGenerator");
    const taskSpy = vi.spyOn(task, "DefaultTaskGenerator");

    const read = new InMemoryFreePracticePlanReadAdapter();
    await planFreePractice({
      userId: USER_A,
      request: { source: "UNSEEN", requestedCount: 5 },
      vocabulary: new InMemoryVocabularyRepository(
        tinyDataset({ lexemes: [makeTestLexeme({ id: "a" })] }),
      ),
      read,
      createId: sequentialIds(),
    });

    expect(planSpy).not.toHaveBeenCalled();
    expect(needSpy).not.toHaveBeenCalled();
    expect(taskSpy).not.toHaveBeenCalled();
    planSpy.mockRestore();
    needSpy.mockRestore();
    taskSpy.mockRestore();
  });

  it("planner and read adapter stay read-only", async () => {
    const read = new InMemoryFreePracticePlanReadAdapter();
    const writeNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(read),
    ).filter((name) =>
      /append|insert|update|delete|save|commit|write/i.test(name),
    );
    expect(writeNames).toEqual([]);
    expect(read.writeAttempts).toBe(0);

    await planFreePractice({
      userId: USER_A,
      request: { source: "UNSEEN", requestedCount: 5 },
      vocabulary: new InMemoryVocabularyRepository(
        tinyDataset({ lexemes: [makeTestLexeme({ id: "a" })] }),
      ),
      read,
      createId: sequentialIds(),
    });
    expect(read.writeAttempts).toBe(0);
  });

  it("result items do not include Evidence, model, or Scheduler fields", async () => {
    const read = new InMemoryFreePracticePlanReadAdapter();
    read.seedEvidence(USER_A, [
      evidence({
        id: "ev-1",
        lexemeId: "a",
        skill: VocabularySkill.MEANING_RECOGNITION,
        outcome: EvidenceOutcome.INCORRECT,
      }),
    ]);
    const result = await planFreePractice({
      userId: USER_A,
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      vocabulary: new InMemoryVocabularyRepository(
        tinyDataset({ lexemes: [makeTestLexeme({ id: "a" })] }),
      ),
      read,
      createId: sequentialIds(),
    });
    assertPlanPayload(result);
    expect(JSON.stringify(result)).not.toContain("ev-1");
    expect(JSON.stringify(result)).not.toContain("occurredAt");
    expect(JSON.stringify(result)).not.toContain("outcome");
  });
});
