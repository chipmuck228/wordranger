import type { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";

export type TaskPrompt =
  | {
      kind: "LEXEME_TEXT";
      text: string;
    }
  | {
      kind: "MEANING_TEXT";
      text: string;
    }
  | {
      kind: "RELATION";
      sourceText: string;
      relationType: LexemeRelationType;
    };

export interface PublicTaskOption {
  id: string;
  content: {
    kind: "TEXT";
    text: string;
  };
}

export type TaskResponseContract =
  | {
      kind: "CHOICE";
      options: PublicTaskOption[];
    }
  | {
      kind: "TEXT_INPUT";
      placeholder?: string;
      maxLength: number;
    };

export interface PublicTaskHint {
  id: string;
  text: string;
}
