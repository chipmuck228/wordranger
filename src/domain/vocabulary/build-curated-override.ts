import {
  CURATED_PLACEMENT_STATUS,
  HUMAN_REVIEW_PROVENANCE,
  type CuratedPlacementOverride,
} from "./curated-placement";
import { curatedPlacementIssues } from "./validate-curated-placement";
import type { PlacementBandDefinition } from "./provisional-placement";

export function buildServerCuratedOverride(input: {
  lexemeId: string;
  bandId: string;
  reviewNote?: string;
  now: string;
}): CuratedPlacementOverride {
  const note = input.reviewNote?.trim();
  const record: CuratedPlacementOverride = {
    lexemeId: input.lexemeId,
    bandId: input.bandId,
    status: CURATED_PLACEMENT_STATUS,
    source: "CURATED",
    provenance: [HUMAN_REVIEW_PROVENANCE],
    reviewedAt: input.now,
  };
  if (note) {
    record.reviewNote = note;
  }
  return record;
}

export function assertValidCuratedOverride(args: {
  record: CuratedPlacementOverride;
  definition: PlacementBandDefinition;
  lexemeIds: ReadonlySet<string>;
  canonicalKeys: ReadonlySet<string>;
}): void {
  const issues = curatedPlacementIssues({
    definition: args.definition,
    records: [args.record],
    lexemeIds: args.lexemeIds,
    canonicalKeys: args.canonicalKeys,
  });
  if (issues.length > 0) {
    throw new CuratedPlacementValidationError(issues[0]!.code, issues[0]!.message);
  }
}

export class CuratedPlacementValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CuratedPlacementValidationError";
    this.code = code;
  }
}
