export type LexemeRole = "primary" | "variant_or_expansion";
export type CanonicalQualityStatus = "normalized" | "corrected";

export interface LexemeQuality {
  status: CanonicalQualityStatus;
  issues: string[];
  correctionApplied: boolean;
  correctionNote: string | null;
}

/**
 * Canonical trainable vocabulary unit. Contains no student mastery state.
 */
export interface Lexeme {
  id: string;
  canonicalKey: string;
  sourceEntryId: string;
  /**
   * PDF/source numbered order. Not difficulty, grade, CEFR, frequency, or mastery.
   */
  sourceIndex: number;
  lemma: string;
  display: string;
  role: LexemeRole;
  starred: boolean;
  partsOfSpeech: string[];
  ipa: string[];
  meaningsZh: string[];
  forms: string[];
  variants: string[];
  abbreviationOfLexemeId: string | null;
  quality: LexemeQuality;
}
