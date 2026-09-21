/**
 * Structural snapshot from an authored pack.
 * Does not invent display form, IPA, or Evidence.
 * Plan factories may use this; UI must use resolveSceneContent.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
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
  if (!frame) {
    return null;
  }
  return {
    packId: pack.id,
    sceneClusterId: pack.sceneClusterId,
    skeletonId: pack.skeletonId,
    frame: {
      ...frame,
      entityIds: [...frame.entityIds],
      factIds: [...frame.factIds],
      presentationOrder: [...frame.presentationOrder],
    },
    lexemes: [...pack.lexemes]
      .sort((left, right) => left.membership.sceneOrder - right.membership.sceneOrder)
      .map((lexeme) => snapshotLexeme(lexeme, pack)),
  };
}

function snapshotLexeme(
  lexeme: ContextualSceneContentPack["lexemes"][number],
  pack: ContextualSceneContentPack,
): ResolvedContextualSceneLexeme {
  return {
    id: lexeme.id,
    target: { ...lexeme.target },
    fixtureSense: { ...lexeme.fixtureSense },
    canonicalKey: lexeme.canonicalKey,
    displayForm: "",
    meaningGloss: "",
    displayLabel: lexeme.lexicalPresentation.displayLabel,
    frameId: lexeme.membership.frameIds[0] ?? "",
    entityId: lexeme.membership.entityId,
    roleId: lexeme.membership.roleId,
    sceneOrder: lexeme.membership.sceneOrder,
    presentationToken: lexeme.membership.presentationToken,
    publicVisualRole: lexeme.membership.publicVisualRole,
    groundingFacts: lexeme.grounding.facts.map((fact) => ({
      factId: fact.factId,
      predicate: fact.predicate,
      args: fact.args.map((arg) => ({ ...arg })),
      caption: fact.caption,
    })),
    requiredRelationIds: [...(lexeme.grounding.requiredRelationIds ?? [])],
    contrasts: lexeme.contrastBindings.map((binding) => {
      const other = pack.lexemes.find((item) =>
        sameLexemeSense(item.target, binding.contrastTarget),
      );
      return {
        kind: binding.kind,
        contrastTarget: { ...binding.contrastTarget },
        contrastEntityId: other?.membership.entityId ?? "",
        instruction: binding.instruction,
        caption: binding.caption,
      };
    }),
    probe: { ...lexeme.probe, skills: [...lexeme.probe.skills] },
    build: { ...lexeme.build },
    strengthen: { ...lexeme.strengthen },
  };
}
