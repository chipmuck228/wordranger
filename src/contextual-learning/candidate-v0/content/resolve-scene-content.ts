/**
 * Resolves a validated Scene Content pack against one runtime frame.
 * Fail closed. No spoon fallback. No invented IPA.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { ContextFrame, SemanticSkeleton } from "../domain/types";
import type { SceneVocabularyCluster } from "../memory-routing/types";
import { SceneContentErrorCode } from "./errors";
import { connectFactIdFor, resolvedBuildForFrame, resolvedFactsForFrame } from "./frame-facts";
import { frameBindingFor } from "./frame-binding";
import { cloneFrozen } from "./immutable";
import { validateSceneContent } from "./validate-scene-content";
import type {
  ContextualSceneContentPack,
  ResolvedContextualContrast,
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
  SceneLexemeLoader,
} from "./types";

export function resolveSceneContent(input: {
  pack: ContextualSceneContentPack;
  frame: ContextFrame;
  frames?: readonly ContextFrame[];
  skeleton: SemanticSkeleton;
  cluster: SceneVocabularyCluster;
  loadLexeme: SceneLexemeLoader;
}):
  | { ok: true; content: ResolvedContextualSceneContent }
  | { ok: false; reason: typeof SceneContentErrorCode.CONTENT_PACK_UNRESOLVED; issues: { code: string; path: string }[] } {
  const validated = validateSceneContent(input);
  if (!validated.ok) {
    return {
      ok: false,
      reason: SceneContentErrorCode.CONTENT_PACK_UNRESOLVED,
      issues: validated.issues,
    };
  }
  const frameContent = input.pack.frames.find((item) => item.frameId === input.frame.id);
  if (!frameContent) {
    return {
      ok: false,
      reason: SceneContentErrorCode.CONTENT_PACK_UNRESOLVED,
      issues: [{ code: SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, path: "frames" }],
    };
  }
  const lexemes = [...input.pack.lexemes]
    .filter((lexeme) => frameBindingFor(lexeme, input.frame.id))
    .map((lexeme) => resolveLexeme(lexeme, input.pack, input.frame.id, input.loadLexeme))
    .sort((left, right) => (left?.sceneOrder ?? 0) - (right?.sceneOrder ?? 0));
  if (lexemes.some((item) => item === null)) {
    return {
      ok: false,
      reason: SceneContentErrorCode.CONTENT_PACK_UNRESOLVED,
      issues: [
        {
          code: SceneContentErrorCode.CONTENT_BUNDLED_IDENTITY_MISMATCH,
          path: "lexemes",
        },
      ],
    };
  }
  return {
    ok: true,
    content: cloneFrozen({
      packId: input.pack.id,
      sceneClusterId: input.pack.sceneClusterId,
      skeletonId: input.pack.skeletonId,
      activeGoalId: input.pack.planning.activeGoalId,
      planIdNamespace: input.pack.planning.planIdNamespace,
      sourceLearningNeedRef: input.pack.planning.sourceLearningNeedRef,
      guidedRationales: { ...input.pack.planning.guidedRationales },
      frame: {
        ...frameContent,
        entityIds: [...frameContent.entityIds],
        factIds: [...frameContent.factIds],
        presentationOrder: [...frameContent.presentationOrder],
      },
      lexemes: lexemes as ResolvedContextualSceneLexeme[],
    }),
  };
}

function resolveLexeme(
  lexeme: ContextualSceneContentPack["lexemes"][number],
  pack: ContextualSceneContentPack,
  frameId: string,
  loadLexeme: SceneLexemeLoader,
): ResolvedContextualSceneLexeme | null {
  const binding = frameBindingFor(lexeme, frameId);
  const frameContent = pack.frames.find((item) => item.frameId === frameId);
  if (!binding || !frameContent) {
    return null;
  }
  const bundled = loadLexeme(lexeme.canonicalKey);
  const displayForm = bundled?.display.trim() || bundled?.lemma.trim() || "";
  const meaningGloss = bundled?.meaningsZh[0]?.trim() || "";
  const phonetic = bundled?.ipa[0]?.trim() || undefined;
  if (!bundled || bundled.id !== lexeme.target.lexemeId || !displayForm || !meaningGloss) {
    return null;
  }
  const contrasts: ResolvedContextualContrast[] = lexeme.contrastBindings.map((item) => {
    const other = pack.lexemes.find((candidate) =>
      sameLexemeSense(candidate.target, item.contrastTarget),
    );
    const otherBinding = other ? frameBindingFor(other, frameId) : null;
    return {
      kind: item.kind,
      contrastTarget: { ...item.contrastTarget },
      contrastEntityId: otherBinding?.entityId ?? "",
      instruction: item.instruction,
      caption: item.caption,
    };
  });
  if (contrasts.some((item) => !item.contrastEntityId)) {
    return null;
  }
  const groundingFacts = resolvedFactsForFrame(lexeme, frameId);
  const connectFactId = connectFactIdFor(lexeme, frameId);
  if (connectFactId && !groundingFacts.some((fact) => fact.factId === connectFactId)) {
    return null;
  }
  return {
    id: lexeme.id,
    target: { ...lexeme.target },
    fixtureSense: { ...lexeme.fixtureSense },
    canonicalKey: lexeme.canonicalKey,
    displayForm,
    meaningGloss,
    phonetic,
    displayLabel: lexeme.lexicalPresentation.displayLabel,
    frameId,
    entityId: binding.entityId,
    roleId: binding.roleId,
    sceneOrder: binding.sceneOrder,
    presentationToken: lexeme.membership.presentationToken,
    presentationRole: lexeme.membership.presentationRole,
    groundingFacts,
    requiredRelationIds: [...(lexeme.grounding.requiredRelationIds ?? [])],
    contrasts,
    probe: {
      ...lexeme.probe,
      skills: [...lexeme.probe.skills],
    },
    build: resolvedBuildForFrame(lexeme, frameId),
    strengthen: { ...lexeme.strengthen },
  };
}
