"use client";

import { useEffect, useRef, useState } from "react";
import { ContextLabErrorState } from "@/components/context-lab/ContextLabErrorState";
import { ContextLabHeader } from "@/components/context-lab/ContextLabHeader";
import { ContextLabRecordedNotice } from "@/components/context-lab/ContextLabRecordedNotice";
import { ContextLabShell } from "@/components/context-lab/ContextLabShell";
import { FrozenTaskPreview } from "@/components/context-lab/FrozenTaskPreview";
import { GuidedActivityPanel } from "@/components/context-lab/GuidedActivityPanel";
import { ProbeIntroPanel } from "@/components/context-lab/ProbeIntroPanel";
import { ProbeSummaryPanel } from "@/components/context-lab/ProbeSummaryPanel";
import { withClientGameTimeout } from "@/components/game/shared/bounded-game-operation";
import {
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_HEADING_ID,
  CONTEXT_LAB_NETWORK_MESSAGE,
  type ContextLabCurrentScreen,
} from "@/components/context-lab/types";

const TRANSITION_MS = 160;

type PresentationState =
  | "LOADING"
  | "GUIDED_STEP"
  | "TRANSITIONING"
  | "FROZEN_TASK_PREVIEW"
  | "FROZEN_TASK_RECORDED"
  | "PROBE_INTRO"
  | "PROBE_SUMMARY"
  | "ERROR";

export interface ContextLabClientOps {
  start: () => Promise<ContextLabCurrentScreen>;
  acknowledge: (input: {
    runId: string;
    revision: number;
    activityId: string;
  }) => Promise<ContextLabCurrentScreen>;
  restart: () => Promise<ContextLabCurrentScreen>;
  loadCurrent?: (input: { runId: string }) => Promise<ContextLabCurrentScreen>;
  submitFrozenTask: (input: {
    runId: string;
    revision: number;
    taskId: string;
    action:
      | { kind: "TEXT_INPUT"; value: string }
      | { kind: "CHOICE"; optionId: string };
    responseTimeMs?: number | null;
  }) => Promise<ContextLabCurrentScreen>;
  continueProbe?: (input: {
    runId: string;
    revision: number;
    handoff?: boolean;
  }) => Promise<ContextLabCurrentScreen>;
}

export function ContextLabClient({
  start,
  acknowledge,
  restart,
  loadCurrent,
  submitFrozenTask,
  continueProbe,
  initialScreen,
}: ContextLabClientOps & {
  initialScreen?: ContextLabCurrentScreen;
}) {
  const [screen, setScreen] = useState<ContextLabCurrentScreen | null>(
    initialScreen ?? null,
  );
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(Boolean(initialScreen));
  const requestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const mutationRef = useRef(false);
  const previewStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      clearPendingTransition();
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void begin(start);
    // start is a stable server action for the page lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen?.kind === "FROZEN_TASK_PREVIEW") {
      previewStartedAtRef.current = Date.now();
    }
  }, [screen]);

  useEffect(() => {
    if (transitioning || !screen || screen.kind === "ERROR") {
      return;
    }
    document.getElementById(CONTEXT_LAB_HEADING_ID)?.focus();
  }, [screen, transitioning]);

  function clearPendingTransition(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    transitioningRef.current = false;
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  async function begin(
    operation: () => Promise<ContextLabCurrentScreen>,
  ): Promise<void> {
    const requestId = ++requestIdRef.current;
    setBusy(true);
    setActionError(null);
    try {
      const outcome = await withClientGameTimeout(operation());
      if (requestId !== requestIdRef.current) {
        return;
      }
      setBusy(false);
      if (outcome.timedOut) {
        setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
        return;
      }
      applyScreen(outcome.value);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setBusy(false);
      setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
    }
  }

  function applyScreen(next: ContextLabCurrentScreen): void {
    if (next.kind === "ERROR") {
      if (next.recoverable && screen && screen.kind !== "ERROR") {
        setActionError(next.message);
        setBusy(false);
        mutationRef.current = false;
        return;
      }
      setScreen(next);
      setActionError(null);
      return;
    }
    setActionError(null);
    setScreen(next);
  }

  function revealScreen(next: ContextLabCurrentScreen): void {
    if (prefersReducedMotion()) {
      transitioningRef.current = false;
      setTransitioning(false);
      applyScreen(next);
      return;
    }
    transitioningRef.current = true;
    setTransitioning(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      transitioningRef.current = false;
      setTransitioning(false);
      applyScreen(next);
    }, TRANSITION_MS);
  }

  async function acknowledgeGuided(): Promise<void> {
    if (
      busy ||
      mutationRef.current ||
      transitioningRef.current ||
      screen?.kind !== "GUIDED"
    ) {
      return;
    }
    mutationRef.current = true;
    setBusy(true);
    setActionError(null);
    const requestId = ++requestIdRef.current;
    try {
      const outcome = await withClientGameTimeout(
        acknowledge({
          runId: screen.handle.runId,
          revision: screen.handle.revision,
          activityId: screen.activity.id,
        }),
      );
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      if (outcome.timedOut) {
        setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
        return;
      }
      if (outcome.value.kind === "ERROR") {
        if (
          outcome.value.code.startsWith(
            CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
          ) &&
          loadCurrent
        ) {
          const recovered = await withClientGameTimeout(
            loadCurrent({ runId: screen.handle.runId }),
          );
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (!recovered.timedOut && recovered.value.kind !== "ERROR") {
            revealScreen(recovered.value);
            return;
          }
        }
        applyScreen(outcome.value);
        return;
      }
      revealScreen(outcome.value);
    } catch {
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
    }
  }

  async function continueProbeIntent(handoff = false): Promise<void> {
    if (
      busy ||
      mutationRef.current ||
      transitioningRef.current ||
      !continueProbe ||
      !screen ||
      (screen.kind !== "PROBE_INTRO" &&
        screen.kind !== "FROZEN_TASK_RECORDED" &&
        screen.kind !== "PROBE_SUMMARY")
    ) {
      return;
    }
    mutationRef.current = true;
    setBusy(true);
    setActionError(null);
    const requestId = ++requestIdRef.current;
    try {
      const outcome = await withClientGameTimeout(
        continueProbe({
          runId: screen.handle.runId,
          revision: screen.handle.revision,
          handoff,
        }),
      );
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      if (outcome.timedOut) {
        setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
        return;
      }
      if (outcome.value.kind === "ERROR") {
        applyScreen(outcome.value);
        return;
      }
      revealScreen(outcome.value);
    } catch {
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
    }
  }

  async function submitFrozenIntent(
    intent:
      | { kind: "TEXT_INPUT"; value: string }
      | { kind: "CHOICE"; optionId: string },
  ): Promise<void> {
    if (
      busy ||
      mutationRef.current ||
      transitioningRef.current ||
      screen?.kind !== "FROZEN_TASK_PREVIEW"
    ) {
      return;
    }
    mutationRef.current = true;
    setBusy(true);
    setActionError(null);
    const requestId = ++requestIdRef.current;
    const responseTimeMs =
      previewStartedAtRef.current == null
        ? null
        : Date.now() - previewStartedAtRef.current;
    try {
      const outcome = await withClientGameTimeout(
        submitFrozenTask({
          runId: screen.handle.runId,
          revision: screen.handle.revision,
          taskId: screen.task.id,
          action: intent,
          responseTimeMs,
        }),
      );
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      if (outcome.timedOut) {
        setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
        return;
      }
      if (outcome.value.kind === "ERROR") {
        applyScreen(outcome.value);
        return;
      }
      revealScreen(outcome.value);
    } catch {
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      setActionError(CONTEXT_LAB_NETWORK_MESSAGE);
    }
  }

  function onRestart(): void {
    clearPendingTransition();
    setTransitioning(false);
    setScreen(null);
    startedRef.current = true;
    mutationRef.current = false;
    previewStartedAtRef.current = null;
    void begin(restart);
  }

  const headerContext =
    screen?.kind === "GUIDED" ||
    screen?.kind === "FROZEN_TASK_PREVIEW" ||
    screen?.kind === "PROBE_INTRO" ||
    screen?.kind === "PROBE_SUMMARY"
      ? screen.context
      : undefined;

  const presentationState = stateFor(screen, transitioning, busy);

  return (
    <ContextLabShell
      transitioning={transitioning || busy}
      onRestart={onRestart}
      restartDisabled={false}
    >
      <div
        data-presentation-state={presentationState}
        className="flex min-w-0 flex-1 flex-col gap-6"
      >
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {transitioning || busy ? "" : liveAnnouncement(screen)}
        </p>
        {actionError ? (
          <p role="alert" className="text-destructive text-sm leading-relaxed">
            {actionError}
          </p>
        ) : null}
        {!screen ? (
          <p className="text-muted-foreground text-sm">正在准备体验…</p>
        ) : null}
        {screen?.kind === "ERROR" ? (
          <ContextLabErrorState screen={screen} />
        ) : null}
        {screen?.kind === "PROBE_INTRO" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <ProbeIntroPanel
              screen={screen}
              disabled={busy || transitioning}
              onContinue={() => {
                void continueProbeIntent(false);
              }}
            />
          </>
        ) : null}
        {screen?.kind === "PROBE_SUMMARY" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <ProbeSummaryPanel
              screen={screen}
              disabled={busy || transitioning}
              onHandoff={() => {
                void continueProbeIntent(true);
              }}
            />
          </>
        ) : null}
        {screen?.kind === "GUIDED" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <GuidedActivityPanel
              screen={screen}
              disabled={busy || transitioning}
              onAcknowledge={() => {
                void acknowledgeGuided();
              }}
            />
          </>
        ) : null}
        {screen?.kind === "FROZEN_TASK_PREVIEW" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <FrozenTaskPreview
              screen={screen}
              disabled={busy || transitioning}
              onAction={(intent) => {
                void submitFrozenIntent(intent);
              }}
            />
          </>
        ) : null}
        {screen?.kind === "FROZEN_TASK_RECORDED" ? (
          <>
            <ContextLabHeader
              title={headerContext?.title ?? "早餐时间"}
              settingLabel={
                headerContext?.settingLabel ?? "看看桌上的食物和餐具。"
              }
              progress={screen.progress}
            />
            <ContextLabRecordedNotice
              screen={screen}
              disabled={busy || transitioning}
              onContinue={
                screen.continueAvailable
                  ? () => {
                      void continueProbeIntent(false);
                    }
                  : undefined
              }
            />
          </>
        ) : null}
      </div>
    </ContextLabShell>
  );
}

function liveAnnouncement(screen: ContextLabCurrentScreen | null): string {
  if (!screen) {
    return "正在准备体验。";
  }
  if (screen.kind === "ERROR") {
    return screen.title;
  }
  if (screen.kind === "PROBE_INTRO") {
    return "先看看你已经会了哪些词。教学还没开始。";
  }
  if (screen.kind === "PROBE_SUMMARY") {
    return "这次检查的下一步建议。";
  }
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    return `第 ${screen.progress.current} 个物品，共 ${screen.progress.total} 个物品。`;
  }
  if (screen.kind === "FROZEN_TASK_RECORDED") {
    return `${screen.feedback.message} ${screen.recordedMessage}`;
  }
  return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。`;
}

function stateFor(
  screen: ContextLabCurrentScreen | null,
  transitioning: boolean,
  busy: boolean,
): PresentationState {
  if (transitioning || (busy && screen?.kind === "GUIDED")) {
    return "TRANSITIONING";
  }
  if (!screen) {
    return "LOADING";
  }
  if (screen.kind === "ERROR") {
    return "ERROR";
  }
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    return "FROZEN_TASK_PREVIEW";
  }
  if (screen.kind === "FROZEN_TASK_RECORDED") {
    return "FROZEN_TASK_RECORDED";
  }
  if (screen.kind === "PROBE_INTRO") {
    return "PROBE_INTRO";
  }
  if (screen.kind === "PROBE_SUMMARY") {
    return "PROBE_SUMMARY";
  }
  return "GUIDED_STEP";
}
