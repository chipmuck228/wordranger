import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { RandomSource } from "@/domain/tasks/random-source";
import { dedupeCandidates, type DedupedNeed } from "./candidate-dedup";
import {
  DEFAULT_LEARNING_CONTENT_CAPABILITY,
  type LearningContentCapability,
} from "./learning-content-capability";
import type {
  LearningNeedCandidate,
  RecentLearningActivity,
  SchedulerLexemeRef,
  UserMarkedLexeme,
} from "./learning-need-candidate";
import {
  DefaultLearningNeedGenerator,
  type LearningNeedGenerator,
} from "./learning-need-generator";
import type { PriorityBreakdown } from "./priority-breakdown";
import { avoidRecentTaskTypesForLexeme, scoreCandidate } from "./score-candidate";
import { SchedulerBlockedReason } from "./scheduler-errors";
import {
  DEFAULT_SCHEDULER_POLICY,
  isReviewReason,
  type SchedulerPolicy,
} from "./scheduler-policy";
import {
  emptySchedulerTrace,
  type SchedulerCandidateTrace,
  type SchedulerDiversityDecision,
  type SchedulerQuotaDecision,
} from "./scheduler-trace";
import type { LearningSessionPlan } from "./session-plan";
import { preferredPromptModesForSkill } from "./session-plan";
import { fallbackSkillForUnsupported } from "./stage-skill-map";

export interface SchedulerInput {
  userId: string;
  now: string;
  lexemes: SchedulerLexemeRef[];
  models: StudentLexemeModel[];
  recentActivity: RecentLearningActivity[];
  userMarkedLexemes?: UserMarkedLexeme[];
  requestedNeedCount?: number;
  createId: () => string;
  random: RandomSource;
  policy?: SchedulerPolicy;
  capability?: LearningContentCapability;
  generator?: LearningNeedGenerator;
}

export interface LearningScheduler {
  planSession(input: SchedulerInput): LearningSessionPlan;
}

interface RankedNeed {
  item: DedupedNeed;
  tieBreak: number;
  sourceIndex: number;
  canonicalKey: string;
}

const FALLBACK_REASONS = new Set(["STAGE_PROGRESS", "REVIEW_DUE"]);

export class DeterministicScheduler implements LearningScheduler {
  planSession(input: SchedulerInput): LearningSessionPlan {
    const policy = input.policy ?? DEFAULT_SCHEDULER_POLICY;
    const capability = input.capability ?? DEFAULT_LEARNING_CONTENT_CAPABILITY;
    const generator = input.generator ?? new DefaultLearningNeedGenerator();
    const modelByLexeme = new Map(
      input.models.map((model) => [model.lexemeId, structuredClone(model)]),
    );
    const models = [...modelByLexeme.values()];
    const lexemeById = new Map(input.lexemes.map((lexeme) => [lexeme.id, lexeme]));
    const lexemeIds = new Set(lexemeById.keys());
    const trace = emptySchedulerTrace();

    const generated = generator.generateCandidates({
      lexemes: input.lexemes,
      models,
      now: input.now,
      userMarkedLexemes: input.userMarkedLexemes,
      createId: input.createId,
      policy,
    });

    const usable: LearningNeedCandidate[] = [];
    for (const candidate of generated) {
      trace.generatedCandidates.push(toTrace(candidate, "GENERATED"));
      const blocked = classifyBlocked(candidate, lexemeIds, capability);
      if (blocked) {
        trace.blockedCandidates.push(toTrace(candidate, "BLOCKED", blocked));
        maybeAddFallback({
          candidate,
          blocked,
          capability,
          model: modelByLexeme.get(candidate.lexemeId),
          generated,
          usable,
          createId: input.createId,
          generatedTraces: trace.generatedCandidates,
        });
        continue;
      }
      usable.push(candidate);
    }

    const scored = usable.map((candidate) => ({
      candidate,
      breakdown: scoreCandidate(
        candidate,
        modelByLexeme.get(candidate.lexemeId),
        input.recentActivity,
        input.now,
        policy,
      ),
      tieBreak: input.random.next(),
    }));

    const { needs, mergedInto } = dedupeCandidates(scored);
    for (const [from, into] of mergedInto) {
      const source =
        generated.find((item) => item.id === from) ??
        usable.find((item) => item.id === from);
      if (source) {
        const scoredItem = scored.find((item) => item.candidate.id === from);
        trace.deduplicatedCandidates.push({
          ...toTrace(source, "DEDUPLICATED", undefined, scoredItem?.breakdown),
          mergedInto: into,
        });
      }
    }

    for (const item of needs) {
      item.need.avoidRecentTaskTypes = avoidRecentTaskTypesForLexeme(
        item.need.lexemeId,
        input.recentActivity,
      );
    }

    const ranked: RankedNeed[] = needs
      .map((item) => {
        const lexeme = lexemeById.get(item.need.lexemeId);
        return {
          item,
          tieBreak:
            scored.find((entry) => entry.candidate.id === item.need.id)
              ?.tieBreak ?? 0,
          sourceIndex: lexeme?.sourceIndex ?? Number.MAX_SAFE_INTEGER,
          canonicalKey: lexeme?.canonicalKey ?? item.need.lexemeId,
        };
      })
      .sort(compareRanked);

    const requestedNeedCount =
      input.requestedNeedCount ?? policy.session.defaultNeedCount;
    const { selected, deferred, quotaDecisions, diversityDecisions } =
      selectNeeds(ranked, requestedNeedCount, policy);
    trace.quotaDecisions = quotaDecisions;
    trace.diversityDecisions = diversityDecisions;
    trace.selectedCandidates = selected.map((item) =>
      needToTrace(item.item, "SELECTED"),
    );
    trace.deferredCandidates = deferred.map((item) =>
      needToTrace(item.item, "DEFERRED"),
    );

    return {
      id: input.createId(),
      userId: input.userId,
      createdAt: input.now,
      schedulerPolicyVersion: policy.version,
      requestedNeedCount,
      needs: selected.map((item) => item.item.need),
      trace,
    };
  }
}

function classifyBlocked(
  candidate: LearningNeedCandidate,
  lexemeIds: Set<string>,
  capability: LearningContentCapability,
): SchedulerBlockedReason | null {
  if (candidate.metadata?.invalidLexeme || !lexemeIds.has(candidate.lexemeId)) {
    return SchedulerBlockedReason.INVALID_LEXEME;
  }
  if (!capability.supportsSkill(candidate.targetSkill)) {
    return SchedulerBlockedReason.UNSUPPORTED_CONTENT_CAPABILITY;
  }
  return null;
}

function maybeAddFallback(input: {
  candidate: LearningNeedCandidate;
  blocked: SchedulerBlockedReason;
  capability: LearningContentCapability;
  model: StudentLexemeModel | undefined;
  generated: LearningNeedCandidate[];
  usable: LearningNeedCandidate[];
  createId: () => string;
  generatedTraces: SchedulerCandidateTrace[];
}): void {
  if (
    input.blocked !== SchedulerBlockedReason.UNSUPPORTED_CONTENT_CAPABILITY ||
    !FALLBACK_REASONS.has(input.candidate.reason) ||
    !input.model
  ) {
    return;
  }
  const fallback = fallbackSkillForUnsupported(
    input.candidate.targetSkill,
    input.model,
  );
  if (!fallback || !input.capability.supportsSkill(fallback)) {
    return;
  }
  const alreadyPresent = [...input.generated, ...input.usable].some(
    (item) =>
      item.lexemeId === input.candidate.lexemeId &&
      item.targetSkill === fallback &&
      item.reason === input.candidate.reason,
  );
  if (alreadyPresent) {
    return;
  }
  const extra: LearningNeedCandidate = {
    ...input.candidate,
    id: input.createId(),
    targetSkill: fallback,
    preferredPromptModes: preferredPromptModesForSkill(fallback),
    source: {
      ruleId: `${input.candidate.source.ruleId}_FALLBACK`,
      explanation: `Fallback from unsupported ${input.candidate.targetSkill} to ${fallback}`,
    },
    metadata: {
      ...input.candidate.metadata,
      fallbackFrom: input.candidate.targetSkill,
    },
  };
  input.generatedTraces.push(toTrace(extra, "GENERATED"));
  input.usable.push(extra);
}

function compareRanked(left: RankedNeed, right: RankedNeed): number {
  const scoreDelta =
    right.item.breakdown.finalRawScore - left.item.breakdown.finalRawScore;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  const bothNew =
    left.item.need.reason === "NEW_WORD" && right.item.need.reason === "NEW_WORD";
  if (bothNew) {
    if (left.sourceIndex !== right.sourceIndex) {
      return left.sourceIndex - right.sourceIndex;
    }
    const key = left.canonicalKey.localeCompare(right.canonicalKey);
    if (key !== 0) {
      return key;
    }
  }
  if (left.tieBreak !== right.tieBreak) {
    return right.tieBreak - left.tieBreak;
  }
  const lexeme = left.item.need.lexemeId.localeCompare(right.item.need.lexemeId);
  if (lexeme !== 0) {
    return lexeme;
  }
  return left.item.need.targetSkill.localeCompare(right.item.need.targetSkill);
}

function trailingRun(
  selected: RankedNeed[],
  matches: (item: RankedNeed) => boolean,
): number {
  let count = 0;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (!matches(selected[index])) {
      break;
    }
    count += 1;
  }
  return count;
}

function diversityBlocks(
  selected: RankedNeed[],
  candidate: RankedNeed,
  policy: SchedulerPolicy,
): boolean {
  if (selected.length === 0) {
    return false;
  }
  if (
    selected[selected.length - 1].item.need.targetSkill ===
      candidate.item.need.targetSkill &&
    trailingRun(
      selected,
      (item) =>
        item.item.need.targetSkill === candidate.item.need.targetSkill,
    ) >= policy.diversity.maxSameSkillInRow
  ) {
    return true;
  }
  if (
    selected[selected.length - 1].item.need.reason ===
      candidate.item.need.reason &&
    trailingRun(
      selected,
      (item) => item.item.need.reason === candidate.item.need.reason,
    ) >= policy.diversity.maxSameReasonInRow
  ) {
    return true;
  }
  return false;
}

function selectNeeds(
  ranked: RankedNeed[],
  requestedNeedCount: number,
  policy: SchedulerPolicy,
): {
  selected: RankedNeed[];
  deferred: RankedNeed[];
  quotaDecisions: SchedulerQuotaDecision[];
  diversityDecisions: SchedulerDiversityDecision[];
} {
  const selected: RankedNeed[] = [];
  const remaining = [...ranked];
  const quotaDecisions: SchedulerQuotaDecision[] = [];
  const diversityDecisions: SchedulerDiversityDecision[] = [];
  let relaxDiversity = false;
  let recordedMaxNewWords = false;
  let recordedFillWithNew = false;
  const reviewAvailable = ranked.filter((item) =>
    isReviewReason(item.item.need.reason),
  ).length;

  function newCount(): number {
    return selected.filter((item) => item.item.need.reason === "NEW_WORD").length;
  }
  function reviewCount(): number {
    return selected.filter((item) => isReviewReason(item.item.need.reason)).length;
  }
  function remainingNonNew(): number {
    return remaining.filter((item) => item.item.need.reason !== "NEW_WORD").length;
  }
  function remainingReview(): number {
    return remaining.filter((item) => isReviewReason(item.item.need.reason)).length;
  }

  function quotaAllows(candidate: RankedNeed): boolean {
    const isNew = candidate.item.need.reason === "NEW_WORD";
    if (isNew && newCount() >= policy.session.maxNewWords && remainingNonNew() > 0) {
      return false;
    }
    if (
      !isReviewReason(candidate.item.need.reason) &&
      reviewCount() < policy.session.minReviewNeeds &&
      remainingReview() > 0 &&
      reviewAvailable >= policy.session.minReviewNeeds
    ) {
      return false;
    }
    return true;
  }

  while (selected.length < requestedNeedCount && remaining.length > 0) {
    let pickedIndex = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!quotaAllows(candidate)) {
        continue;
      }
      if (!relaxDiversity && diversityBlocks(selected, candidate, policy)) {
        const alternativeExists = remaining.some(
          (item, altIndex) =>
            altIndex !== index &&
            quotaAllows(item) &&
            !diversityBlocks(selected, item, policy),
        );
        if (alternativeExists) {
          continue;
        }
        relaxDiversity = true;
        diversityDecisions.push({
          kind: "RELAXED",
          candidateId: candidate.item.need.id,
          detail: "Diversity constraint relaxed to fill the session plan",
        });
      }
      pickedIndex = index;
      break;
    }

    if (pickedIndex === -1) {
      if (!relaxDiversity) {
        relaxDiversity = true;
        diversityDecisions.push({
          kind: "RELAXED",
          candidateId: remaining[0].item.need.id,
          detail: "Diversity constraint relaxed to fill the session plan",
        });
        continue;
      }
      const fillerIndex = remaining.findIndex(
        (item) => item.item.need.reason === "NEW_WORD",
      );
      if (fillerIndex >= 0) {
        if (!recordedFillWithNew) {
          quotaDecisions.push({
            kind: "FILL_WITH_NEW_WORDS",
            detail:
              "Insufficient non-new candidates; filling remaining slots with NEW_WORD",
          });
          recordedFillWithNew = true;
        }
        const [filler] = remaining.splice(fillerIndex, 1);
        selected.push(filler);
        continue;
      }
      break;
    }

    const [picked] = remaining.splice(pickedIndex, 1);
    if (
      picked.item.need.reason === "NEW_WORD" &&
      newCount() + 1 === policy.session.maxNewWords &&
      !recordedMaxNewWords
    ) {
      quotaDecisions.push({
        kind: "MAX_NEW_WORDS",
        detail: `Reached maxNewWords=${policy.session.maxNewWords}`,
      });
      recordedMaxNewWords = true;
    }
    selected.push(picked);
  }

  if (
    reviewAvailable >= policy.session.minReviewNeeds &&
    reviewCount() >= policy.session.minReviewNeeds
  ) {
    quotaDecisions.push({
      kind: "MIN_REVIEW_NEEDS",
      detail: `Selected ${reviewCount()} review needs (min ${policy.session.minReviewNeeds})`,
    });
  }

  for (const item of remaining) {
    diversityDecisions.push({
      kind: "DEFERRED",
      candidateId: item.item.need.id,
      detail: "Not selected in this session",
    });
  }

  return {
    selected,
    deferred: remaining,
    quotaDecisions,
    diversityDecisions,
  };
}

function toTrace(
  candidate: LearningNeedCandidate,
  status: SchedulerCandidateTrace["status"],
  blockedReason?: SchedulerBlockedReason,
  breakdown?: PriorityBreakdown,
): SchedulerCandidateTrace {
  return {
    id: candidate.id,
    lexemeId: candidate.lexemeId,
    skill: candidate.targetSkill,
    reason: candidate.reason,
    sourceRuleId: candidate.source.ruleId,
    explanation: candidate.source.explanation,
    priorityBreakdown: breakdown,
    status,
    blockedReason,
  };
}

function needToTrace(
  item: DedupedNeed,
  status: SchedulerCandidateTrace["status"],
): SchedulerCandidateTrace {
  return {
    id: item.need.id,
    lexemeId: item.need.lexemeId,
    skill: item.need.targetSkill,
    reason: item.need.reason,
    sourceRuleId: item.sourceRuleIds[0] ?? "MERGED",
    explanation: item.explanations.join("; "),
    priorityBreakdown: item.breakdown,
    status,
  };
}
