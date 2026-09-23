"use client";

import { useEffect, useRef, useState } from "react";
import { ContextLabErrorState } from "@/components/context-lab/ContextLabErrorState";
import { ContextLabHeader } from "@/components/context-lab/ContextLabHeader";
import {
  ContextLabInlineStatus,
  inlineRecordedCopy,
} from "@/components/context-lab/ContextLabInlineStatus";
import { ContextLabRecordedNotice } from "@/components/context-lab/ContextLabRecordedNotice";
import { ContextLabShell } from "@/components/context-lab/ContextLabShell";
import { FrozenTaskPreview } from "@/components/context-lab/FrozenTaskPreview";
import { GuidedActivityPanel } from "@/components/context-lab/GuidedActivityPanel";
import { ProbeIntroPanel } from "@/components/context-lab/ProbeIntroPanel";
import { ProbeSummaryPanel } from "@/components/context-lab/ProbeSummaryPanel";
import { withClientGameTimeout } from "@/components/game/shared/bounded-game-operation";
import {
  CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE,
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_HEADING_ID,
  CONTEXT_LAB_INLINE_RECORDED_STATUS,
  CONTEXT_LAB_NETWORK_MESSAGE,
  formatContextLabProgress,
  shouldAutoAdvanceRecorded,
  type ContextLabCurrentScreen,
  type ContextLabHandoffIntent,
} from "@/components/context-lab/types";

const TRANSITION_MS = 160;
const AUTO_CONTINUE_MS = 450;
const STRENGTHEN_RUN_STORAGE_KEY = "context-lab-strengthen-run";

type PresentationState =
  | "LOADING"
  | "GUIDED_STEP"
  | "TRANSITIONING"
  | "FROZEN_TASK_PREVIEW"
  | "FROZEN_TASK_RECORDED"
  | "PROBE_TASK_RECORDED"
  | "PROBE_INTRO"
  | "PROBE_SUMMARY"
  | "ERROR";

type FrozenPreviewScreen = Extract<
  ContextLabCurrentScreen,
  { kind: "FROZEN_TASK_PREVIEW" }
>;
type AutoRecordedScreen = Extract<
  ContextLabCurrentScreen,
  { kind: "PROBE_TASK_RECORDED" | "FROZEN_TASK_RECORDED" }
>;
type InlineStatus = "RECORDED" | "CONTINUE_FAILED" | null;

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
    intent?: ContextLabHandoffIntent;
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
  const [heldPreview, setHeldPreview] = useState<FrozenPreviewScreen | null>(
    null,
  );
  const [inlineStatus, setInlineStatus] = useState<InlineStatus>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(Boolean(initialScreen));
  const requestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const mutationRef = useRef(false);
  const autoAdvancingRef = useRef(false);
  const lastPreviewRef = useRef<FrozenPreviewScreen | null>(
    initialScreen?.kind === "FROZEN_TASK_PREVIEW" ? initialScreen : null,
  );
  const previewStartedAtRef = useRef<number | null>(null);
  const mountedAutoRef = useRef(false);

  useEffect(() => {
    return () => {
      clearPendingTransition();
      clearAutoAdvanceTimer();
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const stored =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(STRENGTHEN_RUN_STORAGE_KEY);
    if (stored && loadCurrent) {
      startedRef.current = true;
      void begin(() => loadCurrent({ runId: stored }));
      return;
    }
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
      lastPreviewRef.current = screen;
      previewStartedAtRef.current = Date.now();
    }
  }, [screen]);

  useEffect(() => {
    if (transitioning || !screen || screen.kind === "ERROR") {
      return;
    }
    if (inlineStatus === "RECORDED" || inlineStatus === "CONTINUE_FAILED") {
      return;
    }
    document.getElementById(CONTEXT_LAB_HEADING_ID)?.focus();
  }, [screen, transitioning, inlineStatus]);

  useEffect(() => {
    if (mountedAutoRef.current) {
      return;
    }
    if (screen && shouldAutoAdvanceRecorded(screen) && "handle" in screen) {
      mountedAutoRef.current = true;
      setHeldPreview(lastPreviewRef.current);
      setInlineStatus("RECORDED");
      autoAdvancingRef.current = true;
      scheduleAutoContinue(screen.handle);
    }
    // initial recorded screen only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPendingTransition(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    transitioningRef.current = false;
  }

  function clearAutoAdvanceTimer(): void {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
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
      setHeldPreview(null);
      setInlineStatus(null);
      autoAdvancingRef.current = false;
      setScreen(next);
      setActionError(null);
      return;
    }
    persistStrengthenRun(next);
    setActionError(null);
    if (next.kind === "FROZEN_TASK_PREVIEW") {
      lastPreviewRef.current = next;
      setHeldPreview(null);
      setInlineStatus(null);
      autoAdvancingRef.current = false;
      setScreen(next);
      return;
    }
    if (shouldAutoAdvanceRecorded(next) && "handle" in next) {
      setHeldPreview(lastPreviewRef.current);
      setInlineStatus("RECORDED");
      autoAdvancingRef.current = true;
      setScreen(next);
      scheduleAutoContinue(next.handle);
      return;
    }
    setHeldPreview(null);
    setInlineStatus(null);
    autoAdvancingRef.current = false;
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

  function scheduleAutoContinue(handle: {
    runId: string;
    revision: number;
  }): void {
    clearAutoAdvanceTimer();
    const delay = prefersReducedMotion() ? 0 : AUTO_CONTINUE_MS;
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      void runAutoContinue(handle);
    }, delay);
  }

  async function runAutoContinue(handle: {
    runId: string;
    revision: number;
  }): Promise<void> {
    if (!continueProbe || mutationRef.current) {
      return;
    }
    mutationRef.current = true;
    setBusy(true);
    setActionError(null);
    const requestId = ++requestIdRef.current;
    try {
      const outcome = await withClientGameTimeout(
        continueProbe({
          runId: handle.runId,
          revision: handle.revision,
        }),
      );
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      if (outcome.timedOut) {
        setBusy(false);
        mutationRef.current = false;
        autoAdvancingRef.current = false;
        setInlineStatus("CONTINUE_FAILED");
        return;
      }
      if (outcome.value.kind === "ERROR") {
        setBusy(false);
        mutationRef.current = false;
        autoAdvancingRef.current = false;
        if (outcome.value.recoverable) {
          setInlineStatus("CONTINUE_FAILED");
          return;
        }
        applyScreen(outcome.value);
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      autoAdvancingRef.current = false;
      setHeldPreview(null);
      setInlineStatus(null);
      revealScreen(outcome.value);
    } catch {
      if (requestId !== requestIdRef.current) {
        mutationRef.current = false;
        return;
      }
      setBusy(false);
      mutationRef.current = false;
      autoAdvancingRef.current = false;
      setInlineStatus("CONTINUE_FAILED");
    }
  }

  function retryAutoContinue(): void {
    if (
      !screen ||
      !("handle" in screen) ||
      !shouldAutoAdvanceRecorded(screen) ||
      mutationRef.current
    ) {
      return;
    }
    setInlineStatus("RECORDED");
    autoAdvancingRef.current = true;
    void runAutoContinue(screen.handle);
  }

  async function acknowledgeGuided(): Promise<void> {
    if (
      busy ||
      mutationRef.current ||
      transitioningRef.current ||
      autoAdvancingRef.current ||
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

  async function continueProbeIntent(intent?: ContextLabHandoffIntent): Promise<void> {
    if (
      busy ||
      mutationRef.current ||
      transitioningRef.current ||
      autoAdvancingRef.current ||
      !continueProbe ||
      !screen ||
      (screen.kind !== "PROBE_INTRO" &&
        screen.kind !== "PROBE_TASK_RECORDED" &&
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
          intent,
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
      autoAdvancingRef.current ||
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
      if (shouldAutoAdvanceRecorded(outcome.value)) {
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
    clearAutoAdvanceTimer();
    setTransitioning(false);
    setHeldPreview(null);
    setInlineStatus(null);
    lastPreviewRef.current = null;
    autoAdvancingRef.current = false;
    setScreen(null);
    startedRef.current = true;
    mutationRef.current = false;
    previewStartedAtRef.current = null;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STRENGTHEN_RUN_STORAGE_KEY);
    }
    void begin(restart);
  }

  const autoRecorded = Boolean(screen && shouldAutoAdvanceRecorded(screen));
  const headerContext =
    heldPreview?.context ??
    (screen?.kind === "GUIDED" ||
    screen?.kind === "FROZEN_TASK_PREVIEW" ||
    screen?.kind === "PROBE_INTRO" ||
    screen?.kind === "PROBE_SUMMARY"
      ? screen.context
      : undefined);
  const headerProgress =
    screen && "progress" in screen ? screen.progress : heldPreview?.progress;
  const presentationState = stateFor(screen, transitioning, busy, autoRecorded);
  const controlsLocked = busy || transitioning || autoAdvancingRef.current;

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
          {transitioning && !inlineStatus
            ? ""
            : liveAnnouncement(screen, inlineStatus)}
        </p>
        {screen && "handle" in screen && screen.handle.contentReleaseId ? (
          <p className="sr-only" data-testid="context-lab-content-pin">
            {screen.handle.contentReleaseId}
          </p>
        ) : null}
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
              disabled={controlsLocked}
              onContinue={() => {
                void continueProbeIntent();
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
              disabled={controlsLocked}
              onHandoff={(intent) => {
                void continueProbeIntent(intent);
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
              disabled={controlsLocked}
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
              disabled={controlsLocked}
              onAction={(intent) => {
                void submitFrozenIntent(intent);
              }}
            />
          </>
        ) : null}
        {autoRecorded && screen ? (
          <>
            <ContextLabHeader
              title={headerContext?.title ?? "早餐时间"}
              settingLabel={
                headerContext?.settingLabel ??
                (screen.kind === "PROBE_TASK_RECORDED"
                  ? "先看看你已经会了哪些词"
                  : "看看桌上的食物和餐具。")
              }
              progress={
                headerProgress ??
                ("progress" in screen
                  ? screen.progress
                  : { current: 0, total: 0 })
              }
            />
            {heldPreview ? (
              <FrozenTaskPreview
                screen={heldPreview}
                disabled
                onAction={() => undefined}
              />
            ) : null}
            <ContextLabInlineStatus
              status={inlineStatus ?? "RECORDED"}
              message={inlineRecordedCopy({
                kind: screen.kind as AutoRecordedScreen["kind"],
                recordedMessage:
                  screen.kind === "FROZEN_TASK_RECORDED"
                    ? screen.recordedMessage
                    : undefined,
              })}
              screenKind={screen.kind as AutoRecordedScreen["kind"]}
              onRetry={
                inlineStatus === "CONTINUE_FAILED" ? retryAutoContinue : undefined
              }
            />
          </>
        ) : null}
        {screen?.kind === "PROBE_TASK_RECORDED" && !autoRecorded ? (
          <>
            <ContextLabHeader
              title="早餐时间"
              settingLabel="先看看你已经会了哪些词"
              progress={screen.progress}
            />
            <ContextLabInlineStatus
              status="RECORDED"
              message={CONTEXT_LAB_INLINE_RECORDED_STATUS}
              screenKind="PROBE_TASK_RECORDED"
            />
          </>
        ) : null}
        {screen?.kind === "FROZEN_TASK_RECORDED" && !autoRecorded ? (
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
              disabled={controlsLocked}
              onContinue={
                screen.continueAvailable
                  ? () => {
                      void continueProbeIntent();
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

function liveAnnouncement(
  screen: ContextLabCurrentScreen | null,
  inlineStatus: InlineStatus,
): string {
  if (inlineStatus === "CONTINUE_FAILED") {
    return CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE;
  }
  if (inlineStatus === "RECORDED" && screen) {
    if (screen.kind === "PROBE_TASK_RECORDED") {
      return CONTEXT_LAB_INLINE_RECORDED_STATUS;
    }
    if (screen.kind === "FROZEN_TASK_RECORDED") {
      return screen.recordedMessage;
    }
  }
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
  if (screen.kind === "FROZEN_TASK_PREVIEW" || screen.kind === "GUIDED") {
    return spokenProgress(screen.progress);
  }
  if (screen.kind === "PROBE_TASK_RECORDED") {
    return CONTEXT_LAB_INLINE_RECORDED_STATUS;
  }
  return screen.queueCompleteMessage
    ? `${screen.recordedMessage} ${screen.queueCompleteMessage}`
    : screen.recordedMessage;
}

function spokenProgress(progress: {
  current: number;
  total: number;
  unit?: string;
}): string {
  if (progress.current <= 0) {
    return `这次检查共 ${progress.total} 个目标词。`;
  }
  if (progress.unit === "个目标词") {
    return `正在检查第 ${progress.current} 个词，共 ${progress.total} 个。`;
  }
  if (progress.unit === "个需要建立的词") {
    return `正在建立第 ${progress.current} 个词，共 ${progress.total} 个。`;
  }
  if (progress.unit === "个需要强化的词") {
    return `正在强化第 ${progress.current} 个词，共 ${progress.total} 个。`;
  }
  return formatContextLabProgress(progress);
}

function persistStrengthenRun(screen: ContextLabCurrentScreen): void {
  if (typeof window === "undefined" || !("handle" in screen)) {
    return;
  }
  const persistExperience =
    screen.kind === "GUIDED" ||
    (screen.kind === "FROZEN_TASK_PREVIEW" &&
      (screen.strengthenPhase === "VERIFY" || screen.buildPhase === "VERIFY")) ||
    (screen.kind === "FROZEN_TASK_RECORDED" &&
      Boolean(screen.queueCompleteMessage || screen.continueLabel));
  if (persistExperience) {
    window.sessionStorage.setItem(STRENGTHEN_RUN_STORAGE_KEY, screen.handle.runId);
    return;
  }
  if (
    screen.kind === "PROBE_INTRO" ||
    screen.kind === "PROBE_SUMMARY" ||
    screen.kind === "PROBE_TASK_RECORDED" ||
    screen.kind === "FROZEN_TASK_PREVIEW"
  ) {
    window.sessionStorage.removeItem(STRENGTHEN_RUN_STORAGE_KEY);
  }
}

function stateFor(
  screen: ContextLabCurrentScreen | null,
  transitioning: boolean,
  busy: boolean,
  autoRecorded: boolean | null,
): PresentationState {
  if (transitioning || (busy && screen?.kind === "GUIDED" && !autoRecorded)) {
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
  if (screen.kind === "PROBE_TASK_RECORDED") {
    return "PROBE_TASK_RECORDED";
  }
  if (screen.kind === "PROBE_INTRO") {
    return "PROBE_INTRO";
  }
  if (screen.kind === "PROBE_SUMMARY") {
    return "PROBE_SUMMARY";
  }
  return "GUIDED_STEP";
}
