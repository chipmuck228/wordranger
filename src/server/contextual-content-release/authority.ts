import { readFileSync } from "node:fs";
import path from "node:path";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  MEAL_SCENE_CONTENT_PACK,
  registryEntryFor,
  selectBundledMeaningGloss,
  validateExperimentPromotion,
  MEAL_LEGACY_EXPERIMENT_BASELINE,
} from "@/contextual-learning/candidate-v0/content";
import type { CommittedPromotionArtifacts } from "@/contextual-learning/candidate-v0/content";
import type {
  ContextualSceneContentPack,
  ContextualSceneContentRegistryEntry,
} from "@/contextual-learning/candidate-v0/content/types";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import type { LexemeSenseRef, RuntimeCapability } from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  mealRuntimeContextIdForPack,
  resolveMealRuntimeContext,
} from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";
import {
  deriveHumanApprovalSources,
  deriveLegacyApprovalSources,
  findUniqueApprovalSource,
  fingerprintAuthoredPackSnapshot,
  fingerprintContextModel,
  fingerprintReleaseSnapshot,
  MEAL_MIGRATION_RELEASE_ID,
  MEAL_RELEASE_SCENE_ID,
  resolveReleaseEligiblePack,
  unusedApprovalSources,
  validateCumulativePackLineage,
  validateHumanReviewedTargetAuthority,
  validateLegacyTargetAuthority,
  type ContextualContentReleaseManifest,
  type ReleaseApprovalSource,
  type ReleaseContextSnapshot,
  type ReleaseSnapshot,
  type ReleaseTargetEntry,
  type ReleaseValidationIssue,
  CONTEXTUAL_CONTENT_RELEASE_KIND,
  type HistoricalReleaseApprovalBinding,
} from "@/contextual-learning/candidate-v0/release";
import { safeReviewArtifactDirectory } from "@/server/contextual-content-review/review-artifact-path";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import type { ContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/promotion-repository";
import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { RELEASE_ACTOR_ID } from "./types";

export interface ReleaseAssemblyOptions {
  reviewRepository?: ContentReviewRepository;
  loadLexeme?: SceneLexemeLoader;
  pack?: ContextualSceneContentPack;
  registry?: readonly ContextualSceneContentRegistryEntry[];
  extraApprovalSources?: readonly ReleaseApprovalSource[];
  extraPacks?: readonly ContextualSceneContentPack[];
  extraReviewTargets?: readonly {
    reviewKey: string;
    packId: string;
    target: LexemeSenseRef;
    sourceRefs: readonly string[];
  }[];
  context?: ReleaseContextSnapshot;
  parentPackId?: string | null;
  capabilities?: readonly RuntimeCapability[];
  promotionRepository?: ContextualContentBatchPromotionRepository;
  env?: Record<string, string | undefined>;
}

export interface ReleaseAuthority {
  snapshot: ReleaseSnapshot;
  livePack: ContextualSceneContentPack;
  targetEntries: ReleaseTargetEntry[];
  historicalApprovalBindings: HistoricalReleaseApprovalBinding[];
  issues: ReleaseValidationIssue[];
  approvalSources: ReleaseApprovalSource[];
  unusedSources: ReleaseApprovalSource[];
}

function issue(
  code: ReleaseValidationIssue["code"],
  pathName: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path: pathName, detail };
}

export function uniquePackTargets(pack: ContextualSceneContentPack): LexemeSenseRef[] {
  const seen = new Set<string>();
  const targets: LexemeSenseRef[] = [];
  for (const lexeme of pack.lexemes) {
    const key = `${lexeme.target.lexemeId}::${lexeme.target.senseId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    targets.push(lexeme.target);
  }
  return targets;
}

function sceneOrder(pack: ContextualSceneContentPack, target: LexemeSenseRef): number {
  const lexeme = pack.lexemes.find((item) => sameLexemeSense(item.target, target));
  return lexeme?.membership.frameBindings[0]?.sceneOrder ?? Number.MAX_SAFE_INTEGER;
}

function selectedMeaningFor(
  pack: ContextualSceneContentPack,
  target: LexemeSenseRef,
  loadLexeme: SceneLexemeLoader,
): string | null {
  const lexeme = pack.lexemes.find((item) => sameLexemeSense(item.target, target));
  if (!lexeme) {
    return null;
  }
  const bundled = loadLexeme(lexeme.canonicalKey);
  return selectBundledMeaningGloss({
    meaningsZh: bundled?.meaningsZh,
    selector: lexeme.lexicalPresentation.meaningGlossSelector,
  });
}

function loadPromotionArtifacts(reviewKey: string): CommittedPromotionArtifacts {
  const dir = safeReviewArtifactDirectory(reviewKey);
  if (!dir) {
    return { reviewRecord: null, manifest: null, humanMarkdown: null, packetMarkdown: null };
  }
  const readJson = (name: string) => {
    try {
      return JSON.parse(readFileSync(path.join(dir, name), "utf8"));
    } catch {
      return null;
    }
  };
  const readText = (name: string) => {
    try {
      return readFileSync(path.join(dir, name), "utf8");
    } catch {
      return null;
    }
  };
  return {
    reviewRecord: readJson("human-review.record.json"),
    manifest: readJson("REVIEW_MANIFEST.json"),
    humanMarkdown: readText("HUMAN_REVIEW.md"),
    packetMarkdown: readText("REVIEW_PACKET.md"),
  };
}

export function productionApprovalSources(input?: {
  extraReviewTargets?: ReleaseAssemblyOptions["extraReviewTargets"];
}): ReleaseApprovalSource[] {
  return [
    ...deriveLegacyApprovalSources({
      sceneId: MEAL_RELEASE_SCENE_ID,
      baselinePack: MEAL_SCENE_CONTENT_PACK,
      baselinePackId: MEAL_LEGACY_EXPERIMENT_BASELINE.packId,
    }),
    ...deriveHumanApprovalSources({
      sceneId: MEAL_RELEASE_SCENE_ID,
      reviewTargets: [
        ...CONTENT_REVIEW_TARGETS.map((item) => ({
          reviewKey: item.reviewKey,
          packId: item.packId,
          target: item.target,
          sourceRefs: item.sourceRefs,
        })),
        ...(input?.extraReviewTargets ?? []),
      ],
    }),
  ];
}

function packById(
  packId: string,
  registry: readonly ContextualSceneContentRegistryEntry[],
  extraPacks: readonly ContextualSceneContentPack[],
): ContextualSceneContentPack | null {
  const extras = extraPacks.filter((pack) => pack.id === packId);
  if (extras.length === 1) {
    return extras[0]!;
  }
  const fromRegistry = registry.filter((entry) => entry.packId === packId);
  if (fromRegistry.length === 1) {
    return fromRegistry[0]!.pack;
  }
  return null;
}

function resolveSnapshot(
  pack: ContextualSceneContentPack,
  context?: ReleaseContextSnapshot,
): ReleaseSnapshot {
  if (context) {
    return {
      pack: cloneFrozen(pack),
      context: cloneFrozen(context),
    };
  }
  const runtimeContextId = mealRuntimeContextIdForPack(pack.id);
  const resolved = resolveMealRuntimeContext(runtimeContextId);
  return {
    pack: cloneFrozen(pack),
    context: {
      runtimeContextId: resolved.id,
      frames: cloneFrozen(resolved.frames),
      skeleton: cloneFrozen(resolved.skeleton),
    },
  };
}

function buildLegacyEntry(
  pack: ContextualSceneContentPack,
  source: ReleaseApprovalSource,
  loadLexeme: SceneLexemeLoader,
  humanReviewKeys: readonly string[],
  issues: ReleaseValidationIssue[],
): ReleaseTargetEntry | null {
  const baseline = MEAL_SCENE_CONTENT_PACK.lexemes.find((item) =>
    sameLexemeSense(item.target, source.target),
  );
  if (!baseline) {
    issues.push(
      issue(
        "RELEASE_SENSE_UNRESOLVED",
        source.reviewKey,
        "Legacy target is missing from the grandfathered baseline pack.",
      ),
    );
    return null;
  }
  const chain = validateLegacyTargetAuthority({
    reviewKey: source.reviewKey,
    lemma: baseline.canonicalKey,
    baselinePack: MEAL_SCENE_CONTENT_PACK,
    baselinePackId: MEAL_LEGACY_EXPERIMENT_BASELINE.packId,
    baselinePackFingerprint: MEAL_LEGACY_EXPERIMENT_BASELINE.contentFingerprint,
    currentPack: pack,
    target: baseline.target,
    humanReviewKeys,
  });
  issues.push(...chain.issues);
  if (!chain.ok || !chain.approvedFingerprint) {
    return null;
  }
  const snapshot = pack.lexemes.find((item) => sameLexemeSense(item.target, baseline.target));
  if (!snapshot) {
    return null;
  }
  const meaning = selectedMeaningFor(pack, snapshot.target, loadLexeme);
  if (!meaning) {
    issues.push(
      issue(
        "RELEASE_MEANING_INVALID",
        source.reviewKey,
        `Selected meaning for ${baseline.canonicalKey} is not from bundled vocabulary.`,
      ),
    );
    return null;
  }
  return {
    reviewKey: source.reviewKey,
    packId: pack.id,
    target: snapshot.target,
    displayLabel: snapshot.lexicalPresentation.displayLabel,
    contentFingerprint: chain.approvedFingerprint,
    reviewRevision: 0,
    humanDecision: "LEGACY_BASELINE",
    selectedMeaning: meaning,
    sourceRefs: [...MEAL_SCENE_CONTENT_PACK.provenance.sourceRefs],
    approvalBasis: "LEGACY_EXPERIMENT_BASELINE",
  };
}

async function buildHumanEntry(input: {
  pack: ContextualSceneContentPack;
  source: ReleaseApprovalSource;
  reviewPack: ContextualSceneContentPack;
  reviewRepository: ContentReviewRepository;
  loadLexeme: SceneLexemeLoader;
  issues: ReleaseValidationIssue[];
}): Promise<ReleaseTargetEntry | null> {
  if (!sameLexemeSense(input.source.expectedTarget, input.source.target)) {
    input.issues.push(
      issue("RELEASE_REVIEW_INVALID", input.source.reviewKey, "Approval source target does not match its expected review identity."),
    );
    return null;
  }
  const record = await input.reviewRepository.get(input.source.reviewKey);
  const chain = validateHumanReviewedTargetAuthority({
    reviewKey: input.source.reviewKey,
    expectedTarget: input.source.expectedTarget,
    reviewPack: input.reviewPack,
    currentPack: input.pack,
    reviewRecord: record,
  });
  input.issues.push(...chain.issues);
  if (!chain.ok || !chain.approvedFingerprint || !record) {
    return null;
  }
  const snapshotLexeme = input.pack.lexemes.find((item) =>
    sameLexemeSense(item.target, input.source.target),
  );
  if (!snapshotLexeme) {
    return null;
  }
  const meaning = selectedMeaningFor(input.pack, input.source.target, input.loadLexeme);
  if (!meaning) {
    input.issues.push(
      issue("RELEASE_MEANING_INVALID", input.source.reviewKey, "Selected meaning is not from bundled vocabulary."),
    );
    return null;
  }
  return {
    reviewKey: input.source.reviewKey,
    packId: input.pack.id,
    target: input.source.target,
    displayLabel: snapshotLexeme.lexicalPresentation.displayLabel,
    contentFingerprint: chain.approvedFingerprint,
    reviewRevision: record.revision,
    humanDecision: "APPROVED",
    selectedMeaning: meaning,
    sourceRefs: [...input.source.sourceRefs],
    approvalBasis: "HUMAN_REVIEW_PROMOTION",
  };
}

export async function buildMealMigrationAuthority(
  input: ReleaseAssemblyOptions = {},
): Promise<ReleaseAuthority> {
  const issues: ReleaseValidationIssue[] = [];
  const loadLexeme = input.loadLexeme ?? bundledSceneLexemeLoader;
  const reviewRepository = input.reviewRepository ?? fileContentReviewRepository;
  const registry = input.registry ?? listSceneContentRegistry();
  const extraPacks = input.extraPacks ?? [];
  let livePack = input.pack;
  if (!livePack) {
    const selected = resolveReleaseEligiblePack({
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      registry,
    });
    issues.push(...selected.issues);
    livePack = selected.entry?.pack ?? experimentalMealContextLabPack();
  }
  const snapshot = resolveSnapshot(livePack, input.context);
  const sources = [
    ...productionApprovalSources({ extraReviewTargets: input.extraReviewTargets }),
    ...(input.extraApprovalSources ?? []),
  ];
  const unusedSources = unusedApprovalSources({
    sources,
    pack: snapshot.pack,
    sceneId: MEAL_RELEASE_SCENE_ID,
  });
  const registryEntry = registry.find((entry) => entry.packId === snapshot.pack.id);
  const parentPackId =
    input.parentPackId !== undefined ? input.parentPackId : registryEntry?.parentPackId ?? null;
  const lineage = validateCumulativePackLineage({
    pack: snapshot.pack,
    parentPackId,
    registry,
    approvalSources: sources,
    extraPacks,
    sceneId: MEAL_RELEASE_SCENE_ID,
  });
  issues.push(...lineage.issues);

  const humanReviewKeys = sources
    .filter((source) => source.approvalBasis === "HUMAN_REVIEW_PROMOTION")
    .map((source) => source.reviewKey);
  const orderedLexemes = [...snapshot.pack.lexemes].sort((left, right) => {
    const order = sceneOrder(snapshot.pack, left.target) - sceneOrder(snapshot.pack, right.target);
    return order !== 0 ? order : left.target.senseId.localeCompare(right.target.senseId);
  });
  const entries: ReleaseTargetEntry[] = [];
  const historicalApprovalBindings: HistoricalReleaseApprovalBinding[] = [];
  for (const lexeme of orderedLexemes) {
    const found = findUniqueApprovalSource({
      sources,
      target: lexeme.target,
      sceneId: MEAL_RELEASE_SCENE_ID,
    });
    if (!found.ok) {
      issues.push(...found.issues);
      continue;
    }
    const source = found.source;
    if (!sameLexemeSense(source.expectedTarget, lexeme.target)) {
      issues.push(
        issue(
          "RELEASE_REVIEW_INVALID",
          source.reviewKey,
          "Registered review target identity does not match the pack target.",
        ),
      );
      continue;
    }
    if (source.approvalBasis === "LEGACY_EXPERIMENT_BASELINE") {
      const entry = buildLegacyEntry(snapshot.pack, source, loadLexeme, humanReviewKeys, issues);
      if (entry) {
        entries.push(entry);
        historicalApprovalBindings.push(bindingForEntry(entry, source.approvalPackId));
      }
      continue;
    }
    const reviewPack = packById(source.approvalPackId, registry, extraPacks);
    if (!reviewPack) {
      issues.push(
        issue("RELEASE_PACK_MISMATCH", source.reviewKey, "Approval source pack cannot be resolved."),
      );
      continue;
    }
    const entry = await buildHumanEntry({
      pack: snapshot.pack,
      source,
      reviewPack,
      reviewRepository,
      loadLexeme,
      issues,
    });
    if (entry) {
      entries.push(entry);
      historicalApprovalBindings.push(bindingForEntry(entry, source.approvalPackId));
    }
  }

  const reviewedPromotionKeys = new Set<string>();
  for (const source of sources) {
    if (source.approvalBasis !== "HUMAN_REVIEW_PROMOTION") {
      continue;
    }
    if (reviewedPromotionKeys.has(source.reviewKey)) {
      continue;
    }
    const entry = registryEntryFor(source.approvalPackId) ?? registry.find((item) => item.packId === source.approvalPackId) ?? null;
    if (!entry?.promotion) {
      continue;
    }
    reviewedPromotionKeys.add(source.reviewKey);
    const promotion = validateExperimentPromotion({
      entry,
      expectedAttestation: entry.promotion,
      artifacts: loadPromotionArtifacts(source.reviewKey),
    });
    if (!promotion.ok) {
      issues.push(
        issue(
          "RELEASE_PROMOTION_INVALID",
          `${source.reviewKey}.promotion`,
          "Registered human-review promotion/approval basis is not valid.",
        ),
      );
    }
  }

  return {
    snapshot,
    livePack,
    targetEntries: entries,
    historicalApprovalBindings,
    issues,
    approvalSources: sources,
    unusedSources,
  };
}

export function manifestFromAuthority(input: {
  authority: ReleaseAuthority;
  createdAt: string;
  createdBy?: string;
  status?: "DRAFT";
  releaseId?: string;
}): ContextualContentReleaseManifest {
  const historicalApprovalBindings = input.authority.historicalApprovalBindings;
  const packFingerprint = fingerprintAuthoredPackSnapshot(input.authority.snapshot.pack);
  const contextModelFingerprint = fingerprintContextModel(input.authority.snapshot.context);
  const releaseFingerprint = fingerprintReleaseSnapshot({
    sceneId: MEAL_RELEASE_SCENE_ID,
    baseReleaseId: null,
    targetEntries: input.authority.targetEntries,
    snapshot: input.authority.snapshot,
  });
  return cloneFrozen({
    schemaVersion: "candidate-v0",
    kind: CONTEXTUAL_CONTENT_RELEASE_KIND,
    releaseId: input.releaseId ?? MEAL_MIGRATION_RELEASE_ID,
    sceneId: MEAL_RELEASE_SCENE_ID,
    baseReleaseId: null,
    status: input.status ?? "DRAFT",
    revision: 0,
    targetEntries: input.authority.targetEntries,
    packSnapshot: input.authority.snapshot.pack,
    contextSnapshot: input.authority.snapshot.context,
    packFingerprint,
    contextModelFingerprint,
    releaseFingerprint,
    createdAt: input.createdAt,
    createdBy: input.createdBy ?? RELEASE_ACTOR_ID,
    validatedAt: null,
    validationSummary: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededByReleaseId: null,
    historicalApprovalBindings,
  });
}

function bindingForEntry(
  entry: ReleaseTargetEntry,
  approvalPackId: string,
): HistoricalReleaseApprovalBinding {
  return {
    reviewKey: entry.reviewKey,
    approvalBasis: entry.approvalBasis,
    approvedContentFingerprint: entry.contentFingerprint,
    reviewRevision: entry.reviewRevision,
    humanDecision: entry.humanDecision,
    approvalPackId,
    approvalSourceRefs: [...entry.sourceRefs],
  };
}

export { MEAL_SCENE_CLUSTER };
