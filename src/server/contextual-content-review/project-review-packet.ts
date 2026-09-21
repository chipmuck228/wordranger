import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import {
  findResolvedLexeme,
  projectPublicScenePresentation,
  presentationLeaksAnswer,
} from "@/contextual-learning/candidate-v0/content";
import type { ScenePresentationStage } from "@/contextual-learning/candidate-v0/content/project-public-presentation";
import {
  getApprovedExperimentSceneContent,
  registryStatusFor,
  resolveSceneContent,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import type { ContextualSceneLexemeContent } from "@/contextual-learning/candidate-v0/content/types";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  isAssessableExperienceStep,
  isGuidedExperienceStep,
  type ContextFrame,
  type ExperienceStepSpec,
  type GuidedExperienceStepSpec,
} from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import {
  createExpansionBatch01LexicalBuildPlan,
  createExpansionBatch01LexicalStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/expansion-batch-01-plans";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { fingerprintContent } from "./fingerprint";
import { isContextualContentReviewWriteEnabled } from "./gates";
import { reviewRoleLabel } from "./role-labels";
import type { ContentReviewTargetSpec } from "./review-target-registry";
import type {
  ContentReviewEntity,
  ContentReviewFact,
  ContentReviewFrame,
  ContentReviewMachineCheck,
  ContentReviewPacket,
  ContentReviewStep,
  HumanContentReviewRecord,
} from "./types";

const STAGE_BY_PURPOSE: Record<string, ScenePresentationStage> = {
  GROUND: "BUILD_GROUND",
  CONNECT: "BUILD_CONNECT",
  DISCRIMINATE: "BUILD_CONTRAST",
  RECALL: "BUILD_VERIFY",
};

function packFor(spec: ContentReviewTargetSpec) {
  if (spec.packId !== MEAL_SCENE_EXPANSION_BATCH_01_PACK.id) {
    return null;
  }
  return MEAL_SCENE_EXPANSION_BATCH_01_PACK;
}

function lexemeFor(
  spec: ContentReviewTargetSpec,
): ContextualSceneLexemeContent | null {
  const pack = packFor(spec);
  const matches =
    pack?.lexemes.filter((item) => sameLexemeSense(item.target, spec.target)) ?? [];
  return matches.length === 1 ? matches[0]! : null;
}

function sequentialIds(prefix: string): () => string {
  let index = 0;
  return () => `${prefix}-${index++}`;
}

function leakFails(input: {
  displayForm: string;
  texts: Array<string | undefined>;
}): boolean {
  const needle = input.displayForm.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return input.texts.some((text) => text?.toLowerCase().includes(needle));
}

function entitiesForFrame(
  frame: ContextFrame,
  lexeme: ReturnType<typeof findResolvedLexeme>,
): ContentReviewEntity[] {
  if (!lexeme) {
    return [];
  }
  const relatedIds = new Set(
    lexeme.groundingFacts.flatMap((fact) =>
      fact.args.flatMap((arg) => (arg.kind === "ENTITY" ? [arg.entityId] : [])),
    ),
  );
  const contrastId = lexeme.contrasts[0]?.contrastEntityId;
  const wanted = new Set<string>([lexeme.entityId, ...relatedIds]);
  if (contrastId) {
    wanted.add(contrastId);
  }
  return frame.entityBindings
    .filter((entity) => wanted.has(entity.entityId))
    .map((entity) => ({
      entityId: entity.entityId,
      roleId: entity.roleId,
      roleLabel: reviewRoleLabel(entity.roleId),
      displayLabel: entity.label,
      isTarget: entity.entityId === lexeme.entityId,
      isContrast: entity.entityId === contrastId,
      isRelated: relatedIds.has(entity.entityId) && entity.entityId !== lexeme.entityId,
    }));
}

function factsForLexeme(
  lexeme: NonNullable<ReturnType<typeof findResolvedLexeme>>,
): ContentReviewFact[] {
  return lexeme.groundingFacts.map((fact) => ({
    factId: fact.factId,
    predicate: fact.predicate,
    args: fact.args,
    caption: fact.caption,
  }));
}

function guidedStage(step: GuidedExperienceStepSpec): ScenePresentationStage {
  switch (step.executionIntent.guidedActivityKind) {
    case "PRESENT_CONTEXT":
      return "BUILD_GROUND";
    case "OBSERVE_RELATION":
    case "CONNECT_ENTITY_AND_MEANING":
      return step.id.includes("strengthen") ? "STRENGTHEN_RECONNECT" : "BUILD_CONNECT";
    case "PRESENT_LEXICAL_FORM":
      return "BUILD_TEACH";
    case "SHOW_CONTRAST":
      return "BUILD_CONTRAST";
    case "RECONNECT_FORM":
      return "STRENGTHEN_RECONNECT";
    case "FADE_FORM":
      return step.id.includes("strengthen") ? "STRENGTHEN_FADE" : "BUILD_FADE";
    default:
      return STAGE_BY_PURPOSE[step.purpose] ?? "BUILD_GROUND";
  }
}

function stepFromExperience(input: {
  step: ExperienceStepSpec;
  lexeme: NonNullable<ReturnType<typeof findResolvedLexeme>>;
  displayForm: string;
  frame: ContextFrame;
}): ContentReviewStep {
  const { step, lexeme, displayForm } = input;
  if (isGuidedExperienceStep(step)) {
    const stage = guidedStage(step);
    const presentation = projectPublicScenePresentation({ stage, lexeme });
    const studentInstruction =
      step.presentation.instruction || presentation.instruction;
    const leaked =
      presentationLeaksAnswer(presentation, displayForm) ||
      leakFails({
        displayForm,
        texts: [
          studentInstruction,
          stage === "BUILD_TEACH" || stage === "STRENGTHEN_RECONNECT"
            ? undefined
            : presentation.displayForm,
        ],
      });
    const formVisible = Boolean(
      presentation.displayForm ||
        step.supportExposure?.kinds.includes("LEXICAL_FORM"),
    );
    return {
      id: step.id,
      title: step.executionIntent.guidedActivityKind,
      purpose: step.purpose,
      kind: "GUIDED",
      stage,
      student: {
        instruction: studentInstruction,
        presentation,
      },
      audit: {
        stepId: step.id,
        purpose: step.purpose,
        guidedOrAssessable: "GUIDED",
        presentedEntityIds: step.presentation.presentedEntityIds ?? [],
        presentedFactPredicates: step.presentation.presentedFactPredicates ?? [],
        supportExposure: [...(step.supportExposure?.kinds ?? [])],
        lexicalFormVisible: formVisible,
        answerLeakage:
          leaked && stage !== "BUILD_TEACH" && stage !== "STRENGTHEN_RECONNECT"
            ? "fail"
            : "pass",
      },
    };
  }
  const presentation = projectPublicScenePresentation({
    stage: step.id.includes("strengthen") ? "STRENGTHEN_VERIFY" : "BUILD_VERIFY",
    lexeme,
  });
  const leaked = leakFails({
    displayForm,
    texts: [presentation.instruction, presentation.displayForm, presentation.phonetic],
  });
  return {
    id: step.id,
    title: "RECALL",
    purpose: step.purpose,
    kind: "ASSESSABLE",
    stage: presentation.stage,
    student: {
      instruction: presentation.instruction,
      presentation,
    },
    audit: {
      stepId: step.id,
      purpose: step.purpose,
      guidedOrAssessable: "ASSESSABLE",
      presentedEntityIds: [],
      presentedFactPredicates: [],
      supportExposure: [],
      lexicalFormVisible: false,
      answerLeakage: leaked ? "fail" : "pass",
    },
  };
}

function frozenPreviewStep(input: {
  frame: ContextFrame;
  lexeme: NonNullable<ReturnType<typeof findResolvedLexeme>>;
  displayForm: string;
}): ContentReviewStep | null {
  const plan = createExpansionBatch01LexicalBuildPlan({
    frame: input.frame,
    target: input.lexeme.target,
    loadLexeme: bundledSceneLexemeLoader,
  });
  const recall = plan.steps.find(isAssessableExperienceStep);
  if (!recall) {
    return null;
  }
  const profiles = profileMap(MEAL_PROFILES);
  const compiled = compileExperienceStep({
    experienceId: plan.id,
    learningNeedId: plan.sourceLearningNeedRef,
    step: recall,
    resolvedContext: resolveContextSnapshot(
      input.frame,
      mealSkeleton,
      plan.activeGoalId,
    ),
    resolvedTargets: plan.targets
      .filter((target) => recall.targetIds.includes(target.id))
      .flatMap((target) => {
        const profile = profiles.get(
          `${target.sense.lexemeId}::${target.sense.senseId}`,
        );
        return profile
          ? [
              {
                targetId: target.id,
                sense: target.sense,
                displayForm: profile.displayForm,
                focus: target.focus,
              },
            ]
          : [];
      }),
    supportPolicy: recall.supportPolicy,
    now: "2026-09-21T00:00:00.000Z",
    createId: sequentialIds("review"),
  });
  if (!compiled.ok) {
    return {
      id: `${recall.id}-frozen-preview`,
      title: "Frozen Task Preview",
      purpose: "RECALL",
      kind: "PREVIEW",
      stage: "BUILD_VERIFY",
      student: { instruction: `Frozen task preview is unavailable. ${compiled.error.message}` },
      audit: {
        stepId: recall.id,
        purpose: "RECALL",
        guidedOrAssessable: "PREVIEW",
        presentedEntityIds: [],
        presentedFactPredicates: [],
        supportExposure: [],
        lexicalFormVisible: false,
        answerLeakage: "fail",
      },
    };
  }
  const preview = {
    taskType: compiled.value.publicLearningTask.taskType,
    prompt: compiled.value.publicLearningTask.prompt,
    responseContract: compiled.value.publicLearningTask.responseContract,
  };
  const promptText =
    preview.prompt.kind === "RELATION"
      ? `${preview.prompt.sourceText} ${preview.prompt.relationType}`
      : preview.prompt.text;
  const leaked = leakFails({
    displayForm: input.displayForm,
    texts: [promptText, JSON.stringify(preview)],
  });
  return {
    id: `${recall.id}-frozen-preview`,
    title: "Frozen Task Preview",
    purpose: "RECALL",
    kind: "PREVIEW",
    stage: "BUILD_VERIFY",
    student: {
      instruction: promptText,
      frozenTaskPreview: preview,
    },
    audit: {
      stepId: recall.id,
      purpose: "RECALL",
      guidedOrAssessable: "PREVIEW",
      presentedEntityIds: [],
      presentedFactPredicates: [],
      supportExposure: [],
      lexicalFormVisible: false,
      answerLeakage: leaked ? "fail" : "pass",
    },
  };
}

function buildFramePacket(input: {
  spec: ContentReviewTargetSpec;
  frame: ContextFrame;
  lexemeContent: ContextualSceneLexemeContent;
  displayForm: string;
}): ContentReviewFrame | null {
  const pack = packFor(input.spec);
  if (!pack) {
    return null;
  }
  const resolved = resolveSceneContent({
    pack,
    frame: input.frame,
    frames: MEAL_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
    skeleton: mealSkeleton,
    cluster: MEAL_SCENE_CLUSTER,
    loadLexeme: bundledSceneLexemeLoader,
  });
  if (!resolved.ok) {
    return null;
  }
  const lexeme = findResolvedLexeme(resolved.content, input.spec.target);
  if (!lexeme) {
    return null;
  }
  const build = createExpansionBatch01LexicalBuildPlan({
    frame: input.frame,
    target: input.spec.target,
    loadLexeme: bundledSceneLexemeLoader,
  });
  const strengthen = createExpansionBatch01LexicalStrengthenPlan({
    frame: input.frame,
    target: input.spec.target,
    loadLexeme: bundledSceneLexemeLoader,
  });
  const probePresentation = projectPublicScenePresentation({
    stage: "PROBE_ACTIVE_RECALL",
    lexeme,
  });
  const probeLeak =
    presentationLeaksAnswer(probePresentation, input.displayForm) ||
    leakFails({
      displayForm: input.displayForm,
      texts: [
        probePresentation.instruction,
        probePresentation.displayForm,
        probePresentation.meaningGloss,
        probePresentation.phonetic,
      ],
    });
  const probe: ContentReviewStep = {
    id: `${input.frame.id}-probe`,
    title: "Probe",
    purpose: "PROBE",
    kind: "GUIDED",
    stage: "PROBE_ACTIVE_RECALL",
    student: {
      instruction: probePresentation.instruction,
      presentation: {
        ...probePresentation,
        displayForm: undefined,
        meaningGloss: undefined,
        phonetic: undefined,
        spellingCue: undefined,
      },
    },
    audit: {
      stepId: `${input.frame.id}-probe`,
      purpose: "PROBE",
      guidedOrAssessable: "GUIDED",
      presentedEntityIds: [lexeme.entityId],
      presentedFactPredicates: [],
      supportExposure: [],
      lexicalFormVisible: false,
      answerLeakage: probeLeak ? "fail" : "pass",
    },
  };
  const steps = [
    probe,
    ...build.steps.map((step) =>
      stepFromExperience({
        step,
        lexeme,
        displayForm: input.displayForm,
        frame: input.frame,
      }),
    ),
    ...strengthen.steps.map((step) =>
      stepFromExperience({
        step,
        lexeme,
        displayForm: input.displayForm,
        frame: input.frame,
      }),
    ),
    frozenPreviewStep({
      frame: input.frame,
      lexeme,
      displayForm: input.displayForm,
    }),
  ].filter((item): item is ContentReviewStep => Boolean(item));
  return {
    frameId: input.frame.id,
    title: input.frame.title,
    settingLabel: resolved.content.frame.settingLabel,
    introInstruction: resolved.content.frame.introInstruction,
    entities: entitiesForFrame(input.frame, lexeme),
    facts: factsForLexeme(lexeme),
    contrast: lexeme.contrasts[0]
      ? {
          contrastEntityId: lexeme.contrasts[0].contrastEntityId,
          contrastDisplayLabel:
            input.frame.entityBindings.find(
              (entity) => entity.entityId === lexeme.contrasts[0]!.contrastEntityId,
            )?.label ?? lexeme.contrasts[0].contrastEntityId,
          instruction: lexeme.contrasts[0].instruction,
          caption: lexeme.contrasts[0].caption,
        }
      : null,
    steps,
  };
}

export function currentContentFingerprint(spec: ContentReviewTargetSpec): string | null {
  const pack = packFor(spec);
  const lexeme = lexemeFor(spec);
  if (!pack || !lexeme) {
    return null;
  }
  return fingerprintContent({
    packId: pack.id,
    lexeme,
    sourceRefs: pack.provenance.sourceRefs,
  });
}

export function projectContentReviewPacket(input: {
  spec: ContentReviewTargetSpec;
  record?: HumanContentReviewRecord | null;
  writeEnabled?: boolean;
}): ContentReviewPacket | null {
  const pack = packFor(input.spec);
  const lexeme = lexemeFor(input.spec);
  if (!pack || !lexeme) {
    return null;
  }
  const bundled = bundledSceneLexemeLoader(lexeme.canonicalKey);
  if (!bundled || bundled.id !== lexeme.target.lexemeId) {
    return null;
  }
  const fingerprint = fingerprintContent({
    packId: pack.id,
    lexeme,
    sourceRefs: pack.provenance.sourceRefs,
  });
  const frames = MEAL_FRAMES.filter((frame) =>
    lexeme.membership.frameBindings.some((binding) => binding.frameId === frame.id),
  )
    .map((frame) =>
      buildFramePacket({
        spec: input.spec,
        frame,
        lexemeContent: lexeme,
        displayForm: bundled.display.trim() || bundled.lemma,
      }),
    )
    .filter((item): item is ContentReviewFrame => Boolean(item));
  const validated = validateSceneContent({
    pack,
    frame: MEAL_FRAMES[0]!,
    frames: MEAL_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
    skeleton: mealSkeleton,
    cluster: MEAL_SCENE_CLUSTER,
    loadLexeme: bundledSceneLexemeLoader,
  });
  const approved = getApprovedExperimentSceneContent(pack.id);
  const approvedRuntime = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
  const registryStatus = registryStatusFor(pack.id);
  const probeLeak = frames.some((frame) =>
    frame.steps.some((step) => step.stage === "PROBE_ACTIVE_RECALL" && step.audit.answerLeakage === "fail"),
  );
  const machineChecks: ContentReviewMachineCheck[] = [
    {
      id: "CONTENT_VALID",
      ok: validated.ok,
      detail: validated.ok ? "Scene Content validator passed." : "Validator failed.",
    },
    {
      id: "REGISTRY_CANDIDATE",
      ok: registryStatus === "CANDIDATE" && pack.provenance.status === "CANDIDATE",
      detail: `Registry status is ${registryStatus ?? "missing"}.`,
    },
    {
      id: "NOT_APPROVED_RUNTIME",
      ok: !approved.ok,
      detail: "Expansion pack is not returned by getApprovedExperimentSceneContent.",
    },
    {
      id: "APPROVED_PACK_UNCHANGED",
      ok: Boolean(approvedRuntime.ok && approvedRuntime.ok && approvedRuntime.pack.lexemes.length === 4),
      detail: "Approved Context Lab pack is still the four-word fixture.",
    },
    {
      id: "PROBE_NO_FORM_LEAK",
      ok: !probeLeak,
      detail: probeLeak
        ? "Probe student copy leaks the target form."
        : "Probe student copy does not include the target form.",
    },
  ];
  const record = input.record ?? null;
  const stale =
    record && record.contentFingerprint !== fingerprint ? "STALE_REVIEW" : "CURRENT";
  const reviewStatus =
    stale === "STALE_REVIEW" ? "PENDING" : record?.decision ?? "PENDING";
  return {
    schemaVersion: "candidate-v0",
    reviewStatus,
    staleState: stale,
    writeEnabled: input.writeEnabled ?? isContextualContentReviewWriteEnabled(),
    reviewRevision: record?.revision ?? 0,
    pack: {
      packId: pack.id,
      registryStatus: "CANDIDATE",
      contentFingerprint: fingerprint,
      title: input.spec.title,
    },
    target: {
      lexemeId: lexeme.target.lexemeId,
      senseId: lexeme.target.senseId,
      canonicalKey: lexeme.canonicalKey,
      displayForm: bundled.display.trim() || bundled.lemma,
      lemma: bundled.lemma,
      meaningsZh: [...bundled.meaningsZh],
      phonetic: bundled.ipa[0],
      roleId: lexeme.membership.frameBindings[0]?.roleId ?? "",
      displayLabel: lexeme.lexicalPresentation.displayLabel,
    },
    frames,
    machineChecks,
    humanReview: record ?? undefined,
    notices: [
      "“通过审核”只记录人工审核结果。",
      "内容仍是 Candidate。",
      "进入实验运行需要后续独立代码变更和提交。",
      "机器验证通过不等于人工批准。",
      "LOCAL_INTERNAL_REVIEWER is not a production identity.",
    ],
  };
}
