import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARNING_CONTENT_CAPABILITY,
  SchedulerBlockedReason,
} from "@/domain/scheduler";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { makeLexeme, makeModel, plan } from "./helpers";

const ANY = "lexeme-any";

describe("Learning content capability", () => {
  it("C1: MEANING_RECOGNITION supported by default overlay", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.MEANING_RECOGNITION,
      ),
    ).toBe(true);
  });

  it("C2: SEMANTIC_CONNECTION supported by default overlay", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
  });

  it("C3: ACTIVE_RECALL supported by default overlay", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.ACTIVE_RECALL,
      ),
    ).toBe(true);
  });

  it("C4: SPELLING_RECALL supported by default overlay", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.SPELLING_RECALL,
      ),
    ).toBe(true);
  });

  it("C5: LISTENING_RECOGNITION blocked", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.LISTENING_RECOGNITION,
      ),
    ).toBe(false);
  });

  it("C6: CONTEXT_USE blocked", () => {
    expect(
      DEFAULT_LEARNING_CONTENT_CAPABILITY.supports(
        ANY,
        VocabularySkill.CONTEXT_USE,
      ),
    ).toBe(false);
  });

  it("C7: blocked candidate appears in trace", () => {
    const result = plan({
      lexemes: [makeLexeme("usable")],
      models: [makeModel("usable", { masteryStage: MasteryStage.USABLE })],
    });
    const blocked = result.trace.blockedCandidates.find(
      (item) => item.skill === VocabularySkill.CONTEXT_USE,
    );
    expect(blocked).toBeTruthy();
    expect(blocked?.status).toBe("BLOCKED");
    expect(blocked?.blockedReason).toBe(
      SchedulerBlockedReason.UNSUPPORTED_CONTENT_CAPABILITY,
    );
    expect(blocked?.reason).toBe("STAGE_PROGRESS");
    expect(blocked?.capabilityReason).toMatch(/Context/i);
  });
});
