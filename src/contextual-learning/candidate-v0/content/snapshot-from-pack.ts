/**
 * Structural snapshot from an authored pack for one frame.
 * Does not invent display form, IPA, or Evidence.
 * Plan factories may use this; UI must use resolveSceneContent.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import { resolvedBuildForFrame, resolvedFactsForFrame } from "./frame-facts";
import { frameBindingFor } from "./frame-binding";
import type {
  ContextualSceneContentPack,
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
} from "./types";

export function snapshotSceneContentFromPack(
  pack: ContextualSceneContentPack,
  frameId: string,
): ResolvedContextualSceneContent | null {
  const frame = pack.frames.find((item) => item.frameId === frameId);
  if (!frame || !pack.planning) {
    return null;
  }
  const lexemes = pack.lexemes
    .filter((lexeme) => frameBindingFor(lexeme, frameId))
    .map((lexeme) => snapshotLexeme(lexeme, pack, frameId))
    .filter((item): item is ResolvedContextualSceneLexeme => item !== null)
    .sort((left, right) => left.sceneOrder - right.sceneOrder);
  return {
    packId: pack.id,
    sceneClusterId: pack.sceneClusterId,
    skeletonId: pack.skeletonId,
    activeGoalId: pack.planning.activeGoalId,
    planIdNamespace: pack.planning.planIdNamespace,
    sourceLearningNeedRef: pack.planning.sourceLearningNeedRef,
    guidedRationales: { ...pack.planning.guidedRationales },
    frame: {
      ...frame,
      entityIds: [...frame.entityIds],
      factIds: [...frame.factIds],
      presentationOrder: [...frame.presentationOrder],
    },
    lexemes,
  };
}

function snapshotLexeme(
  lexeme: ContextualSceneContentPack["lexemes"][number],
  pack: ContextualSceneContentPack,
  frameId: string,
): ResolvedContextualSceneLexeme | null {
  const binding = frameBindingFor(lexeme, frameId);
  const frame = pack.frames.find((item) => item.frameId === frameId);
  if (!binding || !frame) {
    return null;
  }
  return {
    id: lexeme.id,
    target: { ...lexeme.target },
    fixtureSense: { ...lexeme.fixtureSense },
    canonicalKey: lexeme.canonicalKey,
    displayForm: "",
    meaningGloss: "",
    displayLabel: lexeme.lexicalPresentation.displayLabel,
    frameId,
    entityId: binding.entityId,
    roleId: binding.roleId,
    sceneOrder: binding.sceneOrder,
    presentationToken: lexeme.membership.presentationToken,
    presentationRole: lexeme.membership.presentationRole,
    groundingFacts: resolvedFactsForFrame(lexeme, frameId),
    requiredRelationIds: [...(lexeme.grounding.requiredRelationIds ?? [])],
    contrasts: lexeme.contrastBindings.flatMap((item) => {
      const other = pack.lexemes.find((candidate) =>
        sameLexemeSense(candidate.target, item.contrastTarget),
      );
      const otherBinding = other ? frameBindingFor(other, frameId) : null;
      if (!otherBinding) {
        return [];
      }
      return [
        {
          kind: item.kind,
          contrastTarget: { ...item.contrastTarget },
          contrastEntityId: otherBinding.entityId,
          instruction: item.instruction,
          caption: item.caption,
        },
      ];
    }),
    probe: { ...lexeme.probe, skills: [...lexeme.probe.skills] },
    build: resolvedBuildForFrame(lexeme, frameId),
    strengthen: { ...lexeme.strengthen },
  };
}
