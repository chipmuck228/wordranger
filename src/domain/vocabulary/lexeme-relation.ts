export enum LexemeRelationType {
  VARIANT = "VARIANT",
  ABBREVIATION = "ABBREVIATION",
  SYNONYM = "SYNONYM",
  ANTONYM = "ANTONYM",
  WORD_FAMILY = "WORD_FAMILY",
  CONFUSABLE = "CONFUSABLE",
}

export type LexemeRelationProvenance =
  | "source_structural"
  | "curated_model"
  | "rule_inferred";

export interface LexemeRelation {
  id: string;
  canonicalKey: string;
  type: LexemeRelationType;
  fromLexemeId: string;
  toLexemeId: string;
  symmetric: boolean;
  confidence: number;
  provenance: LexemeRelationProvenance;
  note: string | null;
}

export function parseLexemeRelationType(value: string): LexemeRelationType {
  switch (value) {
    case "variant":
    case "VARIANT":
      return LexemeRelationType.VARIANT;
    case "abbreviation":
    case "ABBREVIATION":
      return LexemeRelationType.ABBREVIATION;
    case "synonym":
    case "SYNONYM":
      return LexemeRelationType.SYNONYM;
    case "antonym":
    case "ANTONYM":
      return LexemeRelationType.ANTONYM;
    case "word_family":
    case "WORD_FAMILY":
      return LexemeRelationType.WORD_FAMILY;
    case "confusable":
    case "CONFUSABLE":
      return LexemeRelationType.CONFUSABLE;
    default:
      throw new Error(`Unknown lexeme relation type: ${value}`);
  }
}

export function parseLexemeRelationProvenance(
  value: string,
): LexemeRelationProvenance {
  if (
    value === "source_structural" ||
    value === "curated_model" ||
    value === "rule_inferred"
  ) {
    return value;
  }
  throw new Error(`Unknown relation provenance: ${value}`);
}
