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
import {
  SCENE_CONTENT_SCHEMA_VERSION,
  type ContextualFactArgument,
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

const FORBIDDEN_PACK_KEYS = [
  "evidenceOutcome",
  "mastery",
  "masteryScore",
  "learnerScore",
];

export function validateSceneContent(input: {
  pack: ContextualSceneContentPack;
  frame: ContextFrame;
  skeleton: SemanticSkeleton;
  cluster: SceneVocabularyCluster;
  loadLexeme: SceneLexemeLoader;
}): SceneContentValidation {
  const issues: SceneContentIssue[] = [];
  const { pack, frame, skeleton, cluster, loadLexeme } = input;
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
  if (pack.skeletonId !== skeleton.id || frame.skeletonId !== skeleton.id) {
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
  if (FORBIDDEN_PACK_KEYS.some((key) => key in pack)) {
    issues.push(issue(SceneContentErrorCode.CONTENT_OUTCOME_FORBIDDEN, "pack"));
  }

  const frameContent = pack.frames.find((item) => item.frameId === frame.id);
  if (!frameContent || pack.frames.length === 0) {
    issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, "frames"));
    return fail(issues);
  }
  for (const entityId of [
    ...frameContent.entityIds,
    ...frameContent.presentationOrder,
  ]) {
    if (!frame.entityBindings.some((entity) => entity.entityId === entityId)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `frame.entity:${entityId}`),
      );
    }
  }
  if (
    new Set(frameContent.presentationOrder).size !==
    frameContent.presentationOrder.length
  ) {
    issues.push(
      issue(SceneContentErrorCode.CONTENT_SCENE_ORDER_DUPLICATE, "presentationOrder"),
    );
  }
  for (const factId of frameContent.factIds) {
    if (!frame.initialFacts.some((fact) => fact.id === factId)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND, `frame.fact:${factId}`));
    }
  }

  const targets = new Set<string>();
  const orders = new Set<number>();
  const entities = new Set<string>();
  const tokens = new Set<string>();
  for (const [index, lexeme] of pack.lexemes.entries()) {
    const path = `lexemes[${index}]`;
    if (!lexeme.target.lexemeId.trim() || !lexeme.target.senseId.trim()) {
      issues.push(issue(SceneContentErrorCode.CONTENT_TARGET_INVALID, `${path}.target`));
    }
    const targetKey = `${lexeme.target.lexemeId}::${lexeme.target.senseId}`;
    if (targets.has(targetKey)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_TARGET_DUPLICATE, `${path}.target`));
    }
    targets.add(targetKey);
    if (orders.has(lexeme.membership.sceneOrder)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_SCENE_ORDER_DUPLICATE, `${path}.sceneOrder`),
      );
    }
    orders.add(lexeme.membership.sceneOrder);
    if (!lexeme.membership.presentationToken.trim()) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_TARGET_INVALID, `${path}.presentationToken`),
      );
    } else if (tokens.has(lexeme.membership.presentationToken)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_TARGET_DUPLICATE, `${path}.presentationToken`),
      );
    } else {
      tokens.add(lexeme.membership.presentationToken);
    }
    if (entities.has(lexeme.membership.entityId)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_ENTITY_BINDING_DUPLICATE, `${path}.entityId`),
      );
    }
    entities.add(lexeme.membership.entityId);
    if (!lexeme.canonicalKey.trim()) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_CANONICAL_KEY_INVALID, `${path}.canonicalKey`),
      );
    }
    if (!lexeme.membership.frameIds.includes(frame.id)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND, `${path}.frameIds`));
    }
    if (!frame.entityBindings.some((item) => item.entityId === lexeme.membership.entityId)) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `${path}.entityId`),
      );
    }
    if (!skeleton.roleDefinitions.some((role) => role.id === lexeme.membership.roleId)) {
      issues.push(issue(SceneContentErrorCode.CONTENT_ROLE_NOT_FOUND, `${path}.roleId`));
    }
    if (lexeme.grounding.entityId !== lexeme.membership.entityId) {
      issues.push(
        issue(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME, `${path}.grounding.entityId`),
      );
    }
    if (lexeme.grounding.roleId !== lexeme.membership.roleId) {
      issues.push(issue(SceneContentErrorCode.CONTENT_ROLE_NOT_FOUND, `${path}.grounding.roleId`));
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
    for (const [factIndex, factRef] of lexeme.grounding.facts.entries()) {
      issues.push(
        ...validateFactRef(factRef, frame, lexeme.membership.entityId, `${path}.facts[${factIndex}]`),
      );
    }
    if (lexeme.build.connectFactId) {
      const referenced = lexeme.grounding.facts.find(
        (item) => item.factId === lexeme.build.connectFactId,
      );
      if (!referenced) {
        issues.push(
          issue(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND, `${path}.build.connectFactId`),
        );
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
      }
    }
  }
  return issues.length === 0 ? { ok: true } : fail(issues);
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
  if (!sameFactArgs(factRef.args, matched.arguments)) {
    const reversed = [...factRef.args].reverse();
    issues.push(
      issue(
        sameFactArgs(reversed, matched.arguments)
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

function sameFactArgs(
  authored: readonly ContextualFactArgument[],
  frameArgs: readonly { kind: string; entityId?: string; roleId?: string; value?: string | number | boolean }[],
): boolean {
  if (authored.length !== frameArgs.length) {
    return false;
  }
  return authored.every((arg, index) => {
    const frameArg = frameArgs[index];
    if (!frameArg || arg.kind !== frameArg.kind && !(arg.kind === "VALUE" && frameArg.kind === "LITERAL")) {
      if (arg.kind === "ENTITY") {
        return frameArg?.kind === "ENTITY" && frameArg.entityId === arg.entityId;
      }
      if (arg.kind === "ROLE") {
        return frameArg?.kind === "ROLE" && frameArg.roleId === arg.roleId;
      }
      return frameArg?.kind === "LITERAL" && String(frameArg.value) === arg.value;
    }
    if (arg.kind === "ENTITY") {
      return frameArg.kind === "ENTITY" && frameArg.entityId === arg.entityId;
    }
    if (arg.kind === "ROLE") {
      return frameArg.kind === "ROLE" && frameArg.roleId === arg.roleId;
    }
    return String(frameArg.value) === arg.value;
  });
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
