import {
  PLACEMENT_BAND_FIELDS,
  type PlacementBandFieldName,
  type PlacementMetadataSource,
  type VocabularyPlacementMetadata,
} from "./placement-metadata";

export const ADAPTIVE_PLACEMENT_READINESS = {
  READY: "READY",
  PLACEMENT_DATA_BLOCKER: "PLACEMENT_DATA_BLOCKER",
} as const;

export type AdaptivePlacementReadinessStatus =
  (typeof ADAPTIVE_PLACEMENT_READINESS)[keyof typeof ADAPTIVE_PLACEMENT_READINESS];

/** Only these sources may drive production placement jumps. */
export const PRODUCTION_PLACEMENT_SOURCES = [
  "CURATED",
  "EXTERNAL_REFERENCE",
] as const;

export type ProductionPlacementSource =
  (typeof PRODUCTION_PLACEMENT_SOURCES)[number];

/**
 * Preferred production axis if that field is reviewed and complete enough.
 * Do not mix axes.
 */
export const PLACEMENT_AXIS_PRIORITY: readonly PlacementBandFieldName[] = [
  "curriculumBand",
  "gradeBand",
  "difficultyBand",
  "frequencyBand",
];

export const MIN_AUTHORITATIVE_PLACEMENT_BANDS = 3;
export const MIN_AUTHORITATIVE_PLACEMENT_COVERAGE = 0.8;

export interface AdaptivePlacementReadiness {
  status: AdaptivePlacementReadinessStatus;
  primaryAxis: PlacementBandFieldName | null;
  bandValues: string[];
  coveredLexemeCount: number;
  lexemeCount: number;
  coverage: number;
  reasons: string[];
}

function isProductionSource(
  source: PlacementMetadataSource,
): source is ProductionPlacementSource {
  return source === "CURATED" || source === "EXTERNAL_REFERENCE";
}

function axisStats(
  records: readonly VocabularyPlacementMetadata[],
  axis: PlacementBandFieldName,
): { values: Set<string>; covered: number } {
  const values = new Set<string>();
  let covered = 0;
  for (const record of records) {
    const field = record[axis];
    if (!field || !isProductionSource(field.source) || !field.value) {
      continue;
    }
    covered += 1;
    values.add(field.value);
  }
  return { values, covered };
}

/**
 * Design/production gate for Adaptive Placement.
 *
 * SOURCE print facts (`alphabeticalSection`, `starred`) and INFERRED
 * `functionWord` never unlock this gate. `sourceIndex` is not a placement
 * field and is ignored.
 */
export function assessAdaptivePlacementReadiness(
  records: readonly VocabularyPlacementMetadata[],
  lexemeCount: number,
): AdaptivePlacementReadiness {
  const reasons: string[] = [];
  if (lexemeCount <= 0) {
    return {
      status: ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
      primaryAxis: null,
      bandValues: [],
      coveredLexemeCount: 0,
      lexemeCount,
      coverage: 0,
      reasons: ["No lexemes available for placement coverage."],
    };
  }

  let selected: PlacementBandFieldName | null = null;
  let selectedValues: string[] = [];
  let selectedCovered = 0;
  let selectedCoverage = 0;

  for (const axis of PLACEMENT_AXIS_PRIORITY) {
    const stats = axisStats(records, axis);
    const coverage = stats.covered / lexemeCount;
    if (
      stats.values.size >= MIN_AUTHORITATIVE_PLACEMENT_BANDS &&
      coverage >= MIN_AUTHORITATIVE_PLACEMENT_COVERAGE
    ) {
      selected = axis;
      selectedValues = [...stats.values].sort();
      selectedCovered = stats.covered;
      selectedCoverage = coverage;
      break;
    }
  }

  if (!selected) {
    const populated = PLACEMENT_BAND_FIELDS.filter((axis) => {
      const stats = axisStats(records, axis);
      return stats.covered > 0;
    });
    reasons.push(
      "No CURATED or EXTERNAL_REFERENCE band axis covers ≥80% of lexemes with ≥3 distinct bands.",
    );
    if (populated.length === 0) {
      reasons.push(
        "curriculumBand, gradeBand, difficultyBand, and frequencyBand are absent from production metadata.",
      );
    }
    reasons.push(
      "sourceIndex is PDF numbered order, not difficulty, and must not drive placement jumps.",
    );
    reasons.push(
      "alphabeticalSection is A–Z print grouping, not a curriculum or grade progression.",
    );
    reasons.push(
      "starred is a PDF typographic marker, not an easy/core/mastered classification.",
    );
    reasons.push(
      "functionWord is INFERRED POS heuristic and must not skip training or mark mastery.",
    );
    return {
      status: ADAPTIVE_PLACEMENT_READINESS.PLACEMENT_DATA_BLOCKER,
      primaryAxis: null,
      bandValues: [],
      coveredLexemeCount: 0,
      lexemeCount,
      coverage: 0,
      reasons,
    };
  }

  return {
    status: ADAPTIVE_PLACEMENT_READINESS.READY,
    primaryAxis: selected,
    bandValues: selectedValues,
    coveredLexemeCount: selectedCovered,
    lexemeCount,
    coverage: selectedCoverage,
    reasons: [],
  };
}
