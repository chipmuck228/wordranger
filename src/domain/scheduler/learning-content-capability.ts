import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export interface LexemeLearningCapability {
  lexemeId: string;
  supportedSkills: VocabularySkill[];
  reasons: Partial<Record<VocabularySkill, string[]>>;
}

export interface LearningContentCapability {
  supports(lexemeId: string, skill: VocabularySkill): boolean;
  getCapability(lexemeId: string): LexemeLearningCapability | null;
}

const GLOBALLY_SUPPORTED = [
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.SEMANTIC_CONNECTION,
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
] as const;

const GLOBALLY_BLOCKED: Partial<Record<VocabularySkill, string[]>> = {
  [VocabularySkill.LISTENING_RECOGNITION]: [
    "Listening content is not available in V1",
  ],
  [VocabularySkill.CONTEXT_USE]: ["Context content is not available in V1"],
};

export function skillGloballySupported(skill: VocabularySkill): boolean {
  return (GLOBALLY_SUPPORTED as readonly VocabularySkill[]).includes(skill);
}

function optimisticCapability(lexemeId: string): LexemeLearningCapability {
  return {
    lexemeId,
    supportedSkills: [...GLOBALLY_SUPPORTED],
    reasons: { ...GLOBALLY_BLOCKED },
  };
}

/**
 * Test/default overlay: the four V1 task skills are treated as feasible for
 * any lexeme. Production planning injects a vocabulary-backed implementation.
 */
export class DefaultLearningContentCapability implements LearningContentCapability {
  supports(_lexemeId: string, skill: VocabularySkill): boolean {
    return skillGloballySupported(skill);
  }

  getCapability(lexemeId: string): LexemeLearningCapability {
    return optimisticCapability(lexemeId);
  }
}

export class MappedLearningContentCapability implements LearningContentCapability {
  constructor(
    private readonly capabilities: ReadonlyMap<string, LexemeLearningCapability>,
    private readonly unknown: "optimistic" | "unsupported" = "unsupported",
  ) {}

  supports(lexemeId: string, skill: VocabularySkill): boolean {
    const capability = this.getCapability(lexemeId);
    if (!capability) {
      return false;
    }
    return capability.supportedSkills.includes(skill);
  }

  getCapability(lexemeId: string): LexemeLearningCapability | null {
    const mapped = this.capabilities.get(lexemeId);
    if (mapped) {
      return mapped;
    }
    if (this.unknown === "optimistic") {
      return optimisticCapability(lexemeId);
    }
    return null;
  }
}

export function lexemeCapability(input: {
  lexemeId: string;
  supportedSkills: VocabularySkill[];
  reasons?: Partial<Record<VocabularySkill, string[]>>;
}): LexemeLearningCapability {
  return {
    lexemeId: input.lexemeId,
    supportedSkills: input.supportedSkills,
    reasons: input.reasons ?? {},
  };
}

export const DEFAULT_LEARNING_CONTENT_CAPABILITY =
  new DefaultLearningContentCapability();

export const V1_CONTENT_SKILLS = GLOBALLY_SUPPORTED;
export const V1_BLOCKED_SKILL_REASONS = GLOBALLY_BLOCKED;
