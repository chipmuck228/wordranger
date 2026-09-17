/**
 * Candidate V0 / Experimental / Not a Standard.
 */

export type ProvenanceKind =
  | "SOURCE"
  | "CURATED"
  | "EXTERNAL_REFERENCE"
  | "MODEL_GENERATED"
  | "INFERRED";

export type ReviewStatus =
  | "DRAFT"
  | "REVIEW_REQUIRED"
  | "REVIEWED"
  | "REJECTED";

export interface Provenance {
  kind: ProvenanceKind;
  sourceIds?: string[];
  authoringAgent?: string;
  confidence?: number;
  createdAt: string;
}

export const CANDIDATE_V0_CREATED_AT = "2026-09-17T00:00:00.000Z";

export function curatedFixtureProvenance(sourceId: string): Provenance {
  return {
    kind: "CURATED",
    sourceIds: [sourceId],
    authoringAgent: "candidate-v0-fixture",
    createdAt: CANDIDATE_V0_CREATED_AT,
  };
}
