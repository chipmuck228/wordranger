import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_PLACEMENT_READINESS,
  assessAdaptivePlacementReadiness,
} from "@/domain/vocabulary/adaptive-placement-readiness";
import { placementField } from "@/domain/vocabulary/placement-metadata";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory } from "../learning/helpers";
import { CountingVocabularyRepository } from "../scheduler/counting-vocabulary-repository";

const dataset = loadVocabularyDataset();

describe("Adaptive placement readiness gate", () => {
  it("A1: production metadata is PLACEMENT_DATA_BLOCKER and does not fall back to sourceIndex difficulty", async () => {
    const listed = await new InMemoryVocabularyRepository(
      dataset,
    ).listPlacementMetadata();
    const readiness = assessAdaptivePlacementReadiness(
      listed,
      dataset.lexemes.length,
    );
    expect(readiness.status).toBe(
      ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
    );
    expect(readiness.primaryAxis).toBeNull();
    expect(readiness.coverage).toBe(0);
    expect(readiness.reasons.join(" ")).toMatch(/curriculumBand/);
    expect(readiness.reasons.join(" ")).toMatch(/sourceIndex/);
    expect(readiness.reasons.join(" ")).toMatch(/alphabeticalSection/);
    expect(readiness.reasons.join(" ")).toMatch(/starred/);
    expect(readiness.reasons.join(" ")).toMatch(/functionWord/);

    expect(listed.some((record) => record.curriculumBand)).toBe(false);
    expect(listed.some((record) => record.gradeBand)).toBe(false);
    expect(listed.some((record) => record.frequencyBand)).toBe(false);
    expect(listed.some((record) => record.difficultyBand)).toBe(false);
    expect(listed.some((record) => record.starred)).toBe(true);
    expect(listed.some((record) => record.alphabeticalSection)).toBe(true);

    const counted = new CountingVocabularyRepository(
      new InMemoryVocabularyRepository(dataset),
    );
    const plan = await planLearningSession({
      userId: "placement-blocker-user",
      now: "2026-09-17T12:00:00.000Z",
      requestedNeedCount: 8,
      createId: sequentialIdFactory("blk"),
      random: new SeededRandomSource("blocker"),
      vocabulary: counted,
      query: new InMemoryLearningStateQueryRepository(),
    });
    expect(counted.calls.listPlacementMetadata).toBe(0);
    expect(plan.needs.every((need) => need.reason === "NEW_WORD")).toBe(true);
    const unseen = dataset.lexemes
      .slice()
      .sort((left, right) => {
        if (left.sourceIndex !== right.sourceIndex) {
          return left.sourceIndex - right.sourceIndex;
        }
        return left.canonicalKey.localeCompare(right.canonicalKey);
      });
    expect(plan.needs[0]?.lexemeId).toBe(unseen[0]?.id);
  });

  it("A1b: SOURCE print facts and INFERRED functionWord cannot unlock the gate", () => {
    const readiness = assessAdaptivePlacementReadiness(
      [
        {
          lexemeId: "a",
          alphabeticalSection: placementField("A", "SOURCE", ["pdf.section"]),
          starred: placementField(true, "SOURCE", ["pdf.starred"]),
          functionWord: placementField(true, "INFERRED", [
            "canonical.partsOfSpeech",
          ]),
        },
        {
          lexemeId: "b",
          alphabeticalSection: placementField("M", "SOURCE", ["pdf.section"]),
          starred: placementField(false, "SOURCE", ["pdf.starred"]),
        },
        {
          lexemeId: "c",
          alphabeticalSection: placementField("Z", "SOURCE", ["pdf.section"]),
          starred: placementField(true, "SOURCE", ["pdf.starred"]),
        },
      ],
      3,
    );
    expect(readiness.status).toBe(
      ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
    );
  });

  it("A1c: INFERRED or SOURCE band fields are not production authority", () => {
    const inferred = assessAdaptivePlacementReadiness(
      [
        {
          lexemeId: "a",
          difficultyBand: placementField("FOUNDATION", "INFERRED", ["llm"], 0.9),
        },
        {
          lexemeId: "b",
          difficultyBand: placementField("MIDDLE", "INFERRED", ["llm"], 0.9),
        },
        {
          lexemeId: "c",
          difficultyBand: placementField("ADVANCED", "INFERRED", ["llm"], 0.9),
        },
      ],
      3,
    );
    expect(inferred.status).toBe(
      ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
    );
  });

  it("synthetic CURATED bands can pass the gate without writing production overlay", () => {
    const bands = ["FOUNDATION", "MIDDLE", "ADVANCED"] as const;
    const records = Array.from({ length: 10 }, (_, index) => ({
      lexemeId: `lex-${index}`,
      curriculumBand: placementField(
        bands[index % 3],
        "CURATED",
        ["test-fixture:not-production"],
        1,
      ),
    }));
    const readiness = assessAdaptivePlacementReadiness(records, 10);
    expect(readiness.status).toBe(ADAPTIVE_PLACEMENT_READINESS.READY);
    expect(readiness.primaryAxis).toBe("curriculumBand");
    expect(readiness.bandValues).toEqual(["ADVANCED", "FOUNDATION", "MIDDLE"]);
    expect(readiness.coverage).toBe(1);
  });
});
