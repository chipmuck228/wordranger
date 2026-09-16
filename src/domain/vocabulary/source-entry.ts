export type SourceParseStatus = "OK" | "REVIEW";

/**
 * Immutable PDF source facts. Canonical corrections must not mutate this.
 */
export interface VocabularySourceEntry {
  id: string;
  canonicalKey: string;
  sourceIndex: number;
  section: string | null;
  sourcePageStart: number;
  sourcePageEnd: number;
  sourceWordRaw: string;
  starred: boolean;
  sourceIpaRaw: string | null;
  sourcePosRaw: string | null;
  sourceMeaningRaw: string;
  rawEntry: string;
  parseStatus: SourceParseStatus;
  parseIssues: string[];
  sourceReviewNote: string | null;
}
