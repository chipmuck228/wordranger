"use client";

import { useEffect, useRef, useState } from "react";
import { ContextLabErrorState } from "@/components/context-lab/ContextLabErrorState";
import { ContextLabHeader } from "@/components/context-lab/ContextLabHeader";
import { ContextLabShell } from "@/components/context-lab/ContextLabShell";
import { FrozenTaskPreview } from "@/components/context-lab/FrozenTaskPreview";
import { GuidedActivityPanel } from "@/components/context-lab/GuidedActivityPanel";
import { PilotBoundaryNotice } from "@/components/context-lab/PilotBoundaryNotice";
import { withClientGameTimeout } from "@/components/game/shared/bounded-game-operation";
import {
  CONTEXT_LAB_BOUNDARY_MESSAGE,
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
  | "FROZEN_TASK_HANDOFF_READY"
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
}

export function ContextLabClient({
  start,
  acknowledge,
  restart,
  loadCurrent,
  initialScreen,
}: ContextLabClientOps & {
  initialScreen?: ContextLabCurrentScreen;
}) {
  const [screen, setScreen] = useState<ContextLabCurrentScreen | null>(
    initialScreen ?? null,
  );
  const [previewText, setPreviewText] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(Boolean(initialScreen));
  const requestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const mutationRef = useRef(false);

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
    if (transitioning || !screen || screen.kind === "ERROR") {
      return;
    }
    document.getElementById(CONTEXT_LAB_HEADING_ID)?.focus();
  }, [screen, transitioning, handoffOpen]);

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
    setHandoffOpen(false);
    if (next.kind === "ERROR") {
      if (next.recoverable && screen && screen.kind !== "ERROR") {
        setActionError(next.message);
        setBusy(false);
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

  function openBoundary(): void {
    if (busy || transitioningRef.current || screen?.kind !== "FROZEN_TASK_PREVIEW") {
      return;
    }
    setHandoffOpen(true);
  }

  function onRestart(): void {
    clearPendingTransition();
    setTransitioning(false);
    setPreviewText("");
    setHandoffOpen(false);
    setScreen(null);
    startedRef.current = true;
    mutationRef.current = false;
    void begin(restart);
  }

  const visibleScreen = handoffOpen && screen?.kind === "FROZEN_TASK_PREVIEW"
    ? {
        kind: "FROZEN_TASK_HANDOFF_READY" as const,
        handle: screen.handle,
        message: CONTEXT_LAB_BOUNDARY_MESSAGE,
        progress: screen.progress,
      }
    : screen;

  const headerContext =
    screen?.kind === "GUIDED" || screen?.kind === "FROZEN_TASK_PREVIEW"
      ? screen.context
      : undefined;

  const presentationState = stateFor(visibleScreen, transitioning, busy);

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
          {transitioning || busy ? "" : liveAnnouncement(visibleScreen)}
        </p>
        {actionError ? (
          <p role="alert" className="text-destructive text-sm leading-relaxed">
            {actionError}
          </p>
        ) : null}
        {!visibleScreen ? (
          <p className="text-muted-foreground text-sm">正在准备体验…</p>
        ) : null}
        {visibleScreen?.kind === "ERROR" ? (
          <ContextLabErrorState screen={visibleScreen} />
        ) : null}
        {visibleScreen?.kind === "GUIDED" ? (
          <>
            <ContextLabHeader
              title={visibleScreen.context.title}
              settingLabel={visibleScreen.context.settingLabel}
              progress={visibleScreen.progress}
            />
            <GuidedActivityPanel
              screen={visibleScreen}
              disabled={busy || transitioning}
              onAcknowledge={() => {
                void acknowledgeGuided();
              }}
            />
          </>
        ) : null}
        {visibleScreen?.kind === "FROZEN_TASK_PREVIEW" ? (
          <>
            <ContextLabHeader
              title={visibleScreen.context.title}
              settingLabel={visibleScreen.context.settingLabel}
              progress={visibleScreen.progress}
            />
            <FrozenTaskPreview
              screen={visibleScreen}
              value={previewText}
              disabled={busy || transitioning}
              onValueChange={setPreviewText}
              onOpenBoundary={openBoundary}
            />
          </>
        ) : null}
        {visibleScreen?.kind === "FROZEN_TASK_HANDOFF_READY" ? (
          <>
            <ContextLabHeader
              title={headerContext?.title ?? "早餐时间"}
              settingLabel={
                headerContext?.settingLabel ?? "看看桌上的食物和餐具。"
              }
              progress={visibleScreen.progress}
            />
            <PilotBoundaryNotice screen={visibleScreen} />
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
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。这是输入预览，提交功能尚未接入。`;
  }
  if (screen.kind === "FROZEN_TASK_HANDOFF_READY") {
    return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。体验已到达学习任务交接点。`;
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
  if (screen.kind === "FROZEN_TASK_HANDOFF_READY") {
    return "FROZEN_TASK_HANDOFF_READY";
  }
  return "GUIDED_STEP";
}
