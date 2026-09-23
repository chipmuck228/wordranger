/**
 * Frame-scoped grounding helpers. Candidate V0 / Experimental.
 * Fact identity is { frameId, factId }, never array order.
 */

import type {
  ContextualBuildContent,
  ContextualConnectFactBinding,
  ContextualFactRef,
  ContextualSceneLexemeContent,
  ResolvedContextualFact,
} from "./types";

export function frameFactsFor(
  lexeme: ContextualSceneLexemeContent,
  frameId: string,
): ContextualFactRef[] {
  const groups = lexeme.grounding.frameFacts.filter((item) => item.frameId === frameId);
  if (groups.length !== 1) {
    return [];
  }
  return groups[0]!.facts;
}

export function connectFactIdFor(
  lexeme: ContextualSceneLexemeContent,
  frameId: string,
): string | undefined {
  const bindings = (lexeme.build.connectFactByFrame ?? []).filter(
    (item) => item.frameId === frameId,
  );
  if (bindings.length !== 1) {
    return undefined;
  }
  return bindings[0]!.factId;
}

export function connectBindings(
  lexeme: ContextualSceneLexemeContent,
): ContextualConnectFactBinding[] {
  return [...(lexeme.build.connectFactByFrame ?? [])];
}

export function resolvedFactsForFrame(
  lexeme: ContextualSceneLexemeContent,
  frameId: string,
): ResolvedContextualFact[] {
  return frameFactsFor(lexeme, frameId).map((fact) => ({
    factId: fact.factId,
    predicate: fact.predicate,
    args: fact.args.map((arg) => ({ ...arg })),
    caption: fact.caption,
  }));
}

export function resolvedBuildForFrame(
  lexeme: ContextualSceneLexemeContent,
  frameId: string,
): ContextualBuildContent {
  return {
    enabled: lexeme.build.enabled,
    groundInstruction: lexeme.build.groundInstruction,
    connectInstruction: lexeme.build.connectInstruction,
    connectFactId: connectFactIdFor(lexeme, frameId),
    teachInstruction: lexeme.build.teachInstruction,
    fadeInstruction: lexeme.build.fadeInstruction,
    recallInstructionKey: lexeme.build.recallInstructionKey,
  };
}
