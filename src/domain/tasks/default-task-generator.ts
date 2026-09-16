import { clamp01 } from "@/domain/learning/engine/math";
import type { LearningNeed } from "@/domain/learning/learning-need";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import {
  LexemeRelationType,
  type LexemeRelation,
} from "@/domain/vocabulary/lexeme-relation";
import type { LexemeTags } from "@/domain/vocabulary/lexeme-tags";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { archetypesForSkill } from "./task-archetype-registry";
import type { TaskArchetype } from "./task-archetype";
import type { PublicLearningTask } from "./public-learning-task";
import { SeededRandomSource, shuffleInPlace } from "./random-source";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskGenerationRequest } from "./task-generation-request";
import {
  DEFAULT_TASK_GENERATION_POLICY,
  type TaskGenerationPolicy,
} from "./task-generation-policy";
import type { TaskGenerationTrace } from "./task-generation-result";
import type { TaskGenerator } from "./task-generator";
import {
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
  LearningTaskType,
} from "./task-type";
import {
  TaskUnavailableCode,
  type TaskGenerationResult,
} from "./task-unavailable";

const OVERLAPPING_RELATION_TYPES = new Set([
  LexemeRelationType.SYNONYM,
  LexemeRelationType.VARIANT,
  LexemeRelationType.ABBREVIATION,
]);

function otherId(relation: LexemeRelation, lexemeId: string): string {
  return relation.fromLexemeId === lexemeId
    ? relation.toLexemeId
    : relation.fromLexemeId;
}

function unavailable(
  code: TaskUnavailableCode,
  reason: string,
  metadata?: Record<string, unknown>,
): TaskGenerationResult {
  return { status: "UNAVAILABLE", code, reason, metadata };
}

export class DefaultTaskGenerator implements TaskGenerator {
  constructor(
    private readonly vocabulary: VocabularyRepository,
    private readonly policy: TaskGenerationPolicy = DEFAULT_TASK_GENERATION_POLICY,
  ) {}

  async generate(request: TaskGenerationRequest): Promise<TaskGenerationResult> {
    const difficulty = clamp01(
      Number.isFinite(request.desiredDifficulty)
        ? request.desiredDifficulty
        : this.policy.difficulty.defaultValue,
    );
    const lexeme = await this.vocabulary.getLexeme(request.need.lexemeId);
    if (!lexeme) {
      return unavailable(
        TaskUnavailableCode.LEXEME_NOT_FOUND,
        `Lexeme ${request.need.lexemeId} was not found`,
      );
    }
    if (request.need.targetSkill === VocabularySkill.LISTENING_RECOGNITION) {
      return unavailable(
        TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
        "No approved audio asset exists for listening tasks",
        { skill: request.need.targetSkill },
      );
    }
    if (request.need.targetSkill === VocabularySkill.CONTEXT_USE) {
      return unavailable(
        TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
        "No approved context sentence exists for context tasks",
        { skill: request.need.targetSkill },
      );
    }

    const archetype = await this.selectArchetype(request.need, lexeme);
    if ("status" in archetype) {
      return archetype;
    }
    if (archetype.answerMode === "TYPING" || archetype.answerMode === "SPELLING") {
      return this.generateTypingTask(request, lexeme, archetype, difficulty);
    }
    if (archetype.taskType === LearningTaskType.RELATION_CHOICE) {
      return this.generateRelationTask(request, lexeme, archetype, difficulty);
    }
    return this.generateMeaningChoice(request, lexeme, archetype, difficulty);
  }

  private async selectArchetype(
    need: LearningNeed,
    lexeme: Lexeme,
  ): Promise<TaskArchetype | TaskGenerationResult> {
    let candidates = archetypesForSkill(need.targetSkill).filter((archetype) =>
      archetype.supportedNeedReasons.includes(need.reason),
    );
    if (need.weaknessFocus) {
      const focused = candidates.filter((archetype) =>
        archetype.supportedWeaknessTypes.includes(need.weaknessFocus!.type),
      );
      if (focused.length > 0) {
        candidates = focused;
      }
    }
    if (need.preferredPromptModes.length > 0) {
      const preferred = candidates.filter((archetype) =>
        need.preferredPromptModes.includes(archetype.promptMode),
      );
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }
    if (need.avoidRecentTaskTypes.length > 0) {
      const fresh = candidates.filter(
        (archetype) => !need.avoidRecentTaskTypes.includes(archetype.taskType),
      );
      if (fresh.length > 0) {
        candidates = fresh;
      }
    }
    if (
      need.reason === "WEAKNESS" &&
      need.weaknessFocus?.type === WeaknessType.CONFUSION
    ) {
      const confusable = candidates.find(
        (archetype) => archetype.taskType === LearningTaskType.CONFUSABLE_CHOICE,
      );
      if (confusable) {
        const approved = await this.approvedConfusable(lexeme.id, need);
        if (approved) {
          return confusable;
        }
      }
      const meaning = candidates.find(
        (archetype) => archetype.taskType === LearningTaskType.MEANING_CHOICE,
      );
      if (meaning) {
        return meaning;
      }
    }
    if (candidates.length === 0) {
      return unavailable(
        TaskUnavailableCode.SKILL_NOT_SUPPORTED,
        `No V1 archetype supports skill ${need.targetSkill}`,
      );
    }
    return candidates[0];
  }

  private async approvedConfusable(
    lexemeId: string,
    need: LearningNeed,
  ): Promise<LexemeRelation | null> {
    const relatedId = need.weaknessFocus?.relatedLexemeId;
    const relations = await this.vocabulary.getRelations(lexemeId, {
      types: [LexemeRelationType.CONFUSABLE],
    });
    if (relatedId) {
      return (
        relations.find((relation) => otherId(relation, lexemeId) === relatedId) ??
        null
      );
    }
    return relations[0] ?? null;
  }

  private async generateTypingTask(
    request: TaskGenerationRequest,
    lexeme: Lexeme,
    archetype: TaskArchetype,
    difficulty: number,
  ): Promise<TaskGenerationResult> {
    const meaning = lexeme.meaningsZh[0];
    if (!meaning) {
      return unavailable(
        TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
        `Lexeme ${lexeme.canonicalKey} has no Chinese meaning`,
      );
    }
    const taskId = request.createId();
    const publicTask: PublicLearningTask = {
      id: taskId,
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: request.need.id,
      lexemeId: lexeme.id,
      targetSkill: request.need.targetSkill,
      taskType: archetype.taskType,
      promptMode: archetype.promptMode,
      answerMode: archetype.answerMode,
      difficulty,
      prompt: { kind: "MEANING_TEXT", text: meaning },
      responseContract: {
        kind: "TEXT_INPUT",
        placeholder: "Type the English word",
        maxLength: 64,
      },
      hints: [],
      createdAt: request.now,
    };
    const answerKey: TaskAnswerKey = {
      taskId,
      targetLexemeId: lexeme.id,
      correctOptionIds: [],
      optionLexemeIds: {},
      exactAcceptedTexts: [lexeme.lemma],
      semanticAcceptedTexts: [],
    };
    return {
      status: "GENERATED",
      value: {
        publicTask,
        answerKey,
        generationTrace: this.trace(request, archetype, lexeme.id, {
          candidateLexemeIds: [],
          selectedDistractorLexemeIds: [],
          relationIds: [],
          blockedCandidates: [],
        }),
      },
    };
  }

  private async generateRelationTask(
    request: TaskGenerationRequest,
    lexeme: Lexeme,
    archetype: TaskArchetype,
    difficulty: number,
  ): Promise<TaskGenerationResult> {
    const relations = await this.vocabulary.getRelations(lexeme.id);
    if (relations.length === 0) {
      return unavailable(
        TaskUnavailableCode.NO_APPROVED_RELATION,
        `No production-approved relation for ${lexeme.canonicalKey}`,
      );
    }
    const relation = relations[Math.floor(request.random.next() * relations.length)];
    const targetRelatedId = otherId(relation, lexeme.id);
    const related = await this.vocabulary.getLexeme(targetRelatedId);
    if (!related) {
      return unavailable(
        TaskUnavailableCode.LEXEME_NOT_FOUND,
        `Related lexeme ${targetRelatedId} is missing`,
      );
    }
    const catalog = await this.vocabulary.listLexemes();
    const blocked: TaskGenerationTrace["blockedCandidates"] = [];
    const pool = catalog.filter((candidate) => {
      if (candidate.id === lexeme.id || candidate.id === related.id) {
        return false;
      }
      if (candidate.sourceEntryId === lexeme.sourceEntryId) {
        blocked.push({
          lexemeId: candidate.id,
          reason: "same_source_entry",
        });
        return false;
      }
      return candidate.lemma.length > 0;
    });
    const optionCount = this.policy.choice.optionCount;
    const needed = optionCount - 1;
    if (pool.length < needed) {
      return unavailable(
        TaskUnavailableCode.INSUFFICIENT_DISTRACTORS,
        `Need ${needed} relation distractors, found ${pool.length}`,
      );
    }
    const limited = pool.slice(0, this.policy.choice.candidatePoolLimit);
    const distractors = shuffleInPlace([...limited], request.random).slice(
      0,
      needed,
    );
    const optionLexemes = shuffleInPlace([related, ...distractors], request.random);
    const correctOptionId = request.createId();
    const options = optionLexemes.map((item) => {
      const id = item.id === related.id ? correctOptionId : request.createId();
      return {
        id,
        lexeme: item,
        content: { kind: "TEXT" as const, text: item.lemma },
      };
    });
    const taskId = request.createId();
    const publicTask: PublicLearningTask = {
      id: taskId,
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: request.need.id,
      lexemeId: lexeme.id,
      targetSkill: request.need.targetSkill,
      taskType: archetype.taskType,
      promptMode: archetype.promptMode,
      answerMode: archetype.answerMode,
      difficulty,
      prompt: {
        kind: "RELATION",
        sourceText: lexeme.display,
        relationType: relation.type,
      },
      responseContract: {
        kind: "CHOICE",
        options: options.map(({ id, content }) => ({ id, content })),
      },
      hints: [],
      createdAt: request.now,
    };
    const optionLexemeIds: Record<string, string | null> = {};
    for (const option of options) {
      optionLexemeIds[option.id] = option.lexeme.id;
    }
    const answerKey: TaskAnswerKey = {
      taskId,
      targetLexemeId: lexeme.id,
      correctOptionIds: [correctOptionId],
      optionLexemeIds,
      exactAcceptedTexts: [related.lemma],
      semanticAcceptedTexts: [],
      relationId: relation.id,
    };
    return {
      status: "GENERATED",
      value: {
        publicTask,
        answerKey,
        generationTrace: this.trace(request, archetype, lexeme.id, {
          candidateLexemeIds: limited.map((item) => item.id),
          selectedDistractorLexemeIds: distractors.map((item) => item.id),
          relationIds: [relation.id],
          blockedCandidates: blocked,
        }),
      },
    };
  }

  private async generateMeaningChoice(
    request: TaskGenerationRequest,
    lexeme: Lexeme,
    archetype: TaskArchetype,
    difficulty: number,
  ): Promise<TaskGenerationResult> {
    const meaning = lexeme.meaningsZh[0];
    if (!meaning) {
      return unavailable(
        TaskUnavailableCode.MISSING_REQUIRED_CONTENT,
        `Lexeme ${lexeme.canonicalKey} has no Chinese meaning`,
      );
    }
    const relations = await this.vocabulary.getRelations(lexeme.id);
    const overlappingIds = new Set(
      relations
        .filter((relation) => OVERLAPPING_RELATION_TYPES.has(relation.type))
        .map((relation) => otherId(relation, lexeme.id)),
    );
    const approvedConfusableIds = new Set(
      relations
        .filter((relation) => relation.type === LexemeRelationType.CONFUSABLE)
        .map((relation) => otherId(relation, lexeme.id)),
    );
    const relatedId = request.need.weaknessFocus?.relatedLexemeId;
    const blocked: TaskGenerationTrace["blockedCandidates"] = [];
    if (relatedId && !approvedConfusableIds.has(relatedId)) {
      blocked.push({
        lexemeId: relatedId,
        reason: "confusion_relation_not_production_approved",
      });
    }

    const catalog = await this.vocabulary.listLexemes();
    const targetTags = await this.vocabulary.getTags(lexeme.id);
    const scored: Array<{ lexeme: Lexeme; score: number }> = [];
    for (const candidate of catalog) {
      if (candidate.id === lexeme.id) {
        continue;
      }
      const candidateMeaning = candidate.meaningsZh[0];
      if (!candidateMeaning) {
        continue;
      }
      if (candidateMeaning === meaning) {
        blocked.push({ lexemeId: candidate.id, reason: "duplicate_meaning" });
        continue;
      }
      if (candidate.sourceEntryId === lexeme.sourceEntryId) {
        blocked.push({ lexemeId: candidate.id, reason: "same_source_entry" });
        continue;
      }
      if (overlappingIds.has(candidate.id)) {
        blocked.push({
          lexemeId: candidate.id,
          reason: "approved_synonym_or_variant",
        });
        continue;
      }
      let score = 0;
      if (
        candidate.partsOfSpeech.some((part) =>
          lexeme.partsOfSpeech.includes(part),
        )
      ) {
        score += 3;
      }
      score += await this.tagScore(candidate.id, targetTags);
      scored.push({ lexeme: candidate, score });
    }

    scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.lexeme.id.localeCompare(right.lexeme.id);
    });
    const pool = scored
      .slice(0, this.policy.choice.candidatePoolLimit)
      .map((item) => item.lexeme);

    const optionCount = this.policy.choice.optionCount;
    const needed = optionCount - 1;
    const selected: Lexeme[] = [];
    const preferredId =
      relatedId && approvedConfusableIds.has(relatedId) ? relatedId : null;
    if (preferredId) {
      const preferred =
        pool.find((item) => item.id === preferredId) ??
        (await this.vocabulary.getLexeme(preferredId));
      if (
        preferred &&
        preferred.meaningsZh[0] &&
        preferred.meaningsZh[0] !== meaning
      ) {
        selected.push(preferred);
      }
    }
    const remaining = shuffleInPlace(
      pool.filter((item) => !selected.some((picked) => picked.id === item.id)),
      request.random,
    );
    for (const candidate of remaining) {
      if (selected.length >= needed) {
        break;
      }
      if (
        selected.some((picked) => picked.meaningsZh[0] === candidate.meaningsZh[0])
      ) {
        blocked.push({ lexemeId: candidate.id, reason: "duplicate_option_text" });
        continue;
      }
      selected.push(candidate);
    }
    if (selected.length < needed) {
      return unavailable(
        TaskUnavailableCode.INSUFFICIENT_DISTRACTORS,
        `Need ${needed} meaning distractors, found ${selected.length}`,
      );
    }

    if (
      archetype.taskType === LearningTaskType.CONFUSABLE_CHOICE &&
      !preferredId
    ) {
      return unavailable(
        TaskUnavailableCode.CONTENT_POLICY_BLOCKED,
        "CONFUSABLE_CHOICE requires a production-approved confusable relation",
      );
    }

    const correctOptionId = request.createId();
    const optionLexemes = shuffleInPlace(
      [{ lexeme, correct: true }, ...selected.map((item) => ({ lexeme: item, correct: false }))],
      request.random,
    );
    const options = optionLexemes.map((item) => ({
      id: item.correct ? correctOptionId : request.createId(),
      lexeme: item.lexeme,
      text: item.correct ? meaning : item.lexeme.meaningsZh[0],
    }));
    const taskId = request.createId();
    const optionLexemeIds: Record<string, string | null> = {};
    for (const option of options) {
      optionLexemeIds[option.id] = option.lexeme.id;
    }
    const publicTask: PublicLearningTask = {
      id: taskId,
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: request.need.id,
      lexemeId: lexeme.id,
      targetSkill: request.need.targetSkill,
      taskType: archetype.taskType,
      promptMode: archetype.promptMode,
      answerMode: archetype.answerMode,
      difficulty,
      prompt: { kind: "LEXEME_TEXT", text: lexeme.display },
      responseContract: {
        kind: "CHOICE",
        options: options.map((option) => ({
          id: option.id,
          content: { kind: "TEXT", text: option.text },
        })),
      },
      hints: [],
      createdAt: request.now,
    };
    const answerKey: TaskAnswerKey = {
      taskId,
      targetLexemeId: lexeme.id,
      correctOptionIds: [correctOptionId],
      optionLexemeIds,
      exactAcceptedTexts: [meaning],
      semanticAcceptedTexts: [],
      confusionLexemeIds: [...approvedConfusableIds],
    };
    return {
      status: "GENERATED",
      value: {
        publicTask,
        answerKey,
        generationTrace: this.trace(request, archetype, lexeme.id, {
          candidateLexemeIds: pool.map((item) => item.id),
          selectedDistractorLexemeIds: selected.map((item) => item.id),
          relationIds: relations
            .filter((relation) =>
              selected.some(
                (item) => otherId(relation, lexeme.id) === item.id,
              ),
            )
            .map((relation) => relation.id),
          blockedCandidates: blocked,
        }),
      },
    };
  }

  private async tagScore(
    candidateId: string,
    targetTags: LexemeTags | null,
  ): Promise<number> {
    if (!targetTags) {
      return 0;
    }
    const tags = await this.vocabulary.getTags(candidateId);
    if (!tags) {
      return 0;
    }
    let score = 0;
    if (
      tags.semanticCategories.some((item) =>
        targetTags.semanticCategories.includes(item),
      )
    ) {
      score += 2;
    }
    if (tags.topics.some((item) => targetTags.topics.includes(item))) {
      score += 1;
    }
    return score;
  }

  private trace(
    request: TaskGenerationRequest,
    archetype: TaskArchetype,
    targetLexemeId: string,
    details: Pick<
      TaskGenerationTrace,
      | "candidateLexemeIds"
      | "selectedDistractorLexemeIds"
      | "relationIds"
      | "blockedCandidates"
    >,
  ): TaskGenerationTrace {
    return {
      generatorVersion: TASK_GENERATOR_VERSION,
      archetype: archetype.taskType,
      targetLexemeId,
      ...details,
      policyVersion: this.policy.version,
      randomSeed:
        request.random instanceof SeededRandomSource
          ? request.random.seed
          : undefined,
    };
  }
}
