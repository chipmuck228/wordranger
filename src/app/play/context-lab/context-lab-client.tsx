"use client";

import { useState } from "react";
import { ContextLabErrorState } from "@/components/context-lab/ContextLabErrorState";
import { ContextLabHeader } from "@/components/context-lab/ContextLabHeader";
import { ContextLabShell } from "@/components/context-lab/ContextLabShell";
import { FrozenTaskPreview } from "@/components/context-lab/FrozenTaskPreview";
import { GuidedActivityPanel } from "@/components/context-lab/GuidedActivityPanel";
import { PilotBoundaryNotice } from "@/components/context-lab/PilotBoundaryNotice";
import type { ContextLabPilotPayload, ContextLabScreen } from "@/components/context-lab/types";

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

  const screen = payload.screens[stepIndex] ?? payload.screens[0];
  const headerContext = payload.screens.find(
    (
      item,
    ): item is Extract<
      ContextLabScreen,
      { kind: "GUIDED" | "FROZEN_TASK_PREVIEW" }
    > => item.kind === "GUIDED" || item.kind === "FROZEN_TASK_PREVIEW",
  )?.context;
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

  function restart(): void {
    setStepIndex(0);
    setPreviewText("");
    setTransitioning(false);
  }

  function goTo(nextIndex: number): void {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setStepIndex(nextIndex);
      return;
    }
    setTransitioning(true);
    window.setTimeout(() => {
      setStepIndex(nextIndex);
      setTransitioning(false);
    }, 160);
  }

  function acknowledgeGuided(): void {
    const next = payload.screens[stepIndex + 1];
    if (!next || next.kind === "PILOT_BOUNDARY") {
      return;
    }
    goTo(stepIndex + 1);
  }

  function openBoundary(): void {
    const boundaryIndex = payload.screens.findIndex(
      (item) => item.kind === "PILOT_BOUNDARY",
    );
    if (boundaryIndex >= 0) {
      goTo(boundaryIndex);
    }
  }

  const presentationState = stateFor(screen, transitioning);

  return (
    <ContextLabShell transitioning={transitioning} onRestart={restart}>
      <div data-presentation-state={presentationState} className="flex flex-1 flex-col gap-6">
        {screen.kind === "ERROR" ? <ContextLabErrorState screen={screen} /> : null}
        {screen.kind === "GUIDED" ? (
          <>
            <ContextLabHeader
              title={screen.context.title}
              settingLabel={screen.context.settingLabel}
              progress={screen.progress}
            />
            <GuidedActivityPanel screen={screen} onAcknowledge={acknowledgeGuided} />
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
              onValueChange={setPreviewText}
              onOpenBoundary={openBoundary}
            />
          </>
        ) : null}
        {screen.kind === "PILOT_BOUNDARY" ? (
          <>
            <ContextLabHeader
              title={headerContext?.title ?? "早餐时间"}
              settingLabel={headerContext?.settingLabel ?? "看看桌上的食物和餐具。"}
              progress={screen.progress}
            />
            <PilotBoundaryNotice screen={screen} />
          </>
        ) : null}
      </div>
    </ContextLabShell>
  );
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
