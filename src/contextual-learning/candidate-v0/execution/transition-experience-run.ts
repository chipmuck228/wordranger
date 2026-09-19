/**
 * Candidate V0 / Experimental / Not a Standard.
 * Deterministic command application. Ordinary failures are result objects.
 */

import { abortExperienceRun } from "./abort-experience-run";
import { issueCurrentStep } from "./issue-current-step";
import { recordGuidedActivityCompletion } from "./record-guided-activity-completion";
import { recordFrozenTaskCompletion } from "./record-task-completion";
import type {
  ExperienceRun,
  ExperienceRunCommand,
  ExperienceRunResult,
} from "./types";

export interface ApplyExperienceCommandOptions {
  now?: string;
}

export function applyExperienceCommand(
  run: ExperienceRun,
  command: ExperienceRunCommand,
  options: ApplyExperienceCommandOptions = {},
): ExperienceRunResult {
  if (command.kind === "ISSUE_CURRENT_STEP") {
    return issueCurrentStep({
      run,
      createId: command.createId,
      now: options.now,
    });
  }
  if (command.kind === "RECORD_FROZEN_TASK_COMPLETION") {
    return recordFrozenTaskCompletion({
      run,
      receipt: command.receipt,
      now: options.now,
    });
  }
  if (command.kind === "RECORD_GUIDED_ACTIVITY_COMPLETION") {
    return recordGuidedActivityCompletion({
      run,
      receipt: command.receipt,
      now: options.now,
    });
  }
  return abortExperienceRun({
    run,
    reason: command.reason,
    now: options.now,
  });
}
