"use client";

import { useEffect, useRef, useState } from "react";
import { ContextLabErrorState } from "@/components/context-lab/ContextLabErrorState";
import { ContextLabHeader } from "@/components/context-lab/ContextLabHeader";
import { ContextLabShell } from "@/components/context-lab/ContextLabShell";
import { FrozenTaskPreview } from "@/components/context-lab/FrozenTaskPreview";
import { GuidedActivityPanel } from "@/components/context-lab/GuidedActivityPanel";
import { PilotBoundaryNotice } from "@/components/context-lab/PilotBoundaryNotice";
import {
  CONTEXT_LAB_HEADING_ID,
  type ContextLabPilotPayload,
  type ContextLabScreen,
} from "@/components/context-lab/types";

const TRANSITION_MS = 160;

type PresentationState =
  | "GUIDED_STEP"
  | "TRANSITIONING"
  | "FROZEN_TASK_PREVIEW"
  | "PILOT_BOUNDARY"
  | "ERROR";

export function ContextLabClient({
  payload,
}: {
  payload: ContextLabPilotPayload;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [previewText, setPreviewText] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);

  const lastIndex = Math.max(payload.screens.length - 1, 0);
  const safeIndex = Math.min(Math.max(stepIndex, 0), lastIndex);
  const screen = payload.screens[safeIndex];
  const headerContext = payload.screens.find(
    (
      item,
    ): item is Extract<
      ContextLabScreen,
      { kind: "GUIDED" | "FROZEN_TASK_PREVIEW" }
    > => item.kind === "GUIDED" || item.kind === "FROZEN_TASK_PREVIEW",
  )?.context;

  useEffect(() => {
    return () => {
      clearPendingTransition();
    };
  }, []);

  useEffect(() => {
    if (transitioning) {
      return;
    }
    document.getElementById(CONTEXT_LAB_HEADING_ID)?.focus();
  }, [safeIndex, transitioning]);

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

  function goTo(nextIndex: number): void {
    if (transitioningRef.current) {
      return;
    }
    const clamped = Math.min(Math.max(nextIndex, 0), lastIndex);
    if (clamped === safeIndex) {
      return;
    }
    if (prefersReducedMotion()) {
      setStepIndex(clamped);
      setTransitioning(false);
      return;
    }
    transitioningRef.current = true;
    setTransitioning(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      transitioningRef.current = false;
      setStepIndex(clamped);
      setTransitioning(false);
    }, TRANSITION_MS);
  }

  function restart(): void {
    clearPendingTransition();
    setTransitioning(false);
    setStepIndex(0);
    setPreviewText("");
  }

  function acknowledgeGuided(): void {
    if (transitioningRef.current) {
      return;
    }
    const next = payload.screens[safeIndex + 1];
    if (!next || next.kind === "PILOT_BOUNDARY") {
      return;
    }
    goTo(safeIndex + 1);
  }

  function openBoundary(): void {
    if (transitioningRef.current) {
      return;
    }
    const boundaryIndex = payload.screens.findIndex(
      (item) => item.kind === "PILOT_BOUNDARY",
    );
    if (boundaryIndex >= 0) {
      goTo(boundaryIndex);
    }
  }

  if (!screen) {
    return (
      <ContextLabShell>
        <ContextLabErrorState
          screen={{
            kind: "ERROR",
            title: "这个体验暂时无法加载。",
            message: "缺少可展示的内容。",
            code: "MISSING_PUBLIC_PRESENTATION",
          }}
        />
      </ContextLabShell>
    );
  }

  const presentationState = stateFor(screen, transitioning);

  return (
    <ContextLabShell transitioning={transitioning} onRestart={restart}>
      <div
        data-presentation-state={presentationState}
        className="flex min-w-0 flex-1 flex-col gap-6"
      >
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {transitioning ? "" : liveAnnouncement(screen)}
        </p>
        {screen.kind === "ERROR" ? <ContextLabErrorState screen={screen} /> : null}
        {screen.kind === "GUIDED" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <GuidedActivityPanel
              screen={screen}
              disabled={transitioning}
              onAcknowledge={acknowledgeGuided}
            />
          </>
        ) : null}
        {screen.kind === "FROZEN_TASK_PREVIEW" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <FrozenTaskPreview
              screen={screen}
              value={previewText}
              disabled={transitioning}
              onValueChange={setPreviewText}
              onOpenBoundary={openBoundary}
            />
          </>
        ) : null}
        {screen.kind === "PILOT_BOUNDARY" ? (
          <>
            <ContextLabHeader
              title={headerContext?.title ?? "早餐时间"}
              settingLabel={
                headerContext?.settingLabel ?? "看看桌上的食物和餐具。"
              }
              progress={screen.progress}
            />
            <PilotBoundaryNotice screen={screen} />
          </>
        ) : null}
      </div>
    </ContextLabShell>
  );
}

function liveAnnouncement(screen: ContextLabScreen): string {
  if (screen.kind === "ERROR") {
    return screen.title;
  }
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。这是输入预览，提交功能尚未接入。`;
  }
  if (screen.kind === "PILOT_BOUNDARY") {
    return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。体验已到达学习任务交接点。`;
  }
  return `第 ${screen.progress.current} 步，共 ${screen.progress.total} 步。`;
}

function stateFor(
  screen: ContextLabScreen,
  transitioning: boolean,
): PresentationState {
  if (transitioning) {
    return "TRANSITIONING";
  }
  if (screen.kind === "ERROR") {
    return "ERROR";
  }
  if (screen.kind === "FROZEN_TASK_PREVIEW") {
    return "FROZEN_TASK_PREVIEW";
  }
  if (screen.kind === "PILOT_BOUNDARY") {
    return "PILOT_BOUNDARY";
  }
  return "GUIDED_STEP";
}
