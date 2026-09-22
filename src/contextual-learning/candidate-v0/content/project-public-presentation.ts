/**
 * Stage-gated public presentation projection.
 * Never includes AnswerKey, Evidence, or learner state.
 */

import { spellingCueFromAnswerForm } from "../strengthen/spelling-cue";
import type { ResolvedContextualSceneLexeme } from "./types";

export type ScenePresentationStage =
  | "PROBE_INTRO"
  | "PROBE_ACTIVE_RECALL"
  | "PROBE_RECOGNITION"
  | "BUILD_GROUND"
  | "BUILD_CONNECT"
  | "BUILD_TEACH"
  | "BUILD_CONTRAST"
  | "BUILD_FADE"
  | "BUILD_VERIFY"
  | "STRENGTHEN_RECONNECT"
  | "STRENGTHEN_FADE"
  | "STRENGTHEN_VERIFY";

export interface PublicSceneLexemePresentation {
  stage: ScenePresentationStage;
  entityId: string;
  roleId: string;
  displayLabel: string;
  displayForm?: string;
  meaningGloss?: string;
  phonetic?: string;
  spellingCue?: string;
  relationCaption?: string;
  contrastCaption?: string;
  instruction: string;
}

export function projectPublicScenePresentation(input: {
  stage: ScenePresentationStage;
  lexeme: ResolvedContextualSceneLexeme;
}): PublicSceneLexemePresentation {
  const { stage, lexeme } = input;
  const base: PublicSceneLexemePresentation = {
    stage,
    entityId: lexeme.entityId,
    roleId: lexeme.roleId,
    displayLabel: lexeme.displayLabel,
    instruction: instructionForStage(stage, lexeme),
  };
  if (stage === "BUILD_TEACH" || stage === "STRENGTHEN_RECONNECT") {
    return {
      ...base,
      displayForm: lexeme.displayForm,
      meaningGloss: lexeme.meaningGloss,
      phonetic: lexeme.phonetic,
    };
  }
  if (stage === "BUILD_FADE" || stage === "STRENGTHEN_FADE") {
    return {
      ...base,
      spellingCue: spellingCueFromAnswerForm(lexeme.answerForm) ?? undefined,
    };
  }
  if (stage === "BUILD_CONNECT") {
    return {
      ...base,
      relationCaption: lexeme.groundingFacts[0]?.caption,
    };
  }
  if (stage === "BUILD_CONTRAST") {
    return {
      ...base,
      contrastCaption: lexeme.contrasts[0]?.caption,
    };
  }
  return base;
}

function instructionForStage(
  stage: ScenePresentationStage,
  lexeme: ResolvedContextualSceneLexeme,
): string {
  switch (stage) {
    case "BUILD_GROUND":
      return lexeme.build.groundInstruction;
    case "BUILD_CONNECT":
      return lexeme.build.connectInstruction;
    case "BUILD_TEACH":
      return lexeme.build.teachInstruction;
    case "BUILD_CONTRAST":
      return lexeme.contrasts[0]?.instruction ?? "";
    case "BUILD_FADE":
      return lexeme.build.fadeInstruction;
    case "BUILD_VERIFY":
      return lexeme.build.recallInstructionKey;
    case "STRENGTHEN_RECONNECT":
      return lexeme.strengthen.reconnectInstruction;
    case "STRENGTHEN_FADE":
      return lexeme.strengthen.fadeInstruction;
    case "STRENGTHEN_VERIFY":
      return lexeme.strengthen.verifyInstruction;
    case "PROBE_ACTIVE_RECALL":
      return lexeme.probe.recallInstruction;
    default:
      return "";
  }
}

export function presentationLeaksAnswer(
  presentation: PublicSceneLexemePresentation,
  displayForm: string,
): boolean {
  if (!displayForm.trim()) {
    return false;
  }
  const hiddenStages: ScenePresentationStage[] = [
    "PROBE_INTRO",
    "PROBE_ACTIVE_RECALL",
    "PROBE_RECOGNITION",
    "BUILD_GROUND",
    "BUILD_CONNECT",
    "BUILD_FADE",
    "BUILD_VERIFY",
    "STRENGTHEN_FADE",
    "STRENGTHEN_VERIFY",
  ];
  if (!hiddenStages.includes(presentation.stage)) {
    return false;
  }
  const needle = displayForm.trim().toLowerCase();
  return [
    presentation.displayForm,
    presentation.meaningGloss,
    presentation.phonetic,
    presentation.instruction,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}
