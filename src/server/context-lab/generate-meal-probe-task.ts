import "server-only";

import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { LearningNeed } from "@/domain/learning/learning-need";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { contextLabFrozenTaskId } from "./context-lab-frozen-task-id";
import type {
  ContextualProbeSkill,
  ContextualProbeTarget,
} from "@/contextual-learning/candidate-v0/probe/types";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import { requireLearnerLexicalForm } from "@/contextual-learning/candidate-v0/content/project-learner-lexical-form";
import { selectBundledMeaningGloss } from "@/contextual-learning/candidate-v0/content/select-bundled-meaning-gloss";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";

const RECALL_PROMPT = "写出当前物品的英文单词";

export async function generateMealProbeTask(input: {
  runId: string;
  target: ContextualProbeTarget;
  skill: ContextualProbeSkill;
  siblingLemmas: readonly string[];
  targetLemma: string;
  now: string;
  pack?: ReturnType<typeof experimentalMealContextLabPack>;
}): Promise<
  | { ok: true; task: GeneratedLearningTask }
  | { ok: false; reason: "PROBE_TASK_UNAVAILABLE" | "PROBE_TASK_SEMANTIC_MISMATCH" }
> {
  const lexemeId = input.target.target.lexemeId;
  const taskId = contextLabFrozenTaskId(input.runId, `probe:${lexemeId}:${input.skill}`);
  const need = probeNeed(input.skill, lexemeId, `${taskId}:need`);
  const generator = new DefaultTaskGenerator(bundledVocabularyRepository());
  const created = await generator.generate({
    need,
    desiredDifficulty: 0.4,
    recentTasks: [],
    now: input.now,
    createId: () => crypto.randomUUID(),
    random: new SeededRandomSource(`${input.runId}:${lexemeId}:${input.skill}`),
  });
  if (created.status !== "GENERATED") {
    return { ok: false, reason: "PROBE_TASK_UNAVAILABLE" };
  }
  const projected = projectedLearnerFormForTarget(input.target, input.pack);
  if (!projected) {
    return { ok: false, reason: "PROBE_TASK_UNAVAILABLE" };
  }
  const stamped: GeneratedLearningTask = {
    ...created.value,
    publicTask: { ...created.value.publicTask, id: taskId, hints: [] },
    answerKey: {
      ...created.value.answerKey,
      taskId,
      exactAcceptedTexts: [projected.answerForm],
    },
  };
  const prepared =
    input.skill === "ACTIVE_RECALL"
      ? sceneSafeRecallTask(stamped)
      : sceneSafeRecognitionTask(
          sceneSafeRecognitionPrompt(stamped, projected.displayForm),
          input.target,
          input.pack,
        );
  if (!matchesFrozenProbeContract(prepared, input.skill, lexemeId, input.targetLemma)) {
    return { ok: false, reason: "PROBE_TASK_SEMANTIC_MISMATCH" };
  }
  if (
    input.skill === "ACTIVE_RECALL" &&
    leaksEnglishForm(prepared, [input.targetLemma, ...input.siblingLemmas])
  ) {
    return { ok: false, reason: "PROBE_TASK_SEMANTIC_MISMATCH" };
  }
  return { ok: true, task: prepared };
}

function probeNeed(
  skill: ContextualProbeSkill,
  lexemeId: string,
  needId: string,
): LearningNeed {
  return {
    id: needId,
    lexemeId,
    targetSkill:
      skill === "MEANING_RECOGNITION"
        ? VocabularySkill.MEANING_RECOGNITION
        : VocabularySkill.ACTIVE_RECALL,
    priority: 1,
    reason: "USER_MARKED",
    preferredPromptModes:
      skill === "MEANING_RECOGNITION"
        ? [PromptMode.WORD_TO_MEANING]
        : [PromptMode.MEANING_TO_WORD],
    avoidRecentTaskTypes: [],
  };
}

function sceneSafeRecognitionTask(
  task: GeneratedLearningTask,
  target: ContextualProbeTarget,
  pack = experimentalMealContextLabPack(),
): GeneratedLearningTask {
  const authored = pack.lexemes.find((lexeme) =>
    sameLexemeSense(lexeme.target, target.target),
  );
  const selector = authored?.lexicalPresentation.meaningGlossSelector;
  if (!authored || !selector) {
    return task;
  }
  const bundled = bundledSceneLexemeLoader(authored.canonicalKey);
  const gloss = selectBundledMeaningGloss({
    meaningsZh: bundled?.meaningsZh,
    selector,
  });
  if (
    !gloss ||
    task.publicTask.responseContract.kind !== "CHOICE" ||
    task.answerKey.correctOptionIds.length !== 1
  ) {
    return task;
  }
  const correctId = task.answerKey.correctOptionIds[0]!;
  const options = task.publicTask.responseContract.options.map((option) =>
    option.id === correctId
      ? {
          ...option,
          content: { ...option.content, text: gloss },
        }
      : option,
  );
  const texts = options.map((option) => option.content.text);
  if (new Set(texts).size !== texts.length) {
    return task;
  }
  return {
    ...task,
    publicTask: {
      ...task.publicTask,
      responseContract: {
        ...task.publicTask.responseContract,
        options,
      },
    },
  };
}

function projectedLearnerFormForTarget(
  target: ContextualProbeTarget,
  pack = experimentalMealContextLabPack(),
) {
  const authored = pack.lexemes.find((lexeme) =>
    sameLexemeSense(lexeme.target, target.target),
  );
  if (!authored) {
    return null;
  }
  const bundled = bundledSceneLexemeLoader(authored.canonicalKey);
  return bundled ? requireLearnerLexicalForm(bundled) : null;
}

function sceneSafeRecognitionPrompt(
  task: GeneratedLearningTask,
  displayForm: string,
): GeneratedLearningTask {
  if (task.publicTask.prompt.kind !== "LEXEME_TEXT") {
    return task;
  }
  return {
    ...task,
    publicTask: {
      ...task.publicTask,
      prompt: { ...task.publicTask.prompt, text: displayForm },
    },
  };
}

function sceneSafeRecallTask(task: GeneratedLearningTask): GeneratedLearningTask {
  return {
    ...task,
    publicTask: {
      ...task.publicTask,
      prompt: { kind: "MEANING_TEXT", text: RECALL_PROMPT },
      hints: [],
    },
  };
}

function matchesFrozenProbeContract(
  task: GeneratedLearningTask,
  skill: ContextualProbeSkill,
  lexemeId: string,
  lemma: string,
): boolean {
  const publicTask = task.publicTask;
  if (publicTask.lexemeId !== lexemeId || task.answerKey.targetLexemeId !== lexemeId) {
    return false;
  }
  if (skill === "ACTIVE_RECALL") {
    return (
      publicTask.targetSkill === VocabularySkill.ACTIVE_RECALL &&
      publicTask.taskType === LearningTaskType.ACTIVE_RECALL_TYPING &&
      publicTask.promptMode === PromptMode.MEANING_TO_WORD &&
      publicTask.answerMode === AnswerMode.TYPING &&
      publicTask.responseContract.kind === "TEXT_INPUT" &&
      publicTask.prompt.kind === "MEANING_TEXT" &&
      publicTask.prompt.text === RECALL_PROMPT
    );
  }
  return (
    publicTask.targetSkill === VocabularySkill.MEANING_RECOGNITION &&
    publicTask.taskType === LearningTaskType.MEANING_CHOICE &&
    publicTask.promptMode === PromptMode.WORD_TO_MEANING &&
    publicTask.answerMode === AnswerMode.MULTIPLE_CHOICE &&
    publicTask.responseContract.kind === "CHOICE" &&
    publicTask.prompt.kind === "LEXEME_TEXT" &&
    publicTask.prompt.text.trim().toLowerCase() === lemma.trim().toLowerCase()
  );
}

function leaksEnglishForm(
  task: GeneratedLearningTask,
  lemmas: readonly string[],
): boolean {
  const banned = lemmas
    .map((lemma) => lemma.trim().toLowerCase())
    .filter((lemma) => lemma.length > 0);
  const texts: string[] = [];
  const prompt = task.publicTask.prompt;
  if (prompt.kind === "MEANING_TEXT" || prompt.kind === "LEXEME_TEXT") {
    texts.push(prompt.text);
  }
  if (prompt.kind === "RELATION") {
    texts.push(prompt.sourceText);
  }
  if (task.publicTask.responseContract.kind === "CHOICE") {
    for (const option of task.publicTask.responseContract.options) {
      texts.push(option.content.text);
    }
  }
  const joined = texts.join("\n").toLowerCase();
  return banned.some((lemma) => wordBoundaryHas(joined, lemma));
}

function wordBoundaryHas(haystack: string, lemma: string): boolean {
  return new RegExp(`(^|[^a-z])${escapeRegExp(lemma)}([^a-z]|$)`).test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
