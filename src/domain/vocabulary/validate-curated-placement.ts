import { CURATED_PLACEMENT_STATUS } from "./curated-placement";
import type { CuratedPlacementOverride } from "./curated-placement";
import type { PlacementBandDefinition } from "./provisional-placement";

export interface CuratedPlacementIssue {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const ISO_REVIEWED_AT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function curatedPlacementIssues(args: {
  definition: PlacementBandDefinition;
  records: readonly CuratedPlacementOverride[];
  lexemeIds: ReadonlySet<string>;
  canonicalKeys?: ReadonlySet<string>;
}): CuratedPlacementIssue[] {
  const issues: CuratedPlacementIssue[] = [];
  const bandIds = new Set(args.definition.bands.map((band) => band.id));
  const seen = new Set<string>();

  for (const record of args.records) {
    if (!record.lexemeId) {
      issues.push({
        code: "CURATED_MISSING_LEXEME_ID",
        message: "Curated placement record is missing lexemeId",
      });
      continue;
    }
    if (args.canonicalKeys?.has(record.lexemeId)) {
      issues.push({
        code: "CURATED_CANONICAL_KEY_AS_LEXEME_ID",
        message: `Curated placement lexemeId must be Lexeme.id, not canonicalKey ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    } else if (!args.lexemeIds.has(record.lexemeId)) {
      issues.push({
        code: "CURATED_UNKNOWN_LEXEME",
        message: `Curated placement points at unknown lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    if (seen.has(record.lexemeId)) {
      issues.push({
        code: "CURATED_DUPLICATE_LEXEME",
        message: `Duplicate curated placement for lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    seen.add(record.lexemeId);

    if (!bandIds.has(record.bandId)) {
      issues.push({
        code: "CURATED_UNKNOWN_BAND",
        message: `Curated placement for ${record.lexemeId} uses unknown band ${record.bandId}`,
        metadata: { lexemeId: record.lexemeId, bandId: record.bandId },
      });
    }
    if (record.source !== "CURATED") {
      issues.push({
        code: "CURATED_SOURCE_NOT_CURATED",
        message: `Curated placement for ${record.lexemeId} must be CURATED, got ${String(record.source)}`,
        metadata: { lexemeId: record.lexemeId, source: record.source },
      });
    }
    if (record.status !== CURATED_PLACEMENT_STATUS) {
      issues.push({
        code: "CURATED_STATUS_NOT_REVIEWED",
        message: `Curated placement for ${record.lexemeId} must be REVIEWED`,
        metadata: { lexemeId: record.lexemeId, status: record.status },
      });
    }
    if (!Array.isArray(record.provenance) || record.provenance.length === 0) {
      issues.push({
        code: "CURATED_MISSING_PROVENANCE",
        message: `Curated placement for ${record.lexemeId} is missing provenance`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    if (
      !record.reviewedAt ||
      !ISO_REVIEWED_AT.test(record.reviewedAt) ||
      Number.isNaN(Date.parse(record.reviewedAt))
    ) {
      issues.push({
        code: "CURATED_MALFORMED_REVIEWED_AT",
        message: `Curated placement for ${record.lexemeId} has malformed reviewedAt ${String(record.reviewedAt)}`,
        metadata: { lexemeId: record.lexemeId, reviewedAt: record.reviewedAt },
      });
    }
  }

  return issues;
}
