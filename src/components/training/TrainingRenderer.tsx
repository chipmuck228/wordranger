"use client";

import { MatchingGame } from "@/components/game/matching/MatchingGame";
import { RangerTrial } from "@/components/game/ranger-trial/RangerTrial";
import { SnakeGame } from "@/components/game/snake/SnakeGame";
import { WordBubble } from "@/components/game/word-bubble/WordBubble";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";
import {
  MATCHING_GAME_TYPE,
  RANGER_TRIAL_GAME_TYPE,
  SNAKE_GAME_TYPE,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";
import { TRAINING_RENDERER_COPY } from "./renderer-copy";

export function TrainingRenderer(props: {
  rendererGameType: string;
  task: PublicLearningTask;
  current: number;
  total: number;
  disabled: boolean;
  result?: "correct" | "incorrect";
  selectedOptionId?: string | null;
  logicalTickMs?: number;
  onAction(intent: StudentActionIntent): void;
}) {
  const copy = TRAINING_RENDERER_COPY[props.rendererGameType];
  const instruction = copy?.instruction;
  const label = copy?.label;
  return (
    <div className="flex flex-col gap-4" data-renderer={props.rendererGameType}>
      {label ? (
        <p className="text-muted-foreground text-center text-xs">{label}</p>
      ) : null}
      {instruction ? (
        <p className="text-muted-foreground text-center text-sm">{instruction}</p>
      ) : null}
      {props.rendererGameType === RANGER_TRIAL_GAME_TYPE ? (
        <RangerTrial
          task={props.task}
          current={props.current}
          total={props.total}
          disabled={props.disabled}
          showProgress={false}
          onAction={props.onAction}
        />
      ) : null}
      {props.rendererGameType === WORD_BUBBLE_GAME_TYPE ? (
        <WordBubble
          task={props.task}
          current={props.current}
          total={props.total}
          disabled={props.disabled}
          selectedOptionId={props.selectedOptionId}
          result={props.result}
          showProgress={false}
          onAction={props.onAction}
        />
      ) : null}
      {props.rendererGameType === MATCHING_GAME_TYPE ? (
        <MatchingGame
          task={props.task}
          current={props.current}
          total={props.total}
          disabled={props.disabled}
          result={props.result}
          showProgress={false}
          onAction={props.onAction}
        />
      ) : null}
      {props.rendererGameType === SNAKE_GAME_TYPE ? (
        <SnakeGame
          task={props.task}
          current={props.current}
          total={props.total}
          disabled={props.disabled}
          result={props.result}
          logicalTickMs={props.logicalTickMs}
          showProgress={false}
          onAction={props.onAction}
        />
      ) : null}
    </div>
  );
}
