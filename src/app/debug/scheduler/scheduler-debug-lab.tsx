"use client";

import { useMemo, useState } from "react";
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
import type { LearningNeed } from "@/domain/learning/learning-need";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskAssignment } from "@/domain/tasks/task-assignment";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import type { TaskGenerationResult } from "@/domain/tasks/task-unavailable";
import type { LearningSessionPlan, SchedulerCandidateTrace } from "@/domain/scheduler";
import { SCHEDULER_DEBUG_PROFILES } from "./profile-options";
import {
  generateTaskFromScheduledNeed,
  loadSchedulerDebugProfile,
  planDebugSchedulerSession,
  resetSchedulerDebugLab,
  submitScheduledDebugTask,
  type SchedulerOverview,
} from "./actions";
import { DEBUG_SEED } from "./debug-ids";

interface SchedulerDebugLexeme {
  id: string;
  lemma: string;
  display: string;
}

function lemmaOf(
  lexemes: SchedulerDebugLexeme[],
  lexemeId: string,
): string {
  return lexemes.find((item) => item.id === lexemeId)?.lemma ?? lexemeId;
}

function countMap(title: string, counts: Record<string, number>) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">None</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {entries.map(([key, value]) => (
          <Badge key={key} variant="secondary">
            {key}: {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function SchedulerDebugLab({
  lexemes,
}: {
  lexemes: SchedulerDebugLexeme[];
}) {
  const [seed, setSeed] = useState(DEBUG_SEED);
  const [needCount, setNeedCount] = useState("10");
  const [profileLabel, setProfileLabel] = useState("No profile loaded");
  const [overview, setOverview] = useState<SchedulerOverview | null>(null);
  const [plan, setPlan] = useState<LearningSessionPlan | null>(null);
  const [selectedNeedId, setSelectedNeedId] = useState<string | null>(null);
  const [generation, setGeneration] = useState<TaskGenerationResult | null>(null);
  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [typed, setTyped] = useState("");
  const [choiceId, setChoiceId] = useState("");
  const [evaluation, setEvaluation] = useState<TaskEvaluation | null>(null);
  const [evidence, setEvidence] = useState<LearningEvidence | null>(null);
  const [model, setModel] = useState<StudentLexemeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedNeed: LearningNeed | null =
    plan?.needs.find((need) => need.id === selectedNeedId) ?? null;
  const selectedTrace: SchedulerCandidateTrace | null =
    plan?.trace.selectedCandidates.find((item) => item.id === selectedNeedId) ??
    null;
  const generated: GeneratedLearningTask | null =
    generation?.status === "GENERATED" ? generation.value : null;

  const blockedExamples = useMemo(
    () => plan?.trace.blockedCandidates.slice(0, 12) ?? [],
    [plan],
  );

  async function onLoadProfile(profileId: (typeof SCHEDULER_DEBUG_PROFILES)[number]["id"]) {
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadSchedulerDebugProfile(profileId);
      const profile = SCHEDULER_DEBUG_PROFILES.find((item) => item.id === profileId);
      setProfileLabel(
        `${profile?.label ?? profileId} (${loaded.modelCount} models, ${loaded.userMarkedCount} user marks)`,
      );
      setPlan(null);
      setOverview(null);
      setSelectedNeedId(null);
      setGeneration(null);
      setAssignment(null);
      setEvaluation(null);
      setEvidence(null);
      setModel(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load profile");
    } finally {
      setBusy(false);
    }
  }

  async function onPlan() {
    setBusy(true);
    setError(null);
    try {
      const result = await planDebugSchedulerSession({
        seed,
        requestedNeedCount: Number(needCount) || undefined,
      });
      setPlan(result.plan);
      setOverview(result.overview);
      setSelectedNeedId(result.plan.needs[0]?.id ?? null);
      setGeneration(null);
      setAssignment(null);
      setEvaluation(null);
      setEvidence(null);
      setModel(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to plan session");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateTask() {
    if (!selectedNeed) {
      return;
    }
    setBusy(true);
    setError(null);
    setEvaluation(null);
    setEvidence(null);
    setModel(null);
    try {
      const result = await generateTaskFromScheduledNeed({
        need: selectedNeed,
        seed,
      });
      setGeneration(result.generation);
      setAssignment(result.assignment);
      if (
        result.generation.status === "GENERATED" &&
        result.generation.value.publicTask.responseContract.kind === "CHOICE"
      ) {
        setChoiceId(
          result.generation.value.publicTask.responseContract.options[0]?.id ?? "",
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
              hintCount: 0,
              responseTimeMs: 900,
              occurredAt: generated.publicTask.createdAt,
            }
          : {
              kind: "TEXT_INPUT",
              taskId: generated.publicTask.id,
              value: typed,
              hintCount: 0,
              responseTimeMs: 900,
              occurredAt: generated.publicTask.createdAt,
            };
      const result = await submitScheduledDebugTask({
        taskId: generated.publicTask.id,
        action,
      });
      setEvaluation(result.evaluation);
      setEvidence(result.evidence);
      setModel(result.learningResult.model);
      const refreshed = await planDebugSchedulerSession({
        seed,
        requestedNeedCount: Number(needCount) || undefined,
      });
      setPlan(refreshed.plan);
      setOverview(refreshed.overview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    await resetSchedulerDebugLab();
    setProfileLabel("No profile loaded");
    setPlan(null);
    setOverview(null);
    setSelectedNeedId(null);
    setGeneration(null);
    setAssignment(null);
    setEvaluation(null);
    setEvidence(null);
    setModel(null);
    setError(null);
    setTyped("");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduler Debug Lab</h1>
        <p className="text-muted-foreground text-sm">
          Inspect Learning Need generation and deterministic session planning.
          This is not student UI. The scheduler does not submit tasks.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Debug student profile</CardTitle>
          <CardDescription>{profileLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SCHEDULER_DEBUG_PROFILES.map((profile) => (
              <Button
                key={profile.id}
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void onLoadProfile(profile.id)}
              >
                {profile.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="seed">Seed</Label>
              <Input
                id="seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="need-count">Requested need count</Label>
              <Input
                id="need-count"
                value={needCount}
                onChange={(event) => setNeedCount(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void onPlan()}>
              Generate Session Plan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onReset()}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {overview ? (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <p className="text-sm">Total lexemes: {overview.totalLexemes}</p>
            <p className="text-sm">Unseen: {overview.unseenCount}</p>
            <p className="text-sm">Due: {overview.dueCount}</p>
            <p className="text-sm">Unresolved weaknesses: {overview.weaknessCount}</p>
            {countMap("Models by mastery stage", overview.modelsByStage)}
            {countMap("Retention", overview.retentionCounts)}
            {countMap("Candidates by reason", overview.candidateCountByReason)}
            {countMap("Blocked by skill", overview.blockedCountBySkill)}
            {countMap("Blocked by reason", overview.blockedCountByReason)}
          </CardContent>
        </Card>
      ) : null}

      {plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Selected session plan</CardTitle>
            <CardDescription>
              Policy {plan.schedulerPolicyVersion} · {plan.needs.length} /{" "}
              {plan.requestedNeedCount} needs · id {plan.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.needs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Empty plan.</p>
            ) : (
              plan.needs.map((need, index) => (
                <button
                  key={need.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    selectedNeedId === need.id ? "border-foreground" : ""
                  }`}
                  onClick={() => setSelectedNeedId(need.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{index + 1}</Badge>
                    <span className="font-medium">
                      {lemmaOf(lexemes, need.lexemeId)}
                    </span>
                    <Badge variant="secondary">{need.targetSkill}</Badge>
                    <Badge variant="outline">{need.reason}</Badge>
                    <span className="text-muted-foreground">
                      p={need.priority.toFixed(3)}
                    </span>
                  </div>
                  {need.supportingReasons?.length ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      supporting: {need.supportingReasons.join(", ")}
                    </p>
                  ) : null}
                  {need.weaknessFocus ? (
                    <p className="text-muted-foreground text-xs">
                      weakness {need.weaknessFocus.type}
                      {need.weaknessFocus.relatedLexemeId
                        ? ` → ${lemmaOf(lexemes, need.weaknessFocus.relatedLexemeId)}`
                        : ""}
                    </p>
                  ) : null}
                  {need.avoidRecentTaskTypes.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      avoid {need.avoidRecentTaskTypes.join(", ")}
                    </p>
                  ) : null}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedNeed && selectedTrace ? (
        <Card>
          <CardHeader>
            <CardTitle>Priority breakdown</CardTitle>
            <CardDescription>{selectedTrace.explanation}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm md:grid-cols-2">
            <p>Reason base: {selectedTrace.priorityBreakdown?.reasonBase.toFixed(3)}</p>
            <p>Weakness boost: {selectedTrace.priorityBreakdown?.weaknessBoost.toFixed(3)}</p>
            <p>Overdue boost: {selectedTrace.priorityBreakdown?.overdueBoost.toFixed(3)}</p>
            <p>Fading boost: {selectedTrace.priorityBreakdown?.fadingBoost.toFixed(3)}</p>
            <p>Skill gap: {selectedTrace.priorityBreakdown?.skillGapBoost.toFixed(3)}</p>
            <p>
              Confidence:{" "}
              {selectedTrace.priorityBreakdown?.confidenceAdjustment.toFixed(3)}
            </p>
            <p>
              Recency penalty:{" "}
              {selectedTrace.priorityBreakdown?.recencyPenalty.toFixed(3)}
            </p>
            <p>Final score: {selectedTrace.priorityBreakdown?.finalRawScore.toFixed(3)}</p>
            <p>Final priority: {selectedNeed.priority.toFixed(3)}</p>
            <p>Source rule: {selectedTrace.sourceRuleId}</p>
            <div className="md:col-span-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onGenerateTask()}
              >
                Generate Task from this need
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {blockedExamples.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Blocked candidates</CardTitle>
            <CardDescription>
              Pedagogical needs that cannot currently be served.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {blockedExamples.map((item) => (
              <div key={item.id} className="rounded-md border px-3 py-2">
                <p>
                  {lemmaOf(lexemes, item.lexemeId)} · {item.skill} · {item.reason}
                </p>
                <p className="text-muted-foreground">
                  BLOCKED · {item.blockedReason}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {generation?.status === "UNAVAILABLE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Task generation unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Code: {generation.code}</p>
            <p>{generation.reason}</p>
            <p className="text-muted-foreground mt-2">
              The selected need was not substituted.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {generated ? (
        <Card>
          <CardHeader>
            <CardTitle>Generated LearningTask</CardTitle>
            <CardDescription>
              {generated.publicTask.taskType} · {generated.publicTask.targetSkill}
              {assignment
                ? ` · assigned ${assignment.userId}/${assignment.sessionId}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{JSON.stringify(generated.publicTask.prompt)}</p>
            {generated.publicTask.responseContract.kind === "CHOICE" ? (
              <div className="space-y-1">
                <Label>Option id</Label>
                <Input
                  value={choiceId}
                  onChange={(event) => setChoiceId(event.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Typed answer</Label>
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              </div>
            )}
            <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
              Submit through existing pipeline
            </Button>
            {evaluation ? <p>Outcome: {evaluation.outcome}</p> : null}
            {evidence ? <p>Evidence: {evidence.id}</p> : null}
            {model ? (
              <p>
                Model after submit: {model.masteryStage} / {model.retentionState} /
                weaknesses {model.weaknesses.filter((item) => item.resolvedAt === null).length}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {plan ? (
        <details className="rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">SchedulerTrace JSON</summary>
          <pre className="mt-2 overflow-auto text-xs">
            {JSON.stringify(plan.trace, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
