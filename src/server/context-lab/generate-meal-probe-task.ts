import "server-only";

import { PromptMode } from "@/domain/learning/evidence.types";
import type { LearningNeed } from "@/domain/learning/learning-need";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { contextLabFrozenTaskId } from "./context-lab-frozen-task-id";
import type {
  ContextualProbeSkill,
  ContextualProbeTarget,
} from "@/contextual-learning/candidate-v0/probe/types";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";

const RECOGNITION_PROMPT = "这个物品对应哪个意思？";
const RECALL_PROMPT = "写出这个物品的英文单词";

export async function generateMealProbeTask(input: {
  runId: string;
  target: ContextualProbeTarget;
  skill: ContextualProbeSkill;
  siblingLemmas: readonly string[];
  targetLemma: string;
  now: string;
}): Promise<
  { ok: true; task: GeneratedLearningTask } | { ok: false; reason: "PROBE_TASK_UNAVAILABLE" }
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
  const rewritten = hideEnglishForm({
    task: {
      ...created.value,
      publicTask: { ...created.value.publicTask, id: taskId },
      answerKey: { ...created.value.answerKey, taskId },
    },
    skill: input.skill,
  });
  if (
    leaksEnglishForm(rewritten, input.skill, [
      input.targetLemma,
      ...input.siblingLemmas,
    ])
  ) {
    return { ok: false, reason: "PROBE_TASK_UNAVAILABLE" };
  }
  return { ok: true, task: rewritten };
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

function hideEnglishForm(input: {
  task: GeneratedLearningTask;
  skill: ContextualProbeSkill;
}): GeneratedLearningTask {
  const promptText =
    input.skill === "MEANING_RECOGNITION" ? RECOGNITION_PROMPT : RECALL_PROMPT;
  return {
    ...input.task,
    publicTask: {
      ...input.task.publicTask,
      prompt: { kind: "MEANING_TEXT", text: promptText },
      hints: [],
    },
  };
}

function leaksEnglishForm(
  task: GeneratedLearningTask,
  skill: ContextualProbeSkill,
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
  if (banned.some((lemma) => wordBoundaryHas(joined, lemma))) {
    return true;
  }
  if (skill === "MEANING_RECOGNITION" && /[A-Za-z]{3,}/.test(joined)) {
    return true;
  }
  return false;
}

function wordBoundaryHas(haystack: string, lemma: string): boolean {
  return new RegExp(`(^|[^a-z])${escapeRegExp(lemma)}([^a-z]|$)`).test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
