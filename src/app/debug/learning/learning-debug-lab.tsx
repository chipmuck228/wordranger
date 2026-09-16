"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
  type LearningEvidence,
} from "@/domain/learning/evidence.types";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import {
  createInitialStudentWordModel,
  type StudentWordModel,
} from "@/domain/learning/student-word-model";
import type { TransitionResult } from "@/domain/learning/transition.types";
import { VOCABULARY_SKILLS, VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import {
  DEBUG_WORD_ID,
  DEBUG_USER_ID,
  buildPresetEvidence,
  type DebugPreset,
} from "./presets";

interface EvidenceFormState {
  skill: VocabularySkill;
  outcome: EvidenceOutcome;
  promptMode: PromptMode;
  answerMode: AnswerMode;
  difficulty: string;
  responseTimeMs: string;
  hintCount: string;
  sessionId: string;
  occurredAt: string;
  errorType: string;
  selectedWordId: string;
  taskType: string;
}

const INITIAL_FORM: EvidenceFormState = {
  skill: VocabularySkill.MEANING_RECOGNITION,
  outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
  promptMode: PromptMode.WORD_TO_MEANING,
  answerMode: AnswerMode.MULTIPLE_CHOICE,
  difficulty: "0.5",
  responseTimeMs: "1200",
  hintCount: "0",
  sessionId: "debug-session-1",
  occurredAt: "2026-03-01T09:00:00.000Z",
  errorType: "",
  selectedWordId: DEBUG_WORD_ID,
  taskType: "debug-task",
};

function emptyModel(): StudentWordModel {
  return createInitialStudentWordModel({
    id: "debug-model",
    userId: DEBUG_USER_ID,
    wordId: DEBUG_WORD_ID,
    now: INITIAL_FORM.occurredAt,
  });
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

export function LearningDebugLab() {
  const repositoryRef = useRef(new InMemoryLearningRepository());
  const [model, setModel] = useState<StudentWordModel>(emptyModel);
  const [history, setHistory] = useState<LearningEvidence[]>([]);
  const [lastTransition, setLastTransition] = useState<TransitionResult | null>(
    null,
  );
  const [allReasons, setAllReasons] = useState<TransitionResult["reasons"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<EvidenceFormState>(INITIAL_FORM);

  const unresolvedWeaknesses = useMemo(
    () => model.weaknesses.filter((item) => item.resolvedAt === null),
    [model.weaknesses],
  );

  async function applyEvidence(evidence: LearningEvidence) {
    const result = await processEvidence({
      evidence,
      repository: repositoryRef.current,
      now: evidence.occurredAt,
    });
    const nextHistory = await repositoryRef.current.getEvidenceForWord(
      DEBUG_USER_ID,
      DEBUG_WORD_ID,
    );
    setModel(result.model);
    setHistory(nextHistory);
    setLastTransition(result.transition);
    setAllReasons((current) => [...current, ...result.transition.reasons]);
  }

  async function onProcessEvidence() {
    setBusy(true);
    setError(null);
    try {
      const evidence: LearningEvidence = {
        id: crypto.randomUUID(),
        userId: DEBUG_USER_ID,
        wordId: DEBUG_WORD_ID,
        sessionId: form.sessionId,
        gameId: "debug-lab",
        taskType: form.taskType,
        skill: form.skill,
        promptMode: form.promptMode,
        outcome: form.outcome,
        responseTimeMs:
          form.responseTimeMs.trim() === ""
            ? null
            : Number(form.responseTimeMs),
        hintCount: Number(form.hintCount),
        difficulty: Number(form.difficulty),
        answerMode: form.answerMode,
        distractorWordIds: form.selectedWordId
          ? [form.selectedWordId]
          : [],
        selectedWordId: form.selectedWordId || null,
        typedAnswer: null,
        expectedAnswer: null,
        errorType: form.errorType
          ? (form.errorType as EvidenceErrorType)
          : null,
        occurredAt: form.occurredAt,
      };
      await applyEvidence(evidence);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to process");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    repositoryRef.current.reset();
    setModel(emptyModel());
    setHistory([]);
    setLastTransition(null);
    setAllReasons([]);
    setError(null);
    setForm(INITIAL_FORM);
  }

  async function onPreset(preset: DebugPreset) {
    setBusy(true);
    setError(null);
    try {
      await onReset();
      if (preset === "reset") {
        return;
      }
      const items = buildPresetEvidence(preset);
      for (const evidence of items) {
        await applyEvidence(evidence);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Learning Core Debug Lab</h1>
        <p className="text-muted-foreground text-sm">
          Submit LearningEvidence through processEvidence. Games never write
          mastery state directly.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onPreset("reset")} disabled={busy}>
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("recognition")} disabled={busy}>
          Simulate Recognition
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("active-recall")} disabled={busy}>
          Simulate Active Recall
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("spelling-failure")} disabled={busy}>
          Simulate Spelling Failure
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("confusion")} disabled={busy}>
          Simulate Confusion
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("mastery-journey")} disabled={busy}>
          Simulate Mastery Journey
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("simulate-fading")} disabled={busy}>
          Simulate Fading
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPreset("simulate-recovery")} disabled={busy}>
          Simulate Recovery
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>StudentWordModel</CardTitle>
              <CardDescription>Word {model.wordId}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Field label="MasteryStage" value={model.masteryStage} />
              <Field label="RetentionState" value={model.retentionState} />
              <Field label="MasteryScore" value={formatNumber(model.masteryScore)} />
              <Field
                label="MasteryConfidence"
                value={formatNumber(model.masteryConfidence)}
              />
              <Field label="NextReviewAt" value={model.nextReviewAt ?? "—"} />
              <Field label="EvidenceCount" value={String(model.evidenceCount)} />
              <Field
                label="DistinctPracticeDays"
                value={String(model.distinctPracticeDays)}
              />
              <Field
                label="DistinctTaskTypes"
                value={String(model.distinctTaskTypes)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {VOCABULARY_SKILLS.map((skill) => {
                const state = model.skills[skill];
                return (
                  <div key={skill} className="rounded-lg border p-3">
                    <div className="mb-2 font-medium">{skill}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span>score {formatNumber(state.score)}</span>
                      <span>confidence {formatNumber(state.confidence)}</span>
                      <span>attempts {state.totalAttempts}</span>
                      <span>
                        independent {state.consecutiveIndependentSuccesses}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weaknesses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {model.weaknesses.length === 0 ? (
                <p className="text-muted-foreground text-sm">None yet.</p>
              ) : (
                model.weaknesses.map((weakness) => (
                  <div key={weakness.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{weakness.type}</span>
                      <Badge variant={weakness.resolvedAt ? "secondary" : "destructive"}>
                        {weakness.resolvedAt ? "resolved" : "open"}
                      </Badge>
                    </div>
                    <div>severity {formatNumber(weakness.severity)}</div>
                    <div>{weakness.reason.code}</div>
                    {weakness.relatedWordId ? (
                      <div>related {weakness.relatedWordId}</div>
                    ) : null}
                  </div>
                ))
              )}
              {unresolvedWeaknesses.length === 0 && model.weaknesses.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  All recorded weaknesses are resolved. History is kept.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Evidence</CardTitle>
            <CardDescription>
              This form only creates LearningEvidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SelectField
              label="skill"
              value={form.skill}
              options={VOCABULARY_SKILLS}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  skill: value as VocabularySkill,
                }))
              }
            />
            <SelectField
              label="outcome"
              value={form.outcome}
              options={Object.values(EvidenceOutcome)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  outcome: value as EvidenceOutcome,
                }))
              }
            />
            <SelectField
              label="promptMode"
              value={form.promptMode}
              options={Object.values(PromptMode)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  promptMode: value as PromptMode,
                }))
              }
            />
            <SelectField
              label="answerMode"
              value={form.answerMode}
              options={Object.values(AnswerMode)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  answerMode: value as AnswerMode,
                }))
              }
            />
            <TextField
              label="difficulty"
              value={form.difficulty}
              onChange={(value) =>
                setForm((current) => ({ ...current, difficulty: value }))
              }
            />
            <TextField
              label="responseTimeMs"
              value={form.responseTimeMs}
              onChange={(value) =>
                setForm((current) => ({ ...current, responseTimeMs: value }))
              }
            />
            <TextField
              label="hintCount"
              value={form.hintCount}
              onChange={(value) =>
                setForm((current) => ({ ...current, hintCount: value }))
              }
            />
            <TextField
              label="sessionId"
              value={form.sessionId}
              onChange={(value) =>
                setForm((current) => ({ ...current, sessionId: value }))
              }
            />
            <TextField
              label="occurredAt"
              value={form.occurredAt}
              onChange={(value) =>
                setForm((current) => ({ ...current, occurredAt: value }))
              }
            />
            <SelectField
              label="errorType"
              value={form.errorType}
              options={["", ...Object.values(EvidenceErrorType)]}
              onChange={(value) =>
                setForm((current) => ({ ...current, errorType: value }))
              }
            />
            <TextField
              label="selectedWord"
              value={form.selectedWordId}
              onChange={(value) =>
                setForm((current) => ({ ...current, selectedWordId: value }))
              }
            />
            <TextField
              label="taskType"
              value={form.taskType}
              onChange={(value) =>
                setForm((current) => ({ ...current, taskType: value }))
              }
            />
            <Button onClick={onProcessEvidence} disabled={busy}>
              Process Evidence
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Transition Reasons</CardTitle>
          <CardDescription>
            Why the word upgraded, did not upgrade, faded, or gained a weakness.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(lastTransition?.reasons.length ? lastTransition.reasons : allReasons.slice(-8))
            .length === 0 ? (
            <p className="text-muted-foreground text-sm">No transitions yet.</p>
          ) : (
            (lastTransition?.reasons ?? []).map((reason, index) => (
              <div key={`${reason.code}-${index}`} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{reason.code}</div>
                <div>{reason.message}</div>
                {reason.metadata ? (
                  <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
                    {JSON.stringify(reason.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
          {allReasons.length > 0 ? (
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-medium">
                Full reason history ({allReasons.length})
              </summary>
              <div className="mt-2 space-y-2">
                {allReasons.map((reason, index) => (
                  <div key={`all-${reason.code}-${index}`} className="text-sm">
                    <span className="font-medium">{reason.code}</span>
                    {": "}
                    {reason.message}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No evidence yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">
                  {item.occurredAt} · {item.skill} · {item.outcome}
                </div>
                <div className="text-muted-foreground">
                  {item.promptMode} / {item.answerMode} / session {item.sessionId}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={label}>{label}</Label>
      <select
        id={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
      >
        {options.map((option) => (
          <option key={option || "none"} value={option}>
            {option || "(none)"}
          </option>
        ))}
      </select>
    </div>
  );
}
