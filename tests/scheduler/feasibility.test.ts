import { describe, expect, it } from "vitest";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { SchedulerBlockedReason } from "@/domain/scheduler";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { buildVocabularyLearningContentCapability } from "@/server/scheduler/vocabulary-learning-content-capability";
import {
  makeApprovedRelation,
  tinyDataset,
} from "../tasks/helpers";
import { sequentialIdFactory } from "../learning/helpers";
import { makeLexeme, makeModel, plan } from "./helpers";

describe("Scheduler lexeme feasibility", () => {
  it("blocks SEMANTIC_CONNECTION only for lexemes without approved relations", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [
          { id: "has-rel", lemma: "alpha", meaningsZh: ["甲"] },
          { id: "no-rel", lemma: "beta", meaningsZh: ["乙"] },
          { id: "other", lemma: "gamma", meaningsZh: ["丙"] },
        ],
        relations: [
          makeApprovedRelation({
            id: "rel-alpha",
            type: LexemeRelationType.SYNONYM,
            fromLexemeId: "has-rel",
            toLexemeId: "other",
          }),
        ],
      }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(
      capability.supports("has-rel", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(true);
    expect(
      capability.supports("no-rel", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(false);

    const result = plan({
      lexemes: [makeLexeme("has-rel", 1), makeLexeme("no-rel", 2)],
      models: [
        makeModel("has-rel", { masteryStage: MasteryStage.RECOGNIZED }),
        makeModel("no-rel", { masteryStage: MasteryStage.RECOGNIZED }),
      ],
      capability,
      requestedNeedCount: 6,
    });

    expect(
      result.needs.some(
        (need) =>
          need.lexemeId === "has-rel" &&
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
    expect(
      result.needs.some(
        (need) =>
          need.lexemeId === "no-rel" &&
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(false);
    const blocked = result.trace.blockedCandidates.find(
      (item) =>
        item.lexemeId === "no-rel" &&
        item.skill === VocabularySkill.SEMANTIC_CONNECTION,
    );
    expect(blocked?.blockedReason).toBe(
      SchedulerBlockedReason.UNSUPPORTED_CONTENT_CAPABILITY,
    );
    expect(blocked?.capabilityReason).toMatch(/production-approved relation/i);
  });

  it("selected supported-skill needs generate tasks (test-level only)", async () => {
    const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    const result = plan({
      lexemes: [
        {
          id: quiet.id,
          sourceIndex: quiet.sourceIndex,
          canonicalKey: quiet.canonicalKey,
        },
      ],
      models: [
        makeModel(quiet.id, {
          masteryStage: MasteryStage.CONNECTED,
          nextReviewAt: "2026-09-01T00:00:00.000Z",
          skillScores: {
            [VocabularySkill.ACTIVE_RECALL]: { score: 0.3, confidence: 0.3 },
            [VocabularySkill.SPELLING_RECALL]: { score: 0.6, confidence: 0.4 },
            [VocabularySkill.MEANING_RECOGNITION]: { score: 0.8, confidence: 0.7 },
          },
        }),
      ],
      capability,
      requestedNeedCount: 4,
    });
    expect(result.needs.length).toBeGreaterThan(0);
    const generator = new DefaultTaskGenerator(vocabulary);
    const supported = new Set([
      VocabularySkill.MEANING_RECOGNITION,
      VocabularySkill.SEMANTIC_CONNECTION,
      VocabularySkill.ACTIVE_RECALL,
      VocabularySkill.SPELLING_RECALL,
    ]);
    for (const need of result.needs) {
      if (!supported.has(need.targetSkill)) {
        continue;
      }
      const generated = await generator.generate({
        need,
        desiredDifficulty: 0.45,
        recentTasks: [],
        now: "2026-09-16T12:00:00.000Z",
        createId: sequentialIdFactory(`feas-${need.id}`),
        random: new SeededRandomSource(`feas-${need.id}`),
      });
      expect(generated.status, `${need.targetSkill} ${need.reason}`).toBe(
        "GENERATED",
      );
    }
  });
});
