/**
 * Resolves a validated Scene Content pack against runtime authorities.
 * Fail closed. No spoon fallback. No invented IPA.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { ContextFrame, SemanticSkeleton } from "../domain/types";
import type { SceneVocabularyCluster } from "../memory-routing/types";
import { SceneContentErrorCode } from "./errors";
import { validateSceneContent } from "./validate-scene-content";
import type {
  ContextualSceneContentPack,
  ResolvedContextualContrast,
  ResolvedContextualFact,
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
  SceneLexemeLoader,
} from "./types";

export function resolveSceneContent(input: {
  pack: ContextualSceneContentPack;
  frame: ContextFrame;
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
    .sort((left, right) => left.membership.sceneOrder - right.membership.sceneOrder)
    .map((lexeme) => resolveLexeme(lexeme, input.pack, input.loadLexeme));
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
    content: freezeContent({
      packId: input.pack.id,
      sceneClusterId: input.pack.sceneClusterId,
      skeletonId: input.pack.skeletonId,
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
  loadLexeme: SceneLexemeLoader,
): ResolvedContextualSceneLexeme | null {
  const bundled = loadLexeme(lexeme.canonicalKey);
  const displayForm = bundled?.display.trim() || bundled?.lemma.trim() || "";
  const meaningGloss = bundled?.meaningsZh[0]?.trim() || "";
  const phonetic = bundled?.ipa[0]?.trim() || undefined;
  if (!bundled || bundled.id !== lexeme.target.lexemeId || !displayForm || !meaningGloss) {
    return null;
  }
  const contrasts: ResolvedContextualContrast[] = lexeme.contrastBindings.map((binding) => {
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
  });
  if (contrasts.some((item) => !item.contrastEntityId)) {
    return null;
  }
  const groundingFacts: ResolvedContextualFact[] = lexeme.grounding.facts.map((fact) => ({
    factId: fact.factId,
    predicate: fact.predicate,
    args: fact.args.map((arg) => ({ ...arg })),
    caption: fact.caption,
  }));
  return {
    id: lexeme.id,
    target: { ...lexeme.target },
    fixtureSense: { ...lexeme.fixtureSense },
    canonicalKey: lexeme.canonicalKey,
    displayForm,
    meaningGloss,
    phonetic,
    displayLabel: lexeme.lexicalPresentation.displayLabel,
    frameId: lexeme.membership.frameIds[0] ?? "",
    entityId: lexeme.membership.entityId,
    roleId: lexeme.membership.roleId,
    sceneOrder: lexeme.membership.sceneOrder,
    presentationToken: lexeme.membership.presentationToken,
    publicVisualRole: lexeme.membership.publicVisualRole,
    groundingFacts,
    requiredRelationIds: [...(lexeme.grounding.requiredRelationIds ?? [])],
    contrasts,
    probe: {
      ...lexeme.probe,
      skills: [...lexeme.probe.skills],
    },
    build: { ...lexeme.build },
    strengthen: { ...lexeme.strengthen },
  };
}

function freezeContent(
  content: ResolvedContextualSceneContent,
): ResolvedContextualSceneContent {
  return deepFreeze(structuredClone(content));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
