import { readFileSync } from "node:fs";
import path from "node:path";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
  registryEntryFor,
  selectBundledMeaningGloss,
  validateExperimentPromotion,
  MEAL_LEGACY_EXPERIMENT_BASELINE,
} from "@/contextual-learning/candidate-v0/content";
import type { CommittedPromotionArtifacts } from "@/contextual-learning/candidate-v0/content";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  experimentalMealRuntimeContextId,
  resolveMealRuntimeContext,
} from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";
import {
  fingerprintAuthoredPackSnapshot,
  fingerprintContextModel,
  fingerprintReleaseSnapshot,
  MEAL_MIGRATION_RELEASE_ID,
  MEAL_RELEASE_SCENE_ID,
  validateHumanReviewedTargetAuthority,
  validateLegacyTargetAuthority,
  type ContextualContentReleaseManifest,
  type ReleaseSnapshot,
  type ReleaseTargetEntry,
  type ReleaseValidationIssue,
  CONTEXTUAL_CONTENT_RELEASE_KIND,
} from "@/contextual-learning/candidate-v0/release";
import { safeReviewArtifactDirectory } from "@/server/contextual-content-review/review-artifact-path";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { RELEASE_ACTOR_ID } from "./types";

const LEGACY_TARGETS: readonly {
  lemma: "soup" | "bowl" | "spoon" | "fork";
  reviewKey: string;
}[] = [
  { lemma: "soup", reviewKey: "legacy-meal-baseline-soup" },
  { lemma: "bowl", reviewKey: "legacy-meal-baseline-bowl" },
  { lemma: "spoon", reviewKey: "legacy-meal-baseline-spoon" },
  { lemma: "fork", reviewKey: "legacy-meal-baseline-fork" },
];

export interface ReleaseAuthority {
  snapshot: ReleaseSnapshot;
  livePack: ContextualSceneContentPack;
  targetEntries: ReleaseTargetEntry[];
  issues: ReleaseValidationIssue[];
}

function issue(
  code: ReleaseValidationIssue["code"],
  pathName: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path: pathName, detail };
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

function buildLegacyEntry(
  pack: ContextualSceneContentPack,
  lemma: "soup" | "bowl" | "spoon" | "fork",
  reviewKey: string,
  loadLexeme: SceneLexemeLoader,
  issues: ReleaseValidationIssue[],
): ReleaseTargetEntry | null {
  const baseline = MEAL_SCENE_CONTENT_PACK.lexemes.find(
    (item) => item.canonicalKey === lemma || item.id === `meal-${lemma}`,
  );
  if (!baseline) {
    issues.push(issue("RELEASE_SENSE_UNRESOLVED", reviewKey, `Legacy ${lemma} is missing from the grandfathered baseline.`));
    return null;
  }
  const chain = validateLegacyTargetAuthority({
    reviewKey,
    lemma,
    baselinePack: MEAL_SCENE_CONTENT_PACK,
    baselinePackId: MEAL_LEGACY_EXPERIMENT_BASELINE.packId,
    baselinePackFingerprint: MEAL_LEGACY_EXPERIMENT_BASELINE.contentFingerprint,
    currentPack: pack,
    target: baseline.target,
    humanReviewKeys: CONTENT_REVIEW_TARGETS.map((item) => item.reviewKey),
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
    issues.push(issue("RELEASE_MEANING_INVALID", reviewKey, `Selected meaning for ${lemma} is not from bundled vocabulary.`));
    return null;
  }
  return {
    reviewKey,
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
  reviewKey: string;
  target: LexemeSenseRef;
  reviewPack: ContextualSceneContentPack;
  reviewRepository: ContentReviewRepository;
  loadLexeme: SceneLexemeLoader;
  issues: ReleaseValidationIssue[];
}): Promise<ReleaseTargetEntry | null> {
  const spec = CONTENT_REVIEW_TARGETS.find((item) => item.reviewKey === input.reviewKey);
  if (!spec) {
    input.issues.push(issue("RELEASE_REVIEW_MISSING", input.reviewKey, "Review target is not registered."));
    return null;
  }
  if (!sameLexemeSense(spec.target, input.target)) {
    input.issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Registered review target does not match."));
    return null;
  }
  const record = await input.reviewRepository.get(input.reviewKey);
  const chain = validateHumanReviewedTargetAuthority({
    reviewKey: input.reviewKey,
    expectedTarget: input.target,
    reviewPack: input.reviewPack,
    currentPack: input.pack,
    reviewRecord: record,
  });
  input.issues.push(...chain.issues);
  if (!chain.ok || !chain.approvedFingerprint || !record) {
    return null;
  }
  const snapshotLexeme = input.pack.lexemes.find((item) => sameLexemeSense(item.target, input.target));
  if (!snapshotLexeme) {
    return null;
  }
  const meaning = selectedMeaningFor(input.pack, input.target, input.loadLexeme);
  if (!meaning) {
    input.issues.push(issue("RELEASE_MEANING_INVALID", input.reviewKey, "Selected meaning is not from bundled vocabulary."));
    return null;
  }
  return {
    reviewKey: input.reviewKey,
    packId: input.pack.id,
    target: input.target,
    displayLabel: snapshotLexeme.lexicalPresentation.displayLabel,
    contentFingerprint: chain.approvedFingerprint,
    reviewRevision: record.revision,
    humanDecision: "APPROVED",
    selectedMeaning: meaning,
    sourceRefs: [...input.reviewPack.provenance.sourceRefs],
    approvalBasis: "HUMAN_REVIEW_PROMOTION",
  };
}

export async function buildMealMigrationAuthority(input: {
  reviewRepository?: ContentReviewRepository;
  loadLexeme?: SceneLexemeLoader;
  pack?: ContextualSceneContentPack;
} = {}): Promise<ReleaseAuthority> {
  const issues: ReleaseValidationIssue[] = [];
  const loadLexeme = input.loadLexeme ?? bundledSceneLexemeLoader;
  const reviewRepository = input.reviewRepository ?? fileContentReviewRepository;
  const livePack = input.pack ?? experimentalMealContextLabPack();
  const runtimeContextId = experimentalMealRuntimeContextId();
  const context = resolveMealRuntimeContext(runtimeContextId);
  const snapshot: ReleaseSnapshot = {
    pack: cloneFrozen(livePack),
    context: {
      runtimeContextId: context.id,
      frames: cloneFrozen(context.frames),
      skeleton: cloneFrozen(context.skeleton),
    },
  };
  const entries: ReleaseTargetEntry[] = [];
  for (const legacy of LEGACY_TARGETS) {
    const entry = buildLegacyEntry(snapshot.pack, legacy.lemma, legacy.reviewKey, loadLexeme, issues);
    if (entry) {
      entries.push(entry);
    }
  }
  const cup = await buildHumanEntry({
    pack: snapshot.pack,
    reviewKey: "meal-expansion-batch-01-cup",
    target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    reviewPack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
    reviewRepository,
    loadLexeme,
    issues,
  });
  if (cup) {
    entries.push(cup);
  }
  const plate = await buildHumanEntry({
    pack: snapshot.pack,
    reviewKey: "meal-expansion-batch-02-plate",
    target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
    reviewPack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
    reviewRepository,
    loadLexeme,
    issues,
  });
  if (plate) {
    entries.push(plate);
  }
  entries.sort((left, right) => {
    const order = sceneOrder(snapshot.pack, left.target) - sceneOrder(snapshot.pack, right.target);
    return order !== 0 ? order : left.target.senseId.localeCompare(right.target.senseId);
  });
  const fourWord = registryEntryFor(MEAL_SCENE_CONTENT_PACK.id);
  if (!fourWord || fourWord.approvalBasis !== "LEGACY_EXPERIMENT_BASELINE") {
    issues.push(issue("RELEASE_PROMOTION_INVALID", "legacy", "Four-word baseline approval basis is missing."));
  }
  const cupPromotion = validateExperimentPromotion({
    entry: registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id)!,
    expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
    artifacts: loadPromotionArtifacts("meal-expansion-batch-01-cup"),
  });
  if (!cupPromotion.ok) {
    issues.push(issue("RELEASE_PROMOTION_INVALID", "cup.promotion", "Cup promotion/approval basis is not valid."));
  }
  const platePromotion = validateExperimentPromotion({
    entry: registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id)!,
    expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
    artifacts: loadPromotionArtifacts("meal-expansion-batch-02-plate"),
  });
  if (!platePromotion.ok) {
    issues.push(issue("RELEASE_PROMOTION_INVALID", "plate.promotion", "Plate promotion/approval basis is not valid."));
  }
  if (listSceneContentRegistry().length !== 3) {
    issues.push(issue("RELEASE_PACK_MISMATCH", "registry", "Unexpected scene content registry size."));
  }
  return { snapshot, livePack, targetEntries: entries, issues };
}

export function manifestFromAuthority(input: {
  authority: ReleaseAuthority;
  createdAt: string;
  createdBy?: string;
  status?: "DRAFT";
}): ContextualContentReleaseManifest {
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
    releaseId: MEAL_MIGRATION_RELEASE_ID,
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
  });
}

export { MEAL_SCENE_CLUSTER };
