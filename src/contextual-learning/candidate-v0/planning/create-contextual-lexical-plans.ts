/**
 * Generic BUILD/STRENGTHEN plan factories consume resolved Scene Content.
 * They do not recognize soup/bowl/spoon/fork.
 */

import { findResolvedLexeme } from "../content/project-from-resolved";
import type {
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
} from "../content/types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type {
  ContextFrame,
  ExperienceTarget,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
  LexemeSenseRef,
} from "../domain/types";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  assessable,
  completeAll,
  entityArg,
  nextOrEnd,
  pred,
} from "../fixtures/shared";
import { MEAL_SKELETON_ID } from "../fixtures/meal/skeleton";

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

function emptyPlan(
  frame: ContextFrame,
  mode: "BUILD" | "STRENGTHEN",
): LearningExperiencePlan {
  return {
    id: `contextual-${mode.toLowerCase()}-${frame.id}-unresolved`,
    schemaVersion: "candidate-v0",
    mode,
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps: [],
    completionPolicy: completeAll([]),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createContextualLexicalBuildPlan(
  input: ContextualLexicalPlanInput,
): LearningExperiencePlan {
  if (input.runtimeCapabilities && !input.runtimeCapabilities.canCompileFrozenTask) {
    return emptyPlan(input.frame, "BUILD");
  }
  const lexeme = findResolvedLexeme(input.content, input.target);
  if (!lexeme || !lexeme.build.enabled || input.frame.skeletonId !== MEAL_SKELETON_ID) {
    return emptyPlan(input.frame, "BUILD");
  }
  const token = lexeme.presentationToken;
  const entityId = entityIdOnFrame(input.frame, lexeme.fixtureSense);
  const contrastCatalogId = lexeme.contrasts[0]?.contrastEntityId;
  const contrastEntityId = contrastCatalogId
    ? remapCatalogEntity(contrastCatalogId, input.content, input.frame)
    : null;
  const relatedCatalogId = lexeme.groundingFacts
    .find((fact) => fact.factId === lexeme.build.connectFactId)
    ?.args.find(
      (arg): arg is { kind: "ENTITY"; entityId: string } =>
        arg.kind === "ENTITY" && arg.entityId !== lexeme.entityId,
    )?.entityId;
  const relatedEntityId = relatedCatalogId
    ? remapCatalogEntity(relatedCatalogId, input.content, input.frame)
    : null;
  if (!entityId || !contrastEntityId || (relatedCatalogId && !relatedEntityId)) {
    return emptyPlan(input.frame, "BUILD");
  }
  const interpretationTargetId = `target-${token}`;
  const formTargetId = `target-${token}-form`;
  const relationPredicate = connectPredicate(lexeme);
  const interpretationTarget: ExperienceTarget = {
    id: interpretationTargetId,
    sense: lexeme.fixtureSense,
    focus: "CONTEXT_INTERPRETATION",
    requiredRoleIds: [lexeme.roleId],
    requiredRelationIds: requiredRelationIds(lexeme),
  };
  const formTarget: ExperienceTarget = {
    id: formTargetId,
    sense: lexeme.fixtureSense,
    focus: "MEANING_TO_FORM",
  };
  const bundledTarget = {
    lexemeId: lexeme.target.lexemeId,
    senseId: lexeme.target.senseId,
  };
  const prefix = input.stepIdPrefix;
  const ground: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${token}-ground`,
    purpose: "GROUND",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_CONTEXT",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show the Meal scene and the current entity before any judgment. Acknowledgement is not Evidence.",
    },
    presentation: {
      instruction: lexeme.build.groundInstruction,
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
      rationale:
        "Connect the entity, scene role, and Chinese meaning. Acknowledgement is not independent recall.",
    },
    presentation: {
      instruction: lexeme.build.connectInstruction,
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
      rationale: "Present the English form as teaching support, not as a test.",
    },
    presentation: {
      instruction: lexeme.build.teachInstruction,
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
      rationale: "Show an authored contrast binding. Acknowledgement is not Evidence.",
    },
    presentation: {
      instruction: lexeme.contrasts[0]?.instruction ?? "",
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
      rationale:
        "Withdraw the full form and leave a spelling cue. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: lexeme.build.fadeInstruction,
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
      instructionKey: lexeme.build.recallInstructionKey,
      semanticQuestion: pred("name_required_object", [entityArg(entityId)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: {
      kind: "LEXICAL_FORM",
      sense: lexeme.fixtureSense,
    },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
  const steps = [ground, connect, teach, contrast, fade, recall];
  return {
    id: `meal-build-${input.frame.id}-${token}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [interpretationTarget, formTarget],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: input.frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createContextualLexicalStrengthenPlan(
  input: ContextualLexicalPlanInput,
): LearningExperiencePlan {
  if (input.runtimeCapabilities && !input.runtimeCapabilities.canCompileFrozenTask) {
    return emptyPlan(input.frame, "STRENGTHEN");
  }
  const lexeme = findResolvedLexeme(input.content, input.target);
  if (
    !lexeme ||
    !lexeme.strengthen.enabled ||
    input.frame.skeletonId !== MEAL_SKELETON_ID
  ) {
    return emptyPlan(input.frame, "STRENGTHEN");
  }
  const token = lexeme.presentationToken;
  const entityId = entityIdOnFrame(input.frame, lexeme.fixtureSense);
  if (!entityId) {
    return emptyPlan(input.frame, "STRENGTHEN");
  }
  const prefix = input.stepIdPrefix;
  const targetId = `target-${token}-form`;
  const formTarget: ExperienceTarget = {
    id: targetId,
    sense: lexeme.fixtureSense,
    focus: "MEANING_TO_FORM",
  };
  const bundledTarget = {
    lexemeId: lexeme.target.lexemeId,
    senseId: lexeme.target.senseId,
  };
  const reconnect: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-${token}-reconnect`,
    purpose: "CONNECT",
    targetIds: [targetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "RECONNECT_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Re-show the scene object with the English form. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: lexeme.strengthen.reconnectInstruction,
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
      rationale:
        "Withdraw the full form and leave a spelling cue. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: lexeme.strengthen.fadeInstruction,
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
    expectedResponse: { kind: "LEXICAL_FORM", sense: lexeme.fixtureSense },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
  const steps = [reconnect, fade, verify];
  return {
    id: `meal-strengthen-recall-${input.frame.id}-${token}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [formTarget],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: input.frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}
