import { describe, expect, it } from "vitest";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { auditSceneVocabularyCoverage } from "@/contextual-learning/candidate-v0/memory-routing/audit-scene-vocabulary-coverage";
import {
  MEAL_SCENE_CLUSTER,
  SCENE_VOCABULARY_CLUSTERS,
} from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { BUNDLED_VOCABULARY_PROVENANCE } from "@/contextual-learning/candidate-v0/memory-routing/types";
import type { SceneVocabularyCluster } from "@/contextual-learning/candidate-v0/memory-routing/types";

describe("scene vocabulary coverage auditor", () => {
  it("counts the real bundled vocabulary and does not require 100% coverage", () => {
    const dataset = loadVocabularyDataset();
    const report = auditSceneVocabularyCoverage(dataset.lexemes, SCENE_VOCABULARY_CLUSTERS);

    expect(report.vocabularyVersion).toBe(BUNDLED_VOCABULARY_PROVENANCE);
    expect(report.totalLexemes).toBe(dataset.lexemes.length);
    expect(report.assignedLexemes + report.unassignedLexemes).toBe(
      report.totalLexemes,
    );
    expect(report.assignedLexemes).toBeGreaterThan(0);
    expect(report.unassignedLexemes).toBeGreaterThan(0);
    expect(report.invalidAssignments).toEqual([]);
    expect(report.assignedLexemes + report.unassignedLexemes).not.toBe(0);
    expect(report.unassignedLexemes).not.toBe(0);
  });

  it("keeps unassigned lexemes visible and treats sense ambiguity as a separate axis", () => {
    const dataset = loadVocabularyDataset();
    const report = auditSceneVocabularyCoverage(dataset.lexemes, SCENE_VOCABULARY_CLUSTERS);
    const assignedIds = new Set(
      SCENE_VOCABULARY_CLUSTERS.flatMap((cluster) =>
        cluster.members.map((member) => member.target.lexemeId),
      ),
    );
    const expectedAmbiguous = dataset.lexemes.filter(
      (lexeme) => !assignedIds.has(lexeme.id) && lexeme.meaningsZh.length > 1,
    ).length;

    expect(report.ambiguousSenseLexemes).toBe(expectedAmbiguous);
    expect(report.unassignedLexemes).toBe(dataset.lexemes.length - assignedIds.size);
    expect(report.ambiguousSenseLexemes).toBeLessThanOrEqual(report.unassignedLexemes);
  });

  it("is deterministic", () => {
    const dataset = loadVocabularyDataset();
    const first = auditSceneVocabularyCoverage(dataset.lexemes, SCENE_VOCABULARY_CLUSTERS);
    const second = auditSceneVocabularyCoverage(
      [...dataset.lexemes].reverse(),
      [...SCENE_VOCABULARY_CLUSTERS].reverse(),
    );
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("does not let unknown lexeme IDs occupy assigned or unassigned counts", () => {
    const dataset = loadVocabularyDataset();
    const invalid: SceneVocabularyCluster = {
      ...MEAL_SCENE_CLUSTER,
      id: "unknowns-only",
      members: [
        {
          target: { lexemeId: "missing-a", senseId: "a#1" },
          lexemeCanonicalKey: "lex-missing-a",
          roleId: "EATING_TOOL",
          roleDescription: "invalid",
        },
        {
          target: { lexemeId: "missing-b", senseId: "b#1" },
          lexemeCanonicalKey: "lex-missing-b",
          roleId: "EATING_TOOL",
          roleDescription: "invalid",
        },
      ],
    };
    const report = auditSceneVocabularyCoverage(dataset.lexemes, [invalid]);
    expect(report.assignedLexemes).toBe(0);
    expect(report.unassignedLexemes).toBe(report.totalLexemes);
    expect(report.assignedLexemes + report.unassignedLexemes).toBe(
      report.totalLexemes,
    );
    expect(report.invalidAssignments.length).toBeGreaterThan(0);
  });

  it("fails closed on an invalid assignment", () => {
    const dataset = loadVocabularyDataset();
    const invalid: SceneVocabularyCluster = {
      ...MEAL_SCENE_CLUSTER,
      id: "invalid-assignment",
      members: [
        {
          target: { lexemeId: "missing-uuid", senseId: "x#y" },
          lexemeCanonicalKey: "lex-missing",
          roleId: "EATING_TOOL",
          roleDescription: "invalid",
        },
      ],
    };
    const report = auditSceneVocabularyCoverage(dataset.lexemes, [invalid]);
    expect(report.invalidAssignments.length).toBeGreaterThan(0);
    expect(
      report.invalidAssignments.some(
        (issue) => issue.code === "SCENE_MEMBER_UNKNOWN_LEXEME",
      ),
    ).toBe(true);
  });
});
