import {
  PLACEMENT_BAND_FIELDS,
  PLACEMENT_FIELD_NAMES,
  PLACEMENT_METADATA_SOURCES,
  type PlacementField,
  type PlacementFieldName,
  type VocabularyPlacementMetadata,
} from "./placement-metadata";

export interface PlacementMetadataIssue {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const SOURCE_SET = new Set<string>(PLACEMENT_METADATA_SOURCES);
const FIELD_SET = new Set<string>(PLACEMENT_FIELD_NAMES);
const BAND_SET = new Set<string>(PLACEMENT_BAND_FIELDS);

export function placementMetadataIssues(
  records: readonly VocabularyPlacementMetadata[],
  lexemeIds: ReadonlySet<string>,
): PlacementMetadataIssue[] {
  const issues: PlacementMetadataIssue[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    if (!record.lexemeId) {
      issues.push({
        code: "PLACEMENT_MISSING_LEXEME_ID",
        message: "Placement metadata record is missing lexemeId",
      });
      continue;
    }
    if (!lexemeIds.has(record.lexemeId)) {
      issues.push({
        code: "PLACEMENT_UNKNOWN_LEXEME",
        message: `Placement metadata points at unknown lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    if (seen.has(record.lexemeId)) {
      issues.push({
        code: "PLACEMENT_DUPLICATE_LEXEME",
        message: `Duplicate placement metadata for lexeme ${record.lexemeId}`,
        metadata: { lexemeId: record.lexemeId },
      });
    }
    seen.add(record.lexemeId);

    for (const unknown of unknownRecordKeys(record)) {
      issues.push({
        code: "PLACEMENT_UNKNOWN_FIELD",
        message: `Placement metadata for ${record.lexemeId} has unsupported field ${unknown}`,
        metadata: { lexemeId: record.lexemeId, field: unknown },
      });
    }

    for (const name of PLACEMENT_FIELD_NAMES) {
      const field = record[name];
      if (field === undefined) {
        continue;
      }
      issues.push(...fieldIssues(record.lexemeId, name, field));
    }
  }

  return issues;
}

function unknownRecordKeys(record: VocabularyPlacementMetadata): string[] {
  return Object.keys(record).filter(
    (key) => key !== "lexemeId" && !FIELD_SET.has(key),
  );
}

function fieldIssues(
  lexemeId: string,
  name: PlacementFieldName,
  field: PlacementField<unknown>,
): PlacementMetadataIssue[] {
  const issues: PlacementMetadataIssue[] = [];
  if (!SOURCE_SET.has(field.source)) {
    issues.push({
      code: "PLACEMENT_UNKNOWN_SOURCE",
      message: `Placement field ${name} on ${lexemeId} has unsupported source ${String(field.source)}`,
      metadata: { lexemeId, field: name, source: field.source },
    });
  }
  if (!Array.isArray(field.provenance) || field.provenance.length === 0) {
    issues.push({
      code: "PLACEMENT_MISSING_PROVENANCE",
      message: `Placement field ${name} on ${lexemeId} is missing provenance`,
      metadata: { lexemeId, field: name },
    });
  }
  if (
    field.confidence !== undefined &&
    (typeof field.confidence !== "number" ||
      field.confidence < 0 ||
      field.confidence > 1)
  ) {
    issues.push({
      code: "PLACEMENT_CONFIDENCE_RANGE",
      message: `Placement field ${name} on ${lexemeId} has confidence ${String(field.confidence)} outside 0..1`,
      metadata: { lexemeId, field: name, confidence: field.confidence },
    });
  }
  if (BAND_SET.has(name) && field.source === "INFERRED") {
    issues.push({
      code: "PLACEMENT_INFERRED_BAND",
      message: `Placement field ${name} on ${lexemeId} cannot be INFERRED`,
      metadata: { lexemeId, field: name },
    });
  }
  if (BAND_SET.has(name) && field.source === "SOURCE") {
    issues.push({
      code: "PLACEMENT_UNSUPPORTED_SOURCE_BAND",
      message: `Placement field ${name} on ${lexemeId} is not present in the PDF/source`,
      metadata: { lexemeId, field: name },
    });
  }
  return issues;
}
