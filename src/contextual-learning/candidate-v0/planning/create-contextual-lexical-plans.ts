/**
 * Generic BUILD/STRENGTHEN plan factories consume resolved Scene Content.
 * They do not import Meal fixtures or recognize soup/bowl/spoon/fork.
 */

import { findResolvedLexeme } from "../content/project-from-resolved";
import type {
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
} from "../content/types";
import { sameLexemeSense } from "../domain/lexeme-sense";
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

function entityIdOnFrame(
  frame: ContextFrame,
  sense: LexemeSenseRef,
): string | null {
  return (
    frame.entityBindings.find((entity) =>
      entity.lexemeSenseBindings?.some((binding) =>
        sameLexemeSense(binding.sense, sense),
      ),
    )?.entityId ?? null
  );
}

function remapCatalogEntity(
  catalogEntityId: string,
  content: ResolvedContextualSceneContent,
  frame: ContextFrame,
): string | null {
  const lexeme = content.lexemes.find((item) => item.entityId === catalogEntityId);
  if (!lexeme) {
    return null;
  }
  return entityIdOnFrame(frame, lexeme.fixtureSense);
}

function presentedSceneEntityIds(
  content: ResolvedContextualSceneContent,
  frame: ContextFrame,
): string[] {
  return content.frame.presentationOrder.flatMap((catalogId) => {
    const remapped = remapCatalogEntity(catalogId, content, frame);
    return remapped ? [remapped] : [];
  });
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
      input.frame.skeletonId === input.content.skeletonId,
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
  const entityId = entityIdOnFrame(input.frame, lexeme!.fixtureSense);
  const contrastCatalogId = lexeme!.contrasts[0]?.contrastEntityId;
  const contrastEntityId = contrastCatalogId
    ? remapCatalogEntity(contrastCatalogId, input.content, input.frame)
    : null;
  const relatedCatalogId = lexeme!.groundingFacts
    .find((fact) => fact.factId === lexeme!.build.connectFactId)
    ?.args.find(
      (arg): arg is { kind: "ENTITY"; entityId: string } =>
        arg.kind === "ENTITY" && arg.entityId !== lexeme!.entityId,
    )?.entityId;
  const relatedEntityId = relatedCatalogId
    ? remapCatalogEntity(relatedCatalogId, input.content, input.frame)
    : null;
  if (!entityId || !contrastEntityId || (relatedCatalogId && !relatedEntityId)) {
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
      presentedEntityIds: presentedSceneEntityIds(input.content, input.frame),
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
  const entityId = entityIdOnFrame(input.frame, lexeme!.fixtureSense);
  if (!entityId) {
    return emptyPlan(input.frame, input.content, "STRENGTHEN");
  }
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
