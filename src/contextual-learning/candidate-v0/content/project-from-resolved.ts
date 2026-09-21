/**
 * Candidate compatibility projections from resolved Scene Content.
 * These adapters must not keep a second authored truth.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualProbeTarget } from "../probe/types";
import type { MealLexicalStrengthenIdentity } from "../strengthen/meal-lexical-profiles";
import type { MealLexicalStrengthenProfile } from "../strengthen/types";
import type { MealLexicalBuildProfile } from "../build/types";
import type {
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
} from "./types";

export function projectProbeTargets(
  content: ResolvedContextualSceneContent,
): ContextualProbeTarget[] {
  return content.lexemes
    .filter((lexeme) => lexeme.probe.enabled)
    .map((lexeme) => ({
      target: { ...lexeme.target },
      sceneClusterId: content.sceneClusterId,
      roleId: lexeme.roleId,
      entityId: lexeme.entityId,
      displayLabel: lexeme.displayLabel,
      probeSkills: [...lexeme.probe.skills],
    }));
}

export function projectQueueCatalog(
  content: ResolvedContextualSceneContent,
): { target: LexemeSenseRef; entityId: string }[] {
  return content.lexemes.map((lexeme) => ({
    target: { ...lexeme.target },
    entityId: lexeme.entityId,
  }));
}

export function projectStrengthenIdentity(
  lexeme: ResolvedContextualSceneLexeme,
): MealLexicalStrengthenIdentity {
  return {
    target: { ...lexeme.target },
    fixtureLexemeId: lexeme.fixtureSense.lexemeId,
    fixtureSense: { ...lexeme.fixtureSense },
    sceneClusterId: "",
    entityId: lexeme.entityId,
    roleId: lexeme.roleId,
    canonicalKey: lexeme.canonicalKey,
    stepToken: lexeme.presentationToken,
  };
}

export function projectStrengthenProfile(
  lexeme: ResolvedContextualSceneLexeme,
  sceneClusterId: string,
): MealLexicalStrengthenProfile {
  return {
    ...projectStrengthenIdentity(lexeme),
    sceneClusterId,
    displayForm: lexeme.displayForm,
    meaningGloss: lexeme.meaningGloss,
    displayLabel: lexeme.displayLabel,
    phonetic: lexeme.phonetic,
  };
}

export function projectBuildProfile(
  lexeme: ResolvedContextualSceneLexeme,
  sceneClusterId: string,
): MealLexicalBuildProfile {
  const connectFact = lexeme.groundingFacts.find(
    (fact) => fact.factId === lexeme.build.connectFactId,
  );
  const related = connectFact?.args.find(
    (arg) => arg.kind === "ENTITY" && arg.entityId !== lexeme.entityId,
  );
  return {
    ...projectStrengthenProfile(lexeme, sceneClusterId),
    relatedEntityId: related && related.kind === "ENTITY" ? related.entityId : undefined,
    relationPredicate: connectFact?.predicate,
    contrastEntityId: lexeme.contrasts[0]?.contrastEntityId ?? lexeme.entityId,
    groundingInstruction: lexeme.build.groundInstruction,
    connectInstruction: lexeme.build.connectInstruction,
    teachInstruction: lexeme.build.teachInstruction,
    contrastInstruction: lexeme.contrasts[0]?.instruction ?? "",
    fadeInstruction: lexeme.build.fadeInstruction,
    recallInstructionKey: lexeme.build.recallInstructionKey,
  };
}

export function findResolvedLexeme(
  content: ResolvedContextualSceneContent,
  target: LexemeSenseRef,
): ResolvedContextualSceneLexeme | null {
  return (
    content.lexemes.find(
      (lexeme) =>
        sameLexemeSense(lexeme.target, target) ||
        sameLexemeSense(lexeme.fixtureSense, target),
    ) ?? null
  );
}
