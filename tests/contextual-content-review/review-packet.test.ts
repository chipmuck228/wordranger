import { describe, expect, it } from "vitest";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { getApprovedExperimentSceneContent } from "@/contextual-learning/candidate-v0/content";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { fingerprintContent } from "@/server/contextual-content-review/fingerprint";
import { projectContentReviewPacket } from "@/server/contextual-content-review/project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import { generateMealBatch01CupReviewArtifacts } from "@/server/contextual-content-review/generate-review-artifacts";
import { renderHumanReviewMarkdown } from "@/server/contextual-content-review/human-review-markdown";
import { readFileSync } from "node:fs";

const spec = CONTENT_REVIEW_TARGETS[0]!;

function cupLexeme() {
  return MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.find(
    (lexeme) => lexeme.target.senseId === spec.target.senseId,
  )!;
}

describe("Content review packet projection", () => {
  it("reads the real Candidate pack and bundled vocabulary", () => {
    const packet = projectContentReviewPacket({ spec, writeEnabled: false });
    expect(packet).not.toBeNull();
    const bundled = bundledSceneLexemeLoader(packet!.target.canonicalKey);
    expect(packet!.pack.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id);
    expect(packet!.pack.registryStatus).toBe("CANDIDATE");
    expect(packet!.target.lexemeId).toBe(bundled!.id);
    expect(packet!.target.displayForm).toBe(bundled!.display.trim() || bundled!.lemma);
    expect(packet!.target.meaningsZh).toEqual([...bundled!.meaningsZh]);
    expect(packet!.target.phonetic).toBe(bundled!.ipa[0]);
    expect(packet!.reviewRevision).toBe(0);
  });

  it("keeps Home and Restaurant facts on their own frames", () => {
    const packet = projectContentReviewPacket({ spec, writeEnabled: false })!;
    const home = packet.frames.find((frame) => frame.frameId === "home-breakfast-v0")!;
    const restaurant = packet.frames.find((frame) => frame.frameId === "restaurant-meal-v0")!;
    expect(home.facts[0]?.factId).toBe("home-fact-contains-cup-drink");
    expect(home.entities.some((entity) => entity.entityId === "home-cup")).toBe(true);
    expect(restaurant.facts[0]?.factId).toBe("rest-fact-contains-cup-drink");
    expect(restaurant.entities.some((entity) => entity.entityId === "rest-cup")).toBe(true);
    expect(JSON.stringify(home.facts)).not.toContain("rest-fact-");
    expect(JSON.stringify(restaurant.facts)).not.toContain("home-fact-");
  });

  it("hides the target form in Probe and shows it in Teach", () => {
    const packet = projectContentReviewPacket({ spec, writeEnabled: false })!;
    const home = packet.frames[0]!;
    const probe = home.steps.find((step) => step.stage === "PROBE_ACTIVE_RECALL")!;
    const teach = home.steps.find((step) => step.stage === "BUILD_TEACH")!;
    const fade = home.steps.find((step) => step.stage === "BUILD_FADE")!;
    const recall = home.steps.find((step) => step.stage === "BUILD_VERIFY")!;
    expect(probe.student.presentation?.displayForm).toBeUndefined();
    expect(probe.student.instruction.toLowerCase()).not.toContain(packet.target.displayForm.toLowerCase());
    expect(teach.student.presentation?.displayForm).toBe(packet.target.displayForm);
    expect(fade.student.presentation?.displayForm).toBeUndefined();
    expect(fade.student.presentation?.spellingCue).toBeTruthy();
    expect(recall.student.presentation?.displayForm).toBeUndefined();
    expect(recall.student.instruction.toLowerCase()).not.toContain(
      packet.target.displayForm.toLowerCase(),
    );
  });

  it("keeps the frozen preview public and the generated manifest free of AnswerKey", async () => {
    const packet = projectContentReviewPacket({ spec, writeEnabled: false })!;
    const preview = packet.frames[0]!.steps.find((step) => step.title === "Frozen Task Preview");
    expect(preview, JSON.stringify(packet.frames[0]!.steps.map((step) => step.title))).toBeDefined();
    expect(
      preview?.student.frozenTaskPreview?.taskType,
      preview?.student.instruction,
    ).toBe("ACTIVE_RECALL_TYPING");
    expect(JSON.stringify(preview)).not.toMatch(/answerKey|correctCandidateIds|exactAcceptedTexts/i);
    await generateMealBatch01CupReviewArtifacts();
    const manifest = readFileSync(
      "docs/contextual-content-reviews/meal-expansion-batch-01-cup/REVIEW_MANIFEST.json",
      "utf8",
    );
    expect(manifest).not.toMatch(/answerKey|correctCandidateIds|Evidence|mastery|userId/);
    const approved = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(approved.ok && approved.pack.lexemes).toHaveLength(4);
  });

  it("writes HUMAN_REVIEW.md without trailing whitespace", () => {
    const pending = renderHumanReviewMarkdown({
      fingerprint: "abc",
      record: null,
    });
    for (const line of pending.split("\n")) {
      expect(line).toBe(line.trimEnd());
    }
    expect(pending).toContain("Reviewer:\n");
    expect(pending).toContain("Reviewed at:\n");
    const generated = readFileSync(
      "docs/contextual-content-reviews/meal-expansion-batch-01-cup/HUMAN_REVIEW.md",
      "utf8",
    );
    for (const line of generated.split("\n")) {
      expect(line).toBe(line.trimEnd());
    }
  });
});

describe("Content review fingerprint", () => {
  it("is stable for the same content and changes with copy, sense, or fact direction", () => {
    const lexeme = cupLexeme();
    const first = fingerprintContent({
      packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
      lexeme,
      sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
    });
    const second = fingerprintContent({
      packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
      lexeme,
      sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
    });
    expect(first).toBe(second);
    const copyChanged = structuredClone(lexeme);
    copyChanged.build.teachInstruction = `${copyChanged.build.teachInstruction} x`;
    expect(
      fingerprintContent({
        packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
        lexeme: copyChanged,
        sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
      }),
    ).not.toBe(first);
    const senseChanged = structuredClone(lexeme);
    senseChanged.target = { ...senseChanged.target, senseId: "other-sense" };
    expect(
      fingerprintContent({
        packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
        lexeme: senseChanged,
        sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
      }),
    ).not.toBe(first);
    const reversed = structuredClone(lexeme);
    reversed.grounding.frameFacts[0]!.facts[0]!.args = [
      ...reversed.grounding.frameFacts[0]!.facts[0]!.args,
    ].reverse();
    expect(
      fingerprintContent({
        packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
        lexeme: reversed,
        sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
      }),
    ).not.toBe(first);
    const packet = projectContentReviewPacket({ spec, writeEnabled: false })!;
    expect(packet.pack.contentFingerprint).toBe(first);
  });
});
