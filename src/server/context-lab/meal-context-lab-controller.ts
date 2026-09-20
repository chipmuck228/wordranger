import "server-only";

/**
 * Server-authoritative Meal BUILD Context Lab controller.
 * Issues only the current Candidate step. Does not grade or write Evidence.
 */

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import type { ContextLabCurrentScreen } from "@/components/context-lab/types";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  isGuidedExperienceStep,
  type ExperienceTarget,
  type LearningExperiencePlan,
  type ResolvedTargetSnapshot,
  type RuntimeCapability,
} from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createExperienceRun,
  createPublicGuidedActivity,
  issueCurrentStep,
  recordGuidedActivityCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import { ExecutionErrorCode } from "@/contextual-learning/candidate-v0/execution/errors";
import type { PublicGuidedActivity } from "@/contextual-learning/candidate-v0/execution/guided-activity";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import {
  planExperience,
  type ExperiencePlanningInput,
} from "@/contextual-learning/candidate-v0/planning";
import {
  findPlannerFrame,
  findPlannerSkeleton,
  PLANNER_SENSE_PROFILES,
  PLANNER_SUPPORT_BLOCKS,
} from "@/contextual-learning/candidate-v0/planning/plan-variant-registry";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  errorScreen,
  notFoundRunScreen,
  staleRunScreen,
} from "./context-lab-errors";
import {
  CONTEXT_LAB_RUN_SCHEMA_VERSION,
  type ContextLabRunRepository,
} from "./context-lab-run.types";
import { HOME_BREAKFAST_FRAME_ID } from "./meal-presentation-map";
import {
  presentFrozenTaskScreen,
  presentGuidedScreen,
  progressForIssuedRun,
} from "./present-context-lab-screen";

const TYPING_CAPABILITY = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-text-input:TYPE",
);

export interface MealContextLabControllerOptions {
  repository: ContextLabRunRepository;
  userId?: string;
  enabled?: boolean;
  now?: () => string;
  createId?: () => string;
  planningInput?: ExperiencePlanningInput;
}

export class MealContextLabController {
  private readonly repository: ContextLabRunRepository;
  private readonly userId: string;
  private readonly enabled: boolean;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly planningInput?: ExperiencePlanningInput;

  constructor(options: MealContextLabControllerOptions) {
    this.repository = options.repository;
    this.userId = options.userId ?? V1_PLACEHOLDER_USER_ID;
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.planningInput = options.planningInput;
  }

  async start(): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const prepared = this.createIssuedRun();
    if ("screen" in prepared) {
      return prepared.screen;
    }
    const createdAt = this.now();
    await this.repository.create({
      id: prepared.run.id,
      userId: this.userId,
      schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
      experienceId: prepared.run.experienceId,
      experienceRun: prepared.run,
      revision: 0,
      createdAt,
      updatedAt: createdAt,
    });
    return this.toPublicScreen(prepared.run, 0, prepared.issued);
  }

  async acknowledge(input: {
    runId: string;
    revision: number;
    activityId: string;
  }): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const record = await this.repository.get({
      runId: input.runId,
      userId: this.userId,
    });
    if (!record) {
      return notFoundRunScreen();
    }
    if (record.revision !== input.revision) {
      return staleRunScreen();
    }
    if (record.experienceRun.status !== "GUIDED_ACTIVITY_ISSUED") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const current = record.experienceRun.stepRuns[record.experienceRun.currentStepIndex];
    if (!current?.activityId || current.activityId !== input.activityId) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }

    const completedAt = this.now();
    const recorded = recordGuidedActivityCompletion({
      run: record.experienceRun,
      receipt: {
        activityId: input.activityId,
        completedAt,
      },
      now: completedAt,
    });
    if (!recorded.ok) {
      return errorScreen(
        mapAckError(recorded.error.code),
        { recoverable: true, detail: recorded.error.code },
      );
    }

    const issued = issueCurrentStep({
      run: recorded.run,
      now: completedAt,
      createId: this.createId,
    });
    if (!issued.ok) {
      return errorScreen(mapIssueError(issued.error.code), {
        detail: issued.error.code,
      });
    }

    const saved = await this.repository.saveIfRevision({
      runId: input.runId,
      userId: this.userId,
      expectedRevision: input.revision,
      nextRun: issued.run,
      updatedAt: completedAt,
    });
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    return this.toPublicScreen(issued.run, saved.revision, {
      issuedActivity: issued.issuedActivity,
      issuedTask: issued.issuedTask,
    });
  }

  async restart(): Promise<ContextLabCurrentScreen> {
    return this.start();
  }

  async loadCurrent(input: { runId: string }): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const record = await this.repository.get({
      runId: input.runId,
      userId: this.userId,
    });
    if (!record) {
      return notFoundRunScreen();
    }
    return this.presentStoredRun(record.experienceRun, record.revision);
  }

  private createIssuedRun():
    | { run: ExperienceRun; issued: IssuedPayload }
    | { screen: ContextLabCurrentScreen } {
    const planned = planExperience(
      this.planningInput ?? mealBuildPlanningInput(),
    );
    if (!planned.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
          detail: planned.error.code,
        }),
      };
    }

    const frame = findPlannerFrame(planned.plan.contextFrameId);
    const skeleton = findPlannerSkeleton(planned.plan.skeletonId);
    if (
      !frame ||
      !skeleton ||
      planned.plan.contextFrameId !== HOME_BREAKFAST_FRAME_ID
    ) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION),
      };
    }

    const validated = validateExperiencePlan({
      plan: planned.plan,
      frame,
      skeleton,
      capabilities:
        this.planningInput?.runtimeCapabilities ?? typingCapabilities(),
      supportBlocks: PLANNER_SUPPORT_BLOCKS,
      senseProfiles: PLANNER_SENSE_PROFILES,
    });
    if (!validated.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE, {
          detail: validated.issues[0]?.code,
        }),
      };
    }

    const createdAt = this.now();
    const created = createExperienceRun({
      plan: planned.plan,
      resolvedContext: resolveContextSnapshot(
        frame,
        skeleton,
        planned.plan.activeGoalId,
      ),
      resolvedTargets: resolvePlanTargets(planned.plan),
      now: createdAt,
      createId: this.createId,
    });
    if (!created.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE, {
          detail: created.error.code,
        }),
      };
    }

    const issued = issueCurrentStep({
      run: created.run,
      now: createdAt,
      createId: this.createId,
    });
    if (!issued.ok) {
      return {
        screen: errorScreen(mapIssueError(issued.error.code), {
          detail: issued.error.code,
        }),
      };
    }
    return {
      run: issued.run,
      issued: {
        issuedActivity: issued.issuedActivity,
        issuedTask: issued.issuedTask,
      },
    };
  }

  private presentStoredRun(
    run: ExperienceRun,
    revision: number,
  ): ContextLabCurrentScreen {
    const current = run.stepRuns[run.currentStepIndex];
    const progress = progressForIssuedRun(run);
    const handle = { runId: run.id, revision };
    if (run.status === "GUIDED_ACTIVITY_ISSUED" && current?.activityId) {
      const step = run.planSnapshot.plan.steps[run.currentStepIndex];
      if (!step || !isGuidedExperienceStep(step)) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
      }
      return presentGuidedScreen({
        handle,
        activity: createPublicGuidedActivity({
          runId: run.id,
          experienceId: run.experienceId,
          contextFrameId: run.planSnapshot.resolvedContext.contextFrameId,
          step,
        }),
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    if (run.status === "FROZEN_TASK_ISSUED") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN, {
        message: "当前步骤已到达输入预览，请重新体验。",
        recoverable: true,
      });
    }
    return notFoundRunScreen();
  }

  private toPublicScreen(
    run: ExperienceRun,
    revision: number,
    issued: IssuedPayload,
  ): ContextLabCurrentScreen {
    const handle = { runId: run.id, revision };
    const progress = progressForIssuedRun(run);
    if (issued.issuedActivity) {
      return presentGuidedScreen({
        handle,
        activity: issued.issuedActivity,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    if (issued.issuedTask) {
      return presentFrozenTaskScreen({
        handle,
        task: issued.issuedTask,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    return errorScreen(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
  }
}

interface IssuedPayload {
  issuedActivity?: PublicGuidedActivity;
  issuedTask?: PublicLearningTask;
}

export function mealBuildPlanningInput(
  capabilities: RuntimeCapability[] = typingCapabilities(),
): ExperiencePlanningInput {
  return {
    learningNeedRef: "need-opaque-ref",
    mode: "BUILD",
    targets: [spoonFormTarget()],
    allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
    runtimeCapabilities: capabilities,
  };
}

function resolvePlanTargets(
  plan: LearningExperiencePlan,
): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => ({
    targetId: target.id,
    sense: target.sense,
    displayForm: findProfile(PLANNER_SENSE_PROFILES, target.sense)?.displayForm ?? "",
    focus: target.focus,
  }));
}

function spoonFormTarget(): ExperienceTarget {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM",
  };
}

function typingCapabilities(): RuntimeCapability[] {
  if (!TYPING_CAPABILITY) {
    return [];
  }
  return [TYPING_CAPABILITY];
}

function mapIssueError(code: string): (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES] {
  if (
    code === ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT ||
    code === ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT
  ) {
    return CONTEXT_LAB_ERROR_CODES.GUIDED_GROUNDING_FAILURE;
  }
  if (code.startsWith("COMPILATION_") || code === "EXP_RECALL_LEAKS_ANSWER") {
    return CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE;
  }
  return CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE;
}

function mapAckError(code: string): (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES] {
  if (
    code === ExecutionErrorCode.EXEC_ACTIVITY_ID_MISMATCH ||
    code === ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION ||
    code === ExecutionErrorCode.EXEC_RECEIPT_KIND_MISMATCH ||
    code === ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION
  ) {
    return CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED;
  }
  return CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE;
}
