/**
 * Pure Scene Content validator. No UI, Evidence, or learner state.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type {
  ContextFrame,
  SemanticSkeleton,
} from "../domain/types";
import type { SceneVocabularyCluster } from "../memory-routing/types";
import {
  SceneContentErrorCode,
  type SceneContentIssue,
  type SceneContentValidation,
} from "./errors";
import { validatePackAllowedKeys } from "./allowed-pack-keys";
import { sameAuthoredAndFrameFactArgs } from "./fact-args";
import { connectBindings, frameFactsFor } from "./frame-facts";
import { frameBindingFor } from "./frame-binding";
import {
  SCENE_CONTENT_SCHEMA_VERSION,
  type ContextualFactRef,
  type ContextualSceneContentPack,
  type SceneLexemeLoader,
} from "./types";

const CONTRAST_KINDS = new Set([
  "ROLE_CONTRAST",
  "FUNCTION_CONTRAST",
  "FORM_CONTRAST",
  "MEANING_CONTRAST",
]);

export function validateSceneContent(input: {
  pack: ContextualSceneContentPack;
  frame: ContextFrame;
  frames?: readonly ContextFrame[];
  skeleton: SemanticSkeleton;
  cluster: SceneVocabularyCluster;
  loadLexeme: SceneLexemeLoader;
}): SceneContentValidation {
  const issues: SceneContentIssue[] = [];
  const { pack, skeleton, cluster, loadLexeme } = input;
  const runtimeFrames = uniqueFrames([input.frame, ...(input.frames ?? [])]);
  if (!pack.id.trim()) {
    issues.push(issue(SceneContentErrorCode.CONTENT_PACK_ID_INVALID, "id"));
  }
  if (pack.schemaVersion !== SCENE_CONTENT_SCHEMA_VERSION) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_SCHEMA_VERSION_INVALID, "schemaVersion"),
    );
  }
  if (pack.sceneClusterId !== cluster.id) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_CLUSTER_NOT_FOUND, "sceneClusterId"),
    );
  }
  if (pack.skeletonId !== skeleton.id) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_SKELETON_NOT_FOUND, "skeletonId"),
    );
  }
  if (
    pack.provenance.status !== "CANDIDATE" &&
    pack.provenance.status !== "APPROVED_FOR_EXPERIMENT"
  ) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_PROVENANCE_INVALID, "provenance.status"),
    );
  }
  if (pack.provenance.sourceRefs.length === 0) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_PROVENANCE_INVALID, "provenance.sourceRefs"),
    );
  }
  if (!pack.planning?.planIdNamespace?.trim() || !pack.planning.activeGoalId?.trim()) {
    issues.push(issue(SceneContentErrorCode.CONTENT_PROVENANCE_INVALID, "planning"));
  }
  issues.push(...validatePackAllowedKeys(pack));

  if (pack.frames.length === 0) {
    issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, "frames"));
    return fail(issues);
  }
  const packFrameIds = new Set<string>();
  for (const [index, frameContent] of pack.frames.entries()) {
    const path = `frames[${index}]`;
    if (!frameContent.frameId.trim()) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${path}.frameId`));
      continue;
    }
    if (packFrameIds.has(frameContent.frameId)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_ID_DUPLICATE, `${path}.frameId`));
      continue;
    }
    packFrameIds.add(frameContent.frameId);
    const runtime = runtimeFrames.find((item) => item.id === frameContent.frameId);
    if (!runtime) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${path}.frameId`));
      continue;
    }
    if (runtime.skeletonId !== skeleton.id) {
      issues.push(issue(SceneContentErrorCode.CONTENT_SKELETON_NOT_FOUND, `${path}.skeletonId`));
    }
    issues.push(...validatePackFrame(frameContent, runtime, path));
  }

  const targetsByFrame = new Map<string, Set<string>>();
  const ordersByFrame = new Map<string, Set<number>>();
  const entitiesByFrame = new Map<string, Set<string>>();
  const tokensByFrame = new Map<string, Set<string>>();

  for (const [index, lexeme] of pack.lexemes.entries()) {
    const path = `lexemes[${index}]`;
    if (!lexeme.target.lexemeId.trim() || !lexeme.target.senseId.trim()) {
      issues.push(issue(SceneContentErrorCode.CONTENT_TARGET_INVALID, `${path}.target`));
    }
    if (!lexeme.canonicalKey.trim()) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_CANONICAL_KEY_INVALID, `${path}.canonicalKey`),
      );
    }
    if (!lexeme.membership.presentationToken.trim()) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_TARGET_INVALID, `${path}.presentationToken`),
      );
    }
    if (!lexeme.membership.presentationRole.trim()) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_TARGET_INVALID, `${path}.presentationRole`),
      );
    }
    if (lexeme.membership.frameBindings.length === 0) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_FRAME_BINDING_MISSING, `${path}.frameBindings`),
      );
    }
    const lexemeFrameIds = new Set<string>();
    for (const [bindingIndex, binding] of lexeme.membership.frameBindings.entries()) {
      const bindingPath = `${path}.frameBindings[${bindingIndex}]`;
      if (!packFrameIds.has(binding.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, bindingPath));
        continue;
      }
      if (lexemeFrameIds.has(binding.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_ID_DUPLICATE, bindingPath));
        continue;
      }
      lexemeFrameIds.add(binding.frameId);
      const runtime = runtimeFrames.find((item) => item.id === binding.frameId);
      if (!runtime) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, bindingPath));
        continue;
      }
      const targetKey = `${lexeme.target.lexemeId}::${lexeme.target.senseId}`;
      const targets = setFor(targetsByFrame, binding.frameId);
      if (targets.has(targetKey)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_TARGET_DUPLICATE, `${path}.target`));
      }
      targets.add(targetKey);
      const orders = setFor(ordersByFrame, binding.frameId);
      if (orders.has(binding.sceneOrder)) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_SCENE_ORDER_DUPLICATE, `${bindingPath}.sceneOrder`),
        );
      }
      orders.add(binding.sceneOrder);
      const entities = setFor(entitiesByFrame, binding.frameId);
      if (entities.has(binding.entityId)) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_ENTITY_BINDING_DUPLICATE, `${bindingPath}.entityId`),
        );
      }
      entities.add(binding.entityId);
      const tokens = setFor(tokensByFrame, binding.frameId);
      if (lexeme.membership.presentationToken.trim()) {
        if (tokens.has(lexeme.membership.presentationToken)) {
          issues.push(
            issue(SceneContentErrorCode.CONTENT_TARGET_DUPLICATE, `${path}.presentationToken`),
          );
        }
        tokens.add(lexeme.membership.presentationToken);
      }
      const runtimeEntity = runtime.entityBindings.find(
        (item) => item.entityId === binding.entityId,
      );
      if (!runtimeEntity) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `${bindingPath}.entityId`),
        );
      } else if (
        !runtimeEntity.lexemeSenseBindings?.some((item) =>
          sameLexemeSense(item.sense, lexeme.fixtureSense),
        )
      ) {
        issues.push(
          issue(
            SceneContentErrorCode.CONTENT_ENTITY_SENSE_BINDING_MISMATCH,
            `${bindingPath}.fixtureSense`,
          ),
        );
      }
      if (!skeleton.roleDefinitions.some((role) => role.id === binding.roleId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_ROLE_NOT_FOUND, `${bindingPath}.roleId`));
      }
      const packFrame = pack.frames.find((item) => item.frameId === binding.frameId);
      if (packFrame && !packFrame.entityIds.includes(binding.entityId)) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `${bindingPath}.entityId`),
        );
      }
    }
    const seenFactGroups = new Set<string>();
    for (const [groupIndex, group] of lexeme.grounding.frameFacts.entries()) {
      const groupPath = `${path}.grounding.frameFacts[${groupIndex}]`;
      if (!packFrameIds.has(group.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${groupPath}.frameId`));
        continue;
      }
      if (seenFactGroups.has(group.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_ID_DUPLICATE, `${groupPath}.frameId`));
        continue;
      }
      seenFactGroups.add(group.frameId);
      const binding = lexeme.membership.frameBindings.find((item) => item.frameId === group.frameId);
      if (!binding) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_FRAME_BINDING_MISSING, `${groupPath}.frameId`),
        );
        continue;
      }
      const packFrame = pack.frames.find((item) => item.frameId === group.frameId);
      const runtime = runtimeFrames.find((item) => item.id === group.frameId);
      if (!packFrame || !runtime) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${groupPath}.frameId`));
        continue;
      }
      const factIdsInGroup = new Set<string>();
      for (const [factIndex, factRef] of group.facts.entries()) {
        const factPath = `${groupPath}.facts[${factIndex}]`;
        if (factIdsInGroup.has(factRef.factId)) {
          issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_ID_DUPLICATE, `${factPath}.factId`));
          continue;
        }
        factIdsInGroup.add(factRef.factId);
        if (!packFrame.factIds.includes(factRef.factId)) {
          issues.push(issue(SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME, factPath));
          continue;
        }
        issues.push(...validateFactRef(factRef, runtime, binding.entityId, factPath));
      }
    }

    const bundled = loadLexeme(lexeme.canonicalKey);
    const displayForm = bundled?.display.trim() || bundled?.lemma.trim() || "";
    const gloss = bundled?.meaningsZh[0]?.trim() || "";
    if (!bundled || bundled.id !== lexeme.target.lexemeId) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_BUNDLED_IDENTITY_MISMATCH, `${path}.target`),
      );
    }
    if (!displayForm) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_DISPLAY_FORM_MISSING, `${path}.displayForm`),
      );
    }
    if (!gloss) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_MEANING_GLOSS_MISSING, `${path}.meaningGloss`),
      );
    }
    if (
      lexeme.probe.enabled &&
      (lexeme.probe.skills.length === 0 ||
        lexeme.probe.skills.some(
          (skill) => skill !== "ACTIVE_RECALL" && skill !== "MEANING_RECOGNITION",
        ))
    ) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_PROBE_SKILLS_INVALID, `${path}.probe.skills`),
      );
    }
    const leakSources = [
      lexeme.probe.recallInstruction,
      lexeme.build.recallInstructionKey,
    ];
    if (
      (displayForm && leaksForm(displayForm, leakSources)) ||
      (gloss && leaksForm(gloss, [lexeme.probe.recallInstruction])) ||
      (bundled?.ipa[0] && leaksForm(bundled.ipa[0], [lexeme.probe.recallInstruction]))
    ) {
      issues.push(issue(SceneContentErrorCode.CONTENT_RECALL_LEAKS_FORM, `${path}.recall`));
    }
    if (lexeme.build.enabled) {
      if (
        !lexeme.build.groundInstruction.trim() ||
        !lexeme.build.connectInstruction.trim() ||
        !lexeme.build.teachInstruction.trim() ||
        !lexeme.build.fadeInstruction.trim() ||
        !lexeme.build.recallInstructionKey.trim()
      ) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_BUILD_PROFILE_INCOMPLETE, `${path}.build`),
        );
      }
    }
    if (lexeme.strengthen.enabled) {
      if (
        !lexeme.strengthen.reconnectInstruction.trim() ||
        !lexeme.strengthen.fadeInstruction.trim() ||
        !lexeme.strengthen.verifyInstruction.trim()
      ) {
        issues.push(
          issue(
            SceneContentErrorCode.CONTENT_STRENGTHEN_PROFILE_INCOMPLETE,
            `${path}.strengthen`,
          ),
        );
      }
    }
    const seenConnectFrames = new Set<string>();
    for (const [connectIndex, connect] of connectBindings(lexeme).entries()) {
      const connectPath = `${path}.build.connectFactByFrame[${connectIndex}]`;
      if (seenConnectFrames.has(connect.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_ID_DUPLICATE, `${connectPath}.frameId`));
        continue;
      }
      seenConnectFrames.add(connect.frameId);
      if (!packFrameIds.has(connect.frameId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${connectPath}.frameId`));
        continue;
      }
      if (!lexeme.membership.frameBindings.some((item) => item.frameId === connect.frameId)) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_FRAME_BINDING_MISSING, `${connectPath}.frameId`),
        );
        continue;
      }
      const groundingFacts = frameFactsFor(lexeme, connect.frameId);
      if (!groundingFacts.some((item) => item.factId === connect.factId)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_CONNECT_FACT_NOT_IN_FRAME, connectPath));
        continue;
      }
      const packFrame = pack.frames.find((item) => item.frameId === connect.frameId);
      const runtime = runtimeFrames.find((item) => item.id === connect.frameId);
      const onPackFrame = Boolean(packFrame?.factIds.includes(connect.factId));
      const onRuntime = Boolean(runtime?.initialFacts.some((fact) => fact.id === connect.factId));
      if (!onPackFrame || !onRuntime) {
        issues.push(issue(SceneContentErrorCode.CONTENT_CONNECT_FACT_NOT_IN_FRAME, connectPath));
      }
    }
    for (const [contrastIndex, contrast] of lexeme.contrastBindings.entries()) {
      const contrastPath = `${path}.contrast[${contrastIndex}]`;
      if (!CONTRAST_KINDS.has(contrast.kind)) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_CONTRAST_KIND_INVALID, contrastPath),
        );
      }
      if (!contrast.instruction.trim()) {
        issues.push(issue(SceneContentErrorCode.CONTENT_CONTRAST_COPY_EMPTY, contrastPath));
      }
      if (sameLexemeSense(contrast.contrastTarget, lexeme.target)) {
        issues.push(issue(SceneContentErrorCode.CONTENT_CONTRAST_SELF, contrastPath));
      }
      const contrastMember = pack.lexemes.find((item) =>
        sameLexemeSense(item.target, contrast.contrastTarget),
      );
      if (!contrastMember) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_CONTRAST_TARGET_NOT_FOUND, contrastPath),
        );
      } else {
        const sharesFrame = lexeme.membership.frameBindings.some((binding) =>
          frameBindingFor(contrastMember, binding.frameId),
        );
        if (!sharesFrame) {
          issues.push(
            issue(SceneContentErrorCode.CONTENT_CONTRAST_TARGET_NOT_FOUND, contrastPath),
          );
        }
      }
    }
  }
  return issues.length === 0 ? { ok: true } : fail(issues);
}

function validatePackFrame(
  frameContent: ContextualSceneContentPack["frames"][number],
  runtime: ContextFrame,
  path: string,
): SceneContentIssue[] {
  const issues: SceneContentIssue[] = [];
  for (const entityId of [
    ...frameContent.entityIds,
    ...frameContent.presentationOrder,
  ]) {
    if (!runtime.entityBindings.some((entity) => entity.entityId === entityId)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `${path}.entity:${entityId}`),
      );
    }
  }
  if (
    new Set(frameContent.presentationOrder).size !==
    frameContent.presentationOrder.length
  ) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_SCENE_ORDER_DUPLICATE, `${path}.presentationOrder`),
    );
  }
  for (const factId of frameContent.factIds) {
    if (!runtime.initialFacts.some((fact) => fact.id === factId)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND, `${path}.fact:${factId}`));
    }
  }
  return issues;
}

function validateFactRef(
  factRef: ContextualFactRef,
  frame: ContextFrame,
  entityId: string,
  path: string,
): SceneContentIssue[] {
  const issues: SceneContentIssue[] = [];
  const matched = frame.initialFacts.find((fact) => fact.id === factRef.factId);
  if (!matched) {
    return [issue(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND, path)];
  }
  if (matched.predicate !== factRef.predicate) {
    issues.push(issue(SceneContentErrorCode.CONTENT_FACT_ARGUMENT_MISMATCH, `${path}.predicate`));
  }
  if (!sameAuthoredAndFrameFactArgs(factRef.args, matched.arguments)) {
    const reversed = [...factRef.args].reverse();
    issues.push(
      issue(
        sameAuthoredAndFrameFactArgs(reversed, matched.arguments)
          ? SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH
          : SceneContentErrorCode.CONTENT_FACT_ARGUMENT_MISMATCH,
        `${path}.args`,
      ),
    );
  }
  if (
    !factRef.args.some(
      (arg) => arg.kind === "ENTITY" && arg.entityId === entityId,
    )
  ) {
    issues.push(issue(SceneContentErrorCode.CONTENT_FACT_ENTITY_ABSENT, path));
  }
  return issues;
}

function uniqueFrames(frames: readonly ContextFrame[]): ContextFrame[] {
  const seen = new Set<string>();
  const unique: ContextFrame[] = [];
  for (const frame of frames) {
    if (seen.has(frame.id)) {
      continue;
    }
    seen.add(frame.id);
    unique.push(frame);
  }
  return unique;
}

function setFor<T>(store: Map<string, Set<T>>, frameId: string): Set<T> {
  const existing = store.get(frameId);
  if (existing) {
    return existing;
  }
  const created = new Set<T>();
  store.set(frameId, created);
  return created;
}

function leaksForm(displayForm: string, texts: readonly string[]): boolean {
  const needle = displayForm.trim().toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(needle));
}

function issue(code: SceneContentIssue["code"], path: string): SceneContentIssue {
  return { code, path };
}

function fail(issues: SceneContentIssue[]): SceneContentValidation {
  return { ok: false, issues };
}
