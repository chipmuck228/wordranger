/**
 * Generic BUILD/STRENGTHEN plan factories consume resolved Scene Content.
 * They do not import Meal fixtures or recognize soup/bowl/spoon/fork.
 */

import { sameAuthoredAndFrameFactArgs } from "../content/fact-args";
import { findResolvedLexeme } from "../content/project-from-resolved";
import type {
  ResolvedContextualFact,
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
} from "../content/types";
import { curatedFixtureProvenance } from "../domain/provenance";
import type {
  ContextFrame,
  ExperienceTarget,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
  LexemeSenseRef,
} from "../domain/types";
import {
  MINIMAL_SUPPORT,
  assessable,
  completeAll,
  entityArg,
  nextOrEnd,
  pred,
} from "../fixtures/shared";

export interface ContextualLexicalPlanInput {
  frame: ContextFrame;
  content: ResolvedContextualSceneContent;
  target: LexemeSenseRef;
  stepIdPrefix: string;
  runtimeCapabilities?: { canCompileFrozenTask: boolean };
}

function presentedSceneEntityIds(
  content: ResolvedContextualSceneContent,
): string[] {
  return [...content.frame.presentationOrder];
}

function frameHasEntity(frame: ContextFrame, entityId: string): boolean {
  return frame.entityBindings.some((entity) => entity.entityId === entityId);
}

function allEntitiesOnFrame(
  frame: ContextFrame,
  entityIds: readonly (string | null | undefined)[],
): boolean {
  return entityIds
    .filter((entityId): entityId is string => Boolean(entityId))
    .every((entityId) => frameHasEntity(frame, entityId));
}

function uniqueRuntimeFact(
  frame: ContextFrame,
  fact: Pick<ResolvedContextualFact, "factId" | "predicate" | "args">,
): boolean {
  const matches = frame.initialFacts.filter((item) => item.id === fact.factId);
  if (matches.length !== 1) {
    return false;
  }
  const matched = matches[0]!;
  return (
    matched.predicate === fact.predicate &&
    sameAuthoredAndFrameFactArgs(fact.args, matched.arguments)
  );
}

function sameAuthoredFact(
  left: Pick<ResolvedContextualFact, "factId" | "predicate" | "args">,
  right: Pick<ResolvedContextualFact, "factId" | "predicate" | "args">,
): boolean {
  return (
    left.factId === right.factId &&
    left.predicate === right.predicate &&
    left.args.length === right.args.length &&
    sameAuthoredAndFrameFactArgs(left.args, right.args)
  );
}

function contentMatchesRuntimeFrame(
  content: ResolvedContextualSceneContent,
  frame: ContextFrame,
): boolean {
  if (content.frame.frameId !== frame.id) {
    return false;
  }
  for (const factId of content.frame.factIds) {
    const authored = content.lexemes
      .flatMap((lexeme) => lexeme.groundingFacts)
      .filter((fact) => fact.factId === factId);
    if (authored.length === 0) {
      if (frame.initialFacts.filter((item) => item.id === factId).length !== 1) {
        return false;
      }
      continue;
    }
    const first = authored[0]!;
    if (!authored.every((fact) => sameAuthoredFact(first, fact))) {
      return false;
    }
    if (!uniqueRuntimeFact(frame, first)) {
      return false;
    }
  }
  for (const lexeme of content.lexemes) {
    for (const fact of lexeme.groundingFacts) {
      if (!uniqueRuntimeFact(frame, fact)) {
        return false;
      }
    }
    if (lexeme.build.connectFactId) {
      const connect = lexeme.groundingFacts.filter(
        (fact) => fact.factId === lexeme.build.connectFactId,
      );
      if (connect.length !== 1 || !uniqueRuntimeFact(frame, connect[0]!)) {
        return false;
      }
    }
  }
  return true;
}

function requiredRelationIds(
  lexeme: ResolvedContextualSceneLexeme,
): string[] | undefined {
  return lexeme.requiredRelationIds.length > 0
    ? [...lexeme.requiredRelationIds]
    : undefined;
}

function connectPredicate(lexeme: ResolvedContextualSceneLexeme): string | undefined {
  const fact =
    lexeme.groundingFacts.find((item) => item.factId === lexeme.build.connectFactId) ??
    lexeme.groundingFacts[0];
  return fact?.predicate;
}

function planProvenance(content: ResolvedContextualSceneContent) {
  return curatedFixtureProvenance(`scene-content:${content.packId}`);
}

function emptyPlan(
  frame: ContextFrame,
  content: ResolvedContextualSceneContent,
  mode: "BUILD" | "STRENGTHEN",
): LearningExperiencePlan {
  const namespace = content.planIdNamespace || "contextual";
  return {
    id: `${namespace}-${mode.toLowerCase()}-${frame.id}-unresolved`,
    schemaVersion: "candidate-v0",
    mode,
    sourceLearningNeedRef: content.sourceLearningNeedRef || "need-opaque-ref",
    targets: [],
    skeletonId: frame.skeletonId,
    contextFrameId: frame.id,
    activeGoalId: content.activeGoalId,
    steps: [],
    completionPolicy: completeAll([]),
    provenance: planProvenance(content),
  };
}

function canPlan(
  input: ContextualLexicalPlanInput,
  lexeme: ResolvedContextualSceneLexeme | null,
  enabled: boolean,
): boolean {
  return Boolean(
    lexeme &&
      enabled &&
      input.content.frame.frameId === input.frame.id &&
      input.frame.skeletonId === input.content.skeletonId &&
      frameHasEntity(input.frame, lexeme.entityId) &&
      contentMatchesRuntimeFrame(input.content, input.frame),
  );
}

export function createContextualLexicalBuildPlan(
  input: ContextualLexicalPlanInput,
): LearningExperiencePlan {
  if (input.runtimeCapabilities && !input.runtimeCapabilities.canCompileFrozenTask) {
    return emptyPlan(input.frame, input.content, "BUILD");
  }
  const lexeme = findResolvedLexeme(input.content, input.target);
  if (!canPlan(input, lexeme, Boolean(lexeme?.build.enabled))) {
    return emptyPlan(input.frame, input.content, "BUILD");
  }
  const token = lexeme!.presentationToken;
  const entityId = lexeme!.entityId;
  const contrastEntityId = lexeme!.contrasts[0]?.contrastEntityId ?? null;
  const relatedEntityId = lexeme!.groundingFacts
    .find((fact) => fact.factId === lexeme!.build.connectFactId)
    ?.args.find(
      (arg): arg is { kind: "ENTITY"; entityId: string } =>
        arg.kind === "ENTITY" && arg.entityId !== lexeme!.entityId,
    )?.entityId;
  if (
    !contrastEntityId ||
    !allEntitiesOnFrame(input.frame, [
      entityId,
      contrastEntityId,
      relatedEntityId,
      ...presentedSceneEntityIds(input.content),
    ])
  ) {
    return emptyPlan(input.frame, input.content, "BUILD");
  }
  const interpretationTargetId = `target-${token}`;
  const formTargetId = `target-${token}-form`;
  const relationPredicate = connectPredicate(lexeme!);
  const interpretationTarget: ExperienceTarget = {
    id: interpretationTargetId,
    sense: lexeme!.fixtureSense,
    focus: "CONTEXT_INTERPRETATION",
    requiredRoleIds: [lexeme!.roleId],
    requiredRelationIds: requiredRelationIds(lexeme!),
  };
  const formTarget: ExperienceTarget = {
    id: formTargetId,
    sense: lexeme!.fixtureSense,
    focus: "MEANING_TO_FORM",
  };
  const bundledTarget = {
    lexemeId: lexeme!.target.lexemeId,
    senseId: lexeme!.target.senseId,
  };
  const prefix = input.stepIdPrefix;
  const rationales = input.content.guidedRationales;
  const ground: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-ground`,
    purpose: "GROUND",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_CONTEXT",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.ground,
    },
    presentation: {
      instruction: lexeme!.build.groundInstruction,
      presentedEntityIds: presentedSceneEntityIds(input.content),
    },
    transition: nextOrEnd(false),
  };
  const connect: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-connect`,
    purpose: "CONNECT",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: relationPredicate
        ? "OBSERVE_RELATION"
        : "CONNECT_ENTITY_AND_MEANING",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.connect,
    },
    presentation: {
      instruction: lexeme!.build.connectInstruction,
      presentedEntityIds: relatedEntityId ? [entityId, relatedEntityId] : [entityId],
      presentedFactPredicates: relationPredicate ? [relationPredicate] : undefined,
    },
    transition: nextOrEnd(false),
  };
  const teach: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-teach`,
    purpose: "CONNECT",
    targetIds: [formTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_LEXICAL_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.teach,
    },
    presentation: {
      instruction: lexeme!.build.teachInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["LEXICAL_FORM", "MEANING_GLOSS"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const contrast: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-contrast`,
    purpose: "DISCRIMINATE",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "SHOW_CONTRAST",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.contrast,
    },
    presentation: {
      instruction: lexeme!.contrasts[0]?.instruction ?? "",
      presentedEntityIds: [entityId, contrastEntityId],
    },
    transition: nextOrEnd(false),
  };
  const fade: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-fade`,
    purpose: "CONNECT",
    targetIds: [formTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "FADE_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.fade,
    },
    presentation: {
      instruction: lexeme!.build.fadeInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["SPELLING_CUE"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const recall = assessable({
    id: `${prefix}-build-${token}-recall`,
    purpose: "RECALL",
    targetIds: [formTargetId],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: lexeme!.build.recallInstructionKey,
      semanticQuestion: pred("name_required_object", [entityArg(entityId)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: {
      kind: "LEXICAL_FORM",
      sense: lexeme!.fixtureSense,
    },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
  const steps = [ground, connect, teach, contrast, fade, recall];
  return {
    id: `${input.content.planIdNamespace}-build-${input.frame.id}-${token}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: input.content.sourceLearningNeedRef,
    targets: [interpretationTarget, formTarget],
    skeletonId: input.frame.skeletonId,
    contextFrameId: input.frame.id,
    activeGoalId: input.content.activeGoalId,
    steps,
    completionPolicy: completeAll(steps),
    provenance: planProvenance(input.content),
  };
}

export function createContextualLexicalStrengthenPlan(
  input: ContextualLexicalPlanInput,
): LearningExperiencePlan {
  if (input.runtimeCapabilities && !input.runtimeCapabilities.canCompileFrozenTask) {
    return emptyPlan(input.frame, input.content, "STRENGTHEN");
  }
  const lexeme = findResolvedLexeme(input.content, input.target);
  if (!canPlan(input, lexeme, Boolean(lexeme?.strengthen.enabled))) {
    return emptyPlan(input.frame, input.content, "STRENGTHEN");
  }
  const token = lexeme!.presentationToken;
  const entityId = lexeme!.entityId;
  const prefix = input.stepIdPrefix;
  const targetId = `target-${token}-form`;
  const formTarget: ExperienceTarget = {
    id: targetId,
    sense: lexeme!.fixtureSense,
    focus: "MEANING_TO_FORM",
  };
  const bundledTarget = {
    lexemeId: lexeme!.target.lexemeId,
    senseId: lexeme!.target.senseId,
  };
  const rationales = input.content.guidedRationales;
  const reconnect: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-${token}-reconnect`,
    purpose: "CONNECT",
    targetIds: [targetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "RECONNECT_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.reconnect,
    },
    presentation: {
      instruction: lexeme!.strengthen.reconnectInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["LEXICAL_FORM", "MEANING_GLOSS"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const fade: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-${token}-fade`,
    purpose: "CONNECT",
    targetIds: [targetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "FADE_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale: rationales.fade,
    },
    presentation: {
      instruction: lexeme!.strengthen.fadeInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["SPELLING_CUE"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const verify = assessable({
    id: `${prefix}-strengthen-${token}-recall`,
    purpose: "RECALL",
    targetIds: [targetId],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: "Produce the English word for the highlighted object.",
      semanticQuestion: pred("name_required_object", [entityArg(entityId)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: { kind: "LEXICAL_FORM", sense: lexeme!.fixtureSense },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
  const steps = [reconnect, fade, verify];
  return {
    id: `${input.content.planIdNamespace}-strengthen-recall-${input.frame.id}-${token}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: input.content.sourceLearningNeedRef,
    targets: [formTarget],
    skeletonId: input.frame.skeletonId,
    contextFrameId: input.frame.id,
    activeGoalId: input.content.activeGoalId,
    steps,
    completionPolicy: completeAll(steps),
    provenance: planProvenance(input.content),
  };
}
