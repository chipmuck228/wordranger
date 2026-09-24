import "server-only";

import { compareTerminalEvidenceDesc } from "./recently-incorrect";
import type {
  FreePracticeLearnerSnapshot,
  FreePracticePlanReadPort,
  FreePracticeTerminalEvidence,
} from "./types";

function requireUserId(userId: string): string {
  const trimmed = typeof userId === "string" ? userId.trim() : "";
  if (!trimmed) {
    throw new Error("Free Practice read adapter requires a trusted userId");
  }
  return trimmed;
}

/**
 * Test/read-only adapter. Seeds are test fixtures only. The planner
 * never writes through this port.
 */
export class InMemoryFreePracticePlanReadAdapter
  implements FreePracticePlanReadPort
{
  private readonly snapshots = new Map<string, FreePracticeLearnerSnapshot[]>();
  private readonly evidence = new Map<string, FreePracticeTerminalEvidence[]>();
  readonly writeAttempts = 0;

  seedSnapshots(
    userId: string,
    rows: readonly FreePracticeLearnerSnapshot[],
  ): void {
    this.snapshots.set(requireUserId(userId), [...rows]);
  }

  seedEvidence(
    userId: string,
    rows: readonly FreePracticeTerminalEvidence[],
  ): void {
    this.evidence.set(requireUserId(userId), [...rows]);
  }

  async listStudentLexemeSnapshots(
    userId: string,
  ): Promise<FreePracticeLearnerSnapshot[]> {
    return [...(this.snapshots.get(requireUserId(userId)) ?? [])];
  }

  async listRecentTerminalEvidence(
    userId: string,
    limit: number,
  ): Promise<FreePracticeTerminalEvidence[]> {
    const rows = [...(this.evidence.get(requireUserId(userId)) ?? [])];
    return rows.sort(compareTerminalEvidenceDesc).slice(0, limit);
  }
}
