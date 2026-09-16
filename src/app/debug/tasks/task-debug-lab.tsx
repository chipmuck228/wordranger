"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LearningNeedReason } from "@/domain/learning/learning-need";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import { VOCABULARY_SKILLS, VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskAssignment } from "@/domain/tasks/task-assignment";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { TaskGenerationResult } from "@/domain/tasks/task-unavailable";
import type { VocabularyDebugLexeme } from "@/server/vocabulary/debug-view";
import {
  generateDebugTask,
  resetDebugTaskLab,
  submitDebugTaskAction,
} from "./actions";
import { DEBUG_SESSION_ID, DEBUG_USER_ID } from "./debug-ids";

export type TaskDebugLexeme = Pick<
  VocabularyDebugLexeme,
  "id" | "lemma" | "display" | "meaningsZh" | "ipa" | "tags" | "relations"
>;

export function TaskDebugLab({
  lexemes,
}: {
  lexemes: TaskDebugLexeme[];
}) {
  const quiet = lexemes.find((lexeme) => lexeme.lemma === "quiet");
  const [query, setQuery] = useState("quiet");
  const [selectedId, setSelectedId] = useState(quiet?.id ?? lexemes[0]?.id ?? "");
  const selected =
    lexemes.find((lexeme) => lexeme.id === selectedId) ?? quiet ?? lexemes[0];
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return lexemes.slice(0, 8);
    }
    return lexemes
      .filter(
        (lexeme) =>
          lexeme.lemma.toLowerCase().includes(needle) ||
          lexeme.display.toLowerCase().includes(needle) ||
          lexeme.meaningsZh.some((meaning) =>
            meaning.toLowerCase().includes(needle),
          ),
      )
      .slice(0, 20);
  }, [lexemes, query]);
  const [skill, setSkill] = useState(VocabularySkill.MEANING_RECOGNITION);
  const [reason, setReason] = useState<LearningNeedReason>("NEW_WORD");
  const [seed, setSeed] = useState("debug-seed");
  const [choiceId, setChoiceId] = useState("");
  const [typed, setTyped] = useState("");
  const [hintCount, setHintCount] = useState("0");
  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [generation, setGeneration] = useState<TaskGenerationResult | null>(
    null,
  );
  const [evaluation, setEvaluation] = useState<TaskEvaluation | null>(null);
  const [evidence, setEvidence] = useState<LearningEvidence | null>(null);
  const [model, setModel] = useState<StudentLexemeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generated: GeneratedLearningTask | null =
    generation?.status === "GENERATED" ? generation.value : null;

  const approvedRelations = useMemo(
    () => selected?.relations.filter((relation) => relation.productionUsable) ?? [],
    [selected],
  );
  const relatedLexemeId =
    approvedRelations.find((relation) => relation.type === "CONFUSABLE")
      ?.otherLexemeId ??
    selected?.relations.find((relation) => relation.type === "CONFUSABLE")
      ?.otherLexemeId ??
    "";

  async function onGenerate() {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    setEvaluation(null);
    setEvidence(null);
    setModel(null);
    setAssignment(null);
    try {
      const result = await generateDebugTask({
        lexemeId: selected.id,
        targetSkill: skill,
        reason,
        relatedLexemeId,
        seed,
        difficulty: 0.45,
      });
      setGeneration(result.generation);
      setAssignment(result.assignment);
      if (
        result.generation.status === "GENERATED" &&
        result.generation.value.publicTask.responseContract.kind === "CHOICE"
      ) {
        setChoiceId(
          result.generation.value.publicTask.responseContract.options[0]?.id ??
            "",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!generated) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const action: StudentAction =
        generated.publicTask.responseContract.kind === "CHOICE"
          ? {
              kind: "CHOICE",
              taskId: generated.publicTask.id,
              optionId: choiceId,
              hintCount: Number(hintCount),
              responseTimeMs: 900,
              occurredAt: generated.publicTask.createdAt,
            }
          : {
              kind: "TEXT_INPUT",
              taskId: generated.publicTask.id,
              value: typed,
              hintCount: Number(hintCount),
              responseTimeMs: 900,
              occurredAt: generated.publicTask.createdAt,
            };
      const result = await submitDebugTaskAction({
        taskId: generated.publicTask.id,
        action,
      });
      setEvaluation(result.evaluation);
      setEvidence(result.evidence);
      setModel(result.learningResult.model);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    await resetDebugTaskLab();
    setGeneration(null);
    setAssignment(null);
    setEvaluation(null);
    setEvidence(null);
    setModel(null);
    setError(null);
    setTyped("");
  }

  if (!selected) {
    return <div className="p-6">Vocabulary data is not loaded.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Task Protocol Debug Lab</h1>
        <p className="text-muted-foreground text-sm">
          Generate a LearningTask, persist the assignment, then submit a
          StudentAction through submitTaskAction. This is not a student UI.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>LearningNeed</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="lexeme-search">Search lexeme</Label>
            <Input
              id="lexeme-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="quiet / quite / 安静"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {matches.map((lexeme) => (
                <Button
                  key={lexeme.id}
                  type="button"
                  size="sm"
                  variant={lexeme.id === selected.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedId(lexeme.id);
                    void onReset();
                  }}
                >
                  {lexeme.lemma}
                </Button>
              ))}
            </div>
          </div>
          <label className="space-y-1 text-sm">
            <span>targetSkill</span>
            <select
              value={skill}
              onChange={(event) =>
                setSkill(event.target.value as VocabularySkill)
              }
              className="border-input h-8 w-full rounded-lg border px-2 text-sm"
            >
              {VOCABULARY_SKILLS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>reason</span>
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as LearningNeedReason)
              }
              className="border-input h-8 w-full rounded-lg border px-2 text-sm"
            >
              {[
                "NEW_WORD",
                "WEAKNESS",
                "REVIEW_DUE",
                "STAGE_PROGRESS",
                "FADING",
                "USER_MARKED",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <Label htmlFor="seed">seed</Label>
            <Input id="seed" value={seed} onChange={(event) => setSeed(event.target.value)} />
          </div>
          <div className="text-sm md:col-span-2">
            <div className="font-medium">{selected.lemma}</div>
            <div>{selected.meaningsZh.join("；")}</div>
            <div>IPA {selected.ipa.join(" / ") || "—"}</div>
            <div>
              tags{" "}
              {[
                ...(selected.tags?.topics ?? []),
                ...(selected.tags?.semanticCategories ?? []),
                ...(selected.tags?.gameTags ?? []),
              ].join(", ") || "none"}
            </div>
            <div>
              approved relations{" "}
              {approvedRelations
                .map((relation) => `${relation.type} ${relation.otherLemma}`)
                .join(", ") || "none"}
            </div>
            {relatedLexemeId ? (
              <div>confusion relatedLexemeId {relatedLexemeId}</div>
            ) : null}
            <div>
              assigned user {DEBUG_USER_ID} / session {DEBUG_SESSION_ID}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => void onGenerate()} disabled={busy}>
              Generate Task
            </Button>
            <Button variant="outline" onClick={() => void onReset()} disabled={busy}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {generation?.status === "UNAVAILABLE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Unavailable</CardTitle>
            <CardDescription>{generation.code}</CardDescription>
          </CardHeader>
          <CardContent>{generation.reason}</CardContent>
        </Card>
      ) : null}

      {generated ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>PublicLearningTask</CardTitle>
              <CardDescription>{generated.publicTask.taskType}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(generated.publicTask, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>TaskAnswerKey (debug only)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(generated.answerKey, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>TaskAssignment</CardTitle>
              <CardDescription>
                {assignment
                  ? `${assignment.userId} / ${assignment.sessionId}`
                  : "unassigned"}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>GenerationTrace</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(generated.generationTrace, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {generated ? (
        <Card>
          <CardHeader>
            <CardTitle>StudentAction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generated.publicTask.responseContract.kind === "CHOICE" ? (
              <label className="space-y-1 text-sm">
                <span>option</span>
                <select
                  value={choiceId}
                  onChange={(event) => setChoiceId(event.target.value)}
                  className="border-input h-8 w-full rounded-lg border px-2 text-sm"
                >
                  {generated.publicTask.responseContract.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.content.text}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="typed">typed answer</Label>
                <Input
                  id="typed"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="hints">hintCount</Label>
              <Input
                id="hints"
                value={hintCount}
                onChange={(event) => setHintCount(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void onSubmit()} disabled={busy}>
                Submit StudentAction
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {evaluation ? (
        <Card>
          <CardHeader>
            <CardTitle>TaskEvaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto text-xs">
              {JSON.stringify(evaluation, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {evidence ? (
        <Card>
          <CardHeader>
            <CardTitle>LearningEvidence</CardTitle>
            <CardDescription>
              {evidence.taskType} / {evidence.gameId} / taskId {evidence.taskId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto text-xs">
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {model ? (
        <Card>
          <CardHeader>
            <CardTitle>StudentLexemeModel</CardTitle>
            <CardDescription>
              {model.masteryStage} / {model.retentionState} / policy{" "}
              {model.policyVersion}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>score {model.masteryScore.toFixed(2)}</div>
            {VOCABULARY_SKILLS.map((item) => (
              <div key={item}>
                {item}: {model.skills[item].score.toFixed(2)} / attempts{" "}
                {model.skills[item].totalAttempts}
              </div>
            ))}
            <div>
              weaknesses{" "}
              {model.weaknesses
                .map(
                  (weakness) =>
                    `${weakness.type}${weakness.relatedLexemeId ? ` → ${weakness.relatedLexemeId}` : ""}`,
                )
                .join(", ") || "none"}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
