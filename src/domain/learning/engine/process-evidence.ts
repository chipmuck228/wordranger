import type { LearningEvidence } from "../evidence.types";
import { DEFAULT_LEARNING_POLICY } from "../policies/default-learning-policy";
import type { LearningPolicy } from "../policies/learning-policy";
import {
  createInitialStudentLexemeModel,
  type StudentLexemeModel,
} from "../student-lexeme-model";
import type { TransitionResult } from "../transition.types";
import type { LearningRepository } from "../learning-repository";
import { calculateMasteryScore } from "./calculate-mastery-score";
import { calculateNextReview } from "./calculate-next-review";
import { detectWeaknesses } from "./detect-weaknesses";
import {
  distinctPracticeDays,
  distinctTaskTypes,
  isExposure,
  isFailure,
  isSuccess,
  skillEvidence,
} from "./evidence-helpers";
import { evaluateRetention } from "./evaluate-retention";
import { evaluateStageTransition } from "./evaluate-stage-transition";
import { LearningDomainError } from "./math";
import { updateSkillState } from "./update-skill-state";
import { validateLearningEvidence } from "./validate-evidence";

export interface ProcessEvidenceInput {
  evidence: LearningEvidence;
  repository: LearningRepository;
  policy?: LearningPolicy;
  now?: string;
  createId?: () => string;
}

export interface ProcessEvidenceResult {
  model: StudentLexemeModel;
  evidence: LearningEvidence;
  transition: TransitionResult;
}

function sortEvidence(items: readonly LearningEvidence[]): LearningEvidence[] {
  return [...items].sort((left, right) => {
    const delta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    if (delta !== 0) {
      return delta;
    }
    return left.id.localeCompare(right.id);
  });
}

export async function processEvidence(
  input: ProcessEvidenceInput,
): Promise<ProcessEvidenceResult> {
  const policy = input.policy ?? DEFAULT_LEARNING_POLICY;
  const evidence = validateLearningEvidence(input.evidence);
  const now = input.now ?? evidence.occurredAt;
  const createId = input.createId ?? (() => crypto.randomUUID());

  const existingModel = await input.repository.getStudentLexemeModel(
    evidence.userId,
    evidence.lexemeId,
  );
  const previous =
    existingModel ??
    createInitialStudentLexemeModel({
      id: createId(),
      userId: evidence.userId,
      lexemeId: evidence.lexemeId,
      now,
      policyVersion: policy.version,
    });

  const storedHistory = await input.repository.getEvidenceForLexeme(
    evidence.userId,
    evidence.lexemeId,
  );
  if (storedHistory.some((item) => item.id === evidence.id)) {
    throw new LearningDomainError(
      "DUPLICATE_EVIDENCE",
      `Evidence ${evidence.id} already exists and cannot be rewritten`,
    );
  }

  const history = sortEvidence([...storedHistory, evidence]);
  const previousSkill = previous.skills[evidence.skill];
  const updatedSkill = updateSkillState({
    skillState: previousSkill,
    evidence,
    skillHistory: skillEvidence(history, evidence.skill),
    policy,
  });

  const skills = {
    ...previous.skills,
    [evidence.skill]: updatedSkill,
  };

  const firstSeenAt = isExposure(evidence)
    ? (previous.firstSeenAt ?? evidence.occurredAt)
    : previous.firstSeenAt;

  const modelForStage: StudentLexemeModel = {
    ...previous,
    skills,
    firstSeenAt,
    lastSeenAt: isExposure(evidence) ? evidence.occurredAt : previous.lastSeenAt,
    lastSuccessAt: isSuccess(evidence)
      ? evidence.occurredAt
      : previous.lastSuccessAt,
    lastFailureAt: isFailure(evidence)
      ? evidence.occurredAt
      : previous.lastFailureAt,
    evidenceCount: history.length,
    distinctPracticeDays: distinctPracticeDays(history),
    distinctTaskTypes: distinctTaskTypes(history),
    updatedAt: now,
  };

  const weaknessResult = detectWeaknesses({
    currentWeaknesses: previous.weaknesses,
    history,
    evidence,
    policy,
    now,
    createId,
  });

  modelForStage.weaknesses = weaknessResult.weaknesses;

  const stageResult = evaluateStageTransition({
    model: modelForStage,
    history,
    evidence,
    policy,
    now,
  });

  const retentionResult = evaluateRetention({
    previousRetentionState: previous.retentionState,
    stage: stageResult.nextStage,
    evidence,
    history,
    previousSkill,
    updatedSkill,
    nextReviewAt: previous.nextReviewAt,
    policy,
    now,
  });

  const scored = calculateMasteryScore({
    model: {
      ...modelForStage,
      masteryStage: stageResult.nextStage,
      retentionState: retentionResult.nextRetentionState,
    },
    history,
    policy,
  });

  const review = calculateNextReview({
    stage: stageResult.nextStage,
    retentionState: retentionResult.nextRetentionState,
    now,
    policy,
  });

  const model: StudentLexemeModel = {
    ...modelForStage,
    policyVersion: policy.version,
    masteryStage: stageResult.nextStage,
    retentionState: retentionResult.nextRetentionState,
    masteryScore: scored.masteryScore,
    masteryConfidence: scored.masteryConfidence,
    nextReviewAt: review.nextReviewAt,
    reviewIntervalDays: review.reviewIntervalDays,
    updatedAt: now,
  };

  await input.repository.commitEvidenceAndSnapshot(evidence, model);

  const transition: TransitionResult = {
    previousStage: previous.masteryStage,
    nextStage: model.masteryStage,
    previousRetentionState: previous.retentionState,
    nextRetentionState: model.retentionState,
    updatedSkills: { [evidence.skill]: updatedSkill },
    addedWeaknesses: weaknessResult.added,
    resolvedWeaknessIds: weaknessResult.resolvedIds,
    nextReviewAt: model.nextReviewAt,
    reasons: [
      ...weaknessResult.reasons,
      ...stageResult.reasons,
      ...retentionResult.reasons,
    ],
  };

  return { model, evidence, transition };
}
