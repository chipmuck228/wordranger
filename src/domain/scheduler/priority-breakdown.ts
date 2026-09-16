import { clamp01 } from "@/domain/learning/engine/math";

export interface PriorityBreakdown {
  reasonBase: number;
  weaknessBoost: number;
  overdueBoost: number;
  fadingBoost: number;
  skillGapBoost: number;
  confidenceAdjustment: number;
  recencyPenalty: number;
  finalRawScore: number;
  finalPriority: number;
}

export function assemblePriority(parts: Omit<PriorityBreakdown, "finalRawScore" | "finalPriority">): PriorityBreakdown {
  const finalRawScore =
    parts.reasonBase +
    parts.weaknessBoost +
    parts.overdueBoost +
    parts.fadingBoost +
    parts.skillGapBoost +
    parts.confidenceAdjustment -
    parts.recencyPenalty;
  return {
    ...parts,
    finalRawScore,
    finalPriority: clamp01(finalRawScore),
  };
}
