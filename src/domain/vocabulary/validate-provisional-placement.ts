import {
  PRODUCTION_PLACEMENT_SOURCES,
  type ProductionPlacementSource,
} from "./adaptive-placement-readiness";
import type { PlacementMetadataSource } from "./placement-metadata";
import type {
  PlacementBandDefinition,
  ProvisionalLexemePlacement,
} from "./provisional-placement";

export interface ProvisionalPlacementIssue {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const PRODUCTION_SOURCE_SET = new Set<string>(PRODUCTION_PLACEMENT_SOURCES);

function isProductionSource(
  source: PlacementMetadataSource | string,
): source is ProductionPlacementSource {
  return PRODUCTION_SOURCE_SET.has(source);
}

export function provisionalPlacementIssues(args: {
  definition: PlacementBandDefinition;
  records: readonly ProvisionalLexemePlacement[];
  lexemeIds: ReadonlySet<string>;
  canonicalKeys?: ReadonlySet<string>;
}): ProvisionalPlacementIssue[] {
  const issues: ProvisionalPlacementIssue[] = [];
  const bandIds = new Set<string>();
  const orders = new Set<number>();

  if (!args.definition.version) {
    issues.push({
      code: "PROVISIONAL_BAND_MISSING_VERSION",
      message: "Provisional band definition is missing version",
    });
  }
  if (args.definition.bands.length === 0) {
    issues.push({
      code: "PROVISIONAL_BAND_EMPTY",
      message: "Provisional band definition has no bands",
    });
  }

  for (const band of args.definition.bands) {
    if (!band.id) {
      issues.push({
        code: "PROVISIONAL_BAND_MISSING_ID",
        message: "Provisional band is missing id",
      });
      continue;
    }
    if (bandIds.has(band.id)) {
      issues.push({
        code: "PROVISIONAL_BAND_DUPLICATE_ID",
        message: `Duplicate provisional band id ${band.id}`,
        metadata: { bandId: band.id },
      });
    }
    bandIds.add(band.id);
    if (band.order === undefined || band.order === null || Number.isNaN(band.order)) {
      issues.push({
        code: "PROVISIONAL_BAND_MISSING_ORDER",
        message: `Provisional band ${band.id} is missing order`,
        metadata: { bandId: band.id },
      });
      continue;
    }
    if (orders.has(band.order)) {
      issues.push({
        code: "PROVISIONAL_BAND_DUPLICATE_ORDER",
        message: `Duplicate provisional band order ${band.order}`,
        metadata: { bandId: band.id, order: band.order },
      });
    }
    orders.add(band.order);
  }

  const seen = new Set<string>();
  const assigned = new Set<string>();
  for (const record of args.records) {
    if (!record.lexemeId) {
      issues.push({
        code: "PROVISIONAL_MISSING_LEXEME_ID",
        message: "Provisional placement record is missing lexemeId",
      });
      continue;
    }
    if (args.canonicalKeys?.has(record.lexemeId)) {
      issues.push({
        code: "PROVISIONAL_CANONICAL_KEY_AS_LEXEME_ID",
        message: `Provisional placement lexemeId must be Lexeme.id, not canonicalKey ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    } else if (!args.lexemeIds.has(record.lexemeId)) {
      issues.push({
        code: "PROVISIONAL_UNKNOWN_LEXEME",
        message: `Provisional placement points at unknown lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    } else {
      assigned.add(record.lexemeId);
    }
    if (seen.has(record.lexemeId)) {
      issues.push({
        code: "PROVISIONAL_DUPLICATE_LEXEME",
        message: `Duplicate provisional placement for lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    seen.add(record.lexemeId);

    const field = record.provisionalBand;
    if (!field) {
      issues.push({
        code: "PROVISIONAL_MISSING_BAND",
        message: `Provisional placement for ${record.lexemeId} is missing provisionalBand`,
        metadata: { lexemeId: record.lexemeId },
      });
      continue;
    }
    if (!bandIds.has(field.value)) {
      issues.push({
        code: "PROVISIONAL_UNKNOWN_BAND",
        message: `Provisional placement for ${record.lexemeId} uses unknown band ${field.value}`,
        metadata: { lexemeId: record.lexemeId, bandId: field.value },
      });
    }
    if (!Array.isArray(field.provenance) || field.provenance.length === 0) {
      issues.push({
        code: "PROVISIONAL_MISSING_PROVENANCE",
        message: `Provisional placement for ${record.lexemeId} is missing provenance`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    if (isProductionSource(field.source) || field.source === "SOURCE") {
      issues.push({
        code: "PROVISIONAL_AUTHORITATIVE_SOURCE",
        message: `Provisional placement for ${record.lexemeId} must not use ${field.source}`,
        metadata: { lexemeId: record.lexemeId, source: field.source },
      });
    }
    if (field.source !== "INFERRED") {
      issues.push({
        code: "PROVISIONAL_SOURCE_NOT_INFERRED",
        message: `Provisional placement for ${record.lexemeId} must be INFERRED, got ${String(field.source)}`,
        metadata: { lexemeId: record.lexemeId, source: field.source },
      });
    }
  }

  for (const lexemeId of args.lexemeIds) {
    if (!assigned.has(lexemeId)) {
      issues.push({
        code: "PROVISIONAL_MISSING_LEXEME",
        message: `Canonical lexeme ${lexemeId} has no provisional placement`,
        metadata: { lexemeId },
      });
    }
  }

  return issues;
}
