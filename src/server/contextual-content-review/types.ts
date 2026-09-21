import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { PublicSceneLexemePresentation } from "@/contextual-learning/candidate-v0/content/project-public-presentation";
import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";

export const CONTENT_REVIEW_SCHEMA_VERSION = "candidate-v0" as const;

export type HumanContentReviewDecision =
  | "PENDING"
  | "APPROVED"
  | "REVISE"
  | "REJECTED";

export type ContentReviewStaleState = "CURRENT" | "STALE_REVIEW";

export interface HumanContentReviewRecord {
  schemaVersion: typeof CONTENT_REVIEW_SCHEMA_VERSION;
  reviewKey: string;
  packId: string;
  target: LexemeSenseRef;
  contentFingerprint: string;
  decision: Exclude<HumanContentReviewDecision, "PENDING">;
  notes: string[];
  reviewedAt: string;
  revision: number;
  reviewer: "LOCAL_INTERNAL_REVIEWER";
}

export interface ContentReviewFact {
  factId: string;
  predicate: string;
  args: Array<{ kind: "ENTITY"; entityId: string } | { kind: "ROLE"; roleId: string } | { kind: "VALUE"; value: string }>;
  caption?: string;
}

export interface ContentReviewEntity {
  entityId: string;
  roleId: string;
  roleLabel: string;
  displayLabel: string;
  isTarget: boolean;
  isContrast: boolean;
  isRelated: boolean;
}

export interface ContentReviewStep {
  id: string;
  title: string;
  purpose: string;
  kind: "GUIDED" | "ASSESSABLE" | "PREVIEW";
  stage: string;
  student: {
    instruction: string;
    presentation?: PublicSceneLexemePresentation;
    frozenTaskPreview?: Pick<
      PublicLearningTask,
      "taskType" | "prompt" | "responseContract"
    >;
  };
  audit: {
    stepId: string;
    purpose: string;
    guidedOrAssessable: "GUIDED" | "ASSESSABLE" | "PREVIEW";
    presentedEntityIds: string[];
    presentedFactPredicates: string[];
    supportExposure: string[];
    lexicalFormVisible: boolean;
    answerLeakage: "pass" | "fail";
  };
}

export interface ContentReviewFrame {
  frameId: string;
  title: string;
  settingLabel: string;
  introInstruction?: string;
  entities: ContentReviewEntity[];
  facts: ContentReviewFact[];
  contrast: {
    contrastEntityId: string;
    contrastDisplayLabel: string;
    instruction: string;
    caption?: string;
  } | null;
  steps: ContentReviewStep[];
}

export interface ContentReviewMachineCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface ContentReviewPacket {
  schemaVersion: typeof CONTENT_REVIEW_SCHEMA_VERSION;
  reviewStatus: HumanContentReviewDecision;
  staleState: ContentReviewStaleState;
  writeEnabled: boolean;
  reviewRevision: number;
  pack: {
    packId: string;
    registryStatus: "CANDIDATE";
    contentFingerprint: string;
    title: string;
  };
  target: {
    lexemeId: string;
    senseId: string;
    canonicalKey: string;
    displayForm: string;
    lemma: string;
    meaningsZh: string[];
    phonetic?: string;
    roleId: string;
    displayLabel: string;
  };
  frames: ContentReviewFrame[];
  machineChecks: ContentReviewMachineCheck[];
  humanReview?: HumanContentReviewRecord;
  notices: string[];
}

export interface ContentReviewListItem {
  reviewKey: string;
  href: string;
  title: string;
  targetLabel: string;
  statusLabel: string;
  frameLabels: string[];
  registryStatus: "CANDIDATE";
}

export type SaveContentReviewResult =
  | { ok: true; record: HumanContentReviewRecord; idempotent: boolean }
  | {
      ok: false;
      code:
        | "CONTENT_REVIEW_WRITE_DISABLED"
        | "CONTENT_REVIEW_STALE"
        | "CONTENT_REVIEW_CONFLICT"
        | "CONTENT_REVIEW_NOTES_REQUIRED"
        | "CONTENT_REVIEW_INVALID";
      message: string;
    };
