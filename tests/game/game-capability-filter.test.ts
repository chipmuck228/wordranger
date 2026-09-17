import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  filterPlayableNeeds,
  playableNeedsFromPlan,
} from "@/server/game-session/filter-playable-needs";
import { RANGER_TRIAL_GAME_DEFINITION } from "@/server/game-session/ranger-trial-capability";
import { WORD_BUBBLE_GAME_DEFINITION } from "@/server/game-session/word-bubble-capability";
import { MATCHING_GAME_DEFINITION } from "@/server/game-session/matching-capability";
import { SNAKE_GAME_DEFINITION } from "@/server/game-session/snake-capability";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { makeNeed } from "../tasks/helpers";

const needs = [
  makeNeed({
    id: "need-meaning",
    lexemeId: "lex-1",
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    priority: 10,
  }),
  makeNeed({
    id: "need-spell",
    lexemeId: "lex-2",
    targetSkill: VocabularySkill.SPELLING_RECALL,
    priority: 9,
  }),
  makeNeed({
    id: "need-semantic",
    lexemeId: "lex-3",
    targetSkill: VocabularySkill.SEMANTIC_CONNECTION,
    priority: 8,
  }),
  makeNeed({
    id: "need-recall",
    lexemeId: "lex-4",
    targetSkill: VocabularySkill.ACTIVE_RECALL,
    priority: 7,
  }),
];

describe("game capability filtering", () => {
  it.each([
    ["Word Bubble", WORD_BUBBLE_GAME_DEFINITION],
    ["Matching", MATCHING_GAME_DEFINITION],
    ["Snake", SNAKE_GAME_DEFINITION],
  ] as const)("%s retains only compatible needs without reordering", (_name, definition) => {
    const { playable, excluded } = filterPlayableNeeds(needs, definition);
    expect(playable.map((need) => need.id)).toEqual([
      "need-meaning",
      "need-semantic",
    ]);
    expect(excluded.map((item) => item.needId)).toEqual([
      "need-spell",
      "need-recall",
    ]);
    expect(excluded.every((item) => item.reason === "GAME_CAPABILITY_UNSUPPORTED")).toBe(
      true,
    );
  });

  it("Ranger Trial keeps all V1 executable skills", () => {
    const { playable, excluded } = filterPlayableNeeds(
      needs,
      RANGER_TRIAL_GAME_DEFINITION,
    );
    expect(playable.map((need) => need.id)).toEqual(needs.map((need) => need.id));
    expect(excluded).toEqual([]);
  });

  it("returns NO_PLAYABLE_NEEDS when Scheduler needs are all incompatible", () => {
    expect(() =>
      playableNeedsFromPlan(
        [
          makeNeed({
            id: "need-spell",
            lexemeId: "lex-2",
            targetSkill: VocabularySkill.SPELLING_RECALL,
          }),
        ],
        WORD_BUBBLE_GAME_DEFINITION,
      ),
    ).toThrow(GameSessionError);
    try {
      playableNeedsFromPlan(
        [
          makeNeed({
            id: "need-spell",
            lexemeId: "lex-2",
            targetSkill: VocabularySkill.SPELLING_RECALL,
          }),
        ],
        WORD_BUBBLE_GAME_DEFINITION,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "NO_PLAYABLE_NEEDS" });
    }
  });
});
