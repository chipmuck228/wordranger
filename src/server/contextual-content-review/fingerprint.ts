import { createHash } from "node:crypto";
import type { ContextualSceneLexemeContent } from "@/contextual-learning/candidate-v0/content/types";

function sortedJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => sortedJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
    .join(",")}}`;
}

export function contentFingerprintPayload(input: {
  packId: string;
  lexeme: ContextualSceneLexemeContent;
}): unknown {
  return {
    packId: input.packId,
    target: input.lexeme.target,
    canonicalKey: input.lexeme.canonicalKey,
    frameIds: input.lexeme.membership.frameBindings.map((item) => item.frameId),
    bindings: input.lexeme.membership.frameBindings.map((item) => ({
      frameId: item.frameId,
      entityId: item.entityId,
      roleId: item.roleId,
      sceneOrder: item.sceneOrder,
    })),
    groundingFacts: input.lexeme.grounding.frameFacts.map((group) => ({
      frameId: group.frameId,
      facts: group.facts.map((fact) => ({
        factId: fact.factId,
        predicate: fact.predicate,
        args: fact.args,
      })),
    })),
    probe: {
      enabled: input.lexeme.probe.enabled,
      skills: input.lexeme.probe.skills,
      recallInstruction: input.lexeme.probe.recallInstruction,
    },
    build: {
      enabled: input.lexeme.build.enabled,
      groundInstruction: input.lexeme.build.groundInstruction,
      connectInstruction: input.lexeme.build.connectInstruction,
      connectFactByFrame: input.lexeme.build.connectFactByFrame ?? [],
      teachInstruction: input.lexeme.build.teachInstruction,
      fadeInstruction: input.lexeme.build.fadeInstruction,
      recallInstructionKey: input.lexeme.build.recallInstructionKey,
    },
    strengthen: {
      enabled: input.lexeme.strengthen.enabled,
      reconnectInstruction: input.lexeme.strengthen.reconnectInstruction,
      fadeInstruction: input.lexeme.strengthen.fadeInstruction,
      verifyInstruction: input.lexeme.strengthen.verifyInstruction,
    },
    contrastBindings: input.lexeme.contrastBindings,
    sourceRefs: [],
  };
}

export function fingerprintContent(input: {
  packId: string;
  lexeme: ContextualSceneLexemeContent;
  sourceRefs: readonly string[];
}): string {
  const payload = contentFingerprintPayload(input);
  (payload as { sourceRefs: readonly string[] }).sourceRefs = [...input.sourceRefs];
  return createHash("sha256").update(sortedJson(payload)).digest("hex");
}
