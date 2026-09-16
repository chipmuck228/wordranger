import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import {
  parseLexemeRelationProvenance,
  parseLexemeRelationType,
  type LexemeRelation,
} from "@/domain/vocabulary/lexeme-relation";
import type { LexemeTags } from "@/domain/vocabulary/lexeme-tags";
import { selectApprovedRelations } from "@/domain/vocabulary/relation-policy";
import {
  DEFAULT_VOCABULARY_CONTENT_POLICY,
  type VocabularyContentPolicy,
} from "@/domain/vocabulary/vocabulary-content-policy";
import type {
  GetRelationsOptions,
  VocabularyRepository,
} from "@/domain/vocabulary/vocabulary-repository";

interface LexemeRow {
  id: string;
  canonical_key: string;
  source_entry_id: string;
  source_index: number;
  lemma: string;
  display: string;
  role: Lexeme["role"];
  starred: boolean;
  parts_of_speech: string[];
  ipa: string[];
  meanings_zh: string[];
  forms: string[];
  variants: string[];
  abbreviation_of_lexeme_id: string | null;
  quality_status: Lexeme["quality"]["status"];
  quality_issues: string[];
  correction_applied: boolean;
  correction_note: string | null;
}

interface RelationRow {
  id: string;
  canonical_key: string;
  type: string;
  from_lexeme_id: string;
  to_lexeme_id: string;
  is_symmetric: boolean;
  confidence: number;
  provenance: string;
  note: string | null;
}

interface TagRow {
  lexeme_id: string;
  topics: string[];
  semantic_categories: string[];
  game_tags: string[];
  topic_confidence: number | null;
  semantic_confidence: number | null;
  game_confidence: number | null;
}

function mapLexeme(row: LexemeRow): Lexeme {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    sourceEntryId: row.source_entry_id,
    sourceIndex: row.source_index,
    lemma: row.lemma,
    display: row.display,
    role: row.role,
    starred: row.starred,
    partsOfSpeech: row.parts_of_speech,
    ipa: row.ipa,
    meaningsZh: row.meanings_zh,
    forms: row.forms,
    variants: row.variants,
    abbreviationOfLexemeId: row.abbreviation_of_lexeme_id,
    quality: {
      status: row.quality_status,
      issues: row.quality_issues ?? [],
      correctionApplied: row.correction_applied,
      correctionNote: row.correction_note,
    },
  };
}

function mapRelation(row: RelationRow): LexemeRelation {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    type: parseLexemeRelationType(row.type),
    fromLexemeId: row.from_lexeme_id,
    toLexemeId: row.to_lexeme_id,
    symmetric: row.is_symmetric,
    confidence: Number(row.confidence),
    provenance: parseLexemeRelationProvenance(row.provenance),
    note: row.note,
  };
}

export class SupabaseVocabularyRepository implements VocabularyRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly policy: VocabularyContentPolicy = DEFAULT_VOCABULARY_CONTENT_POLICY,
  ) {}

  async getLexeme(lexemeId: string): Promise<Lexeme | null> {
    const { data, error } = await this.client
      .from("lexemes")
      .select("*")
      .eq("id", lexemeId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? mapLexeme(data as LexemeRow) : null;
  }

  async getLexemes(lexemeIds: string[]): Promise<Lexeme[]> {
    if (lexemeIds.length === 0) {
      return [];
    }
    const { data, error } = await this.client
      .from("lexemes")
      .select("*")
      .in("id", lexemeIds);
    if (error) {
      throw error;
    }
    return ((data ?? []) as LexemeRow[]).map(mapLexeme);
  }

  async findLexemeByLemma(lemma: string): Promise<Lexeme[]> {
    const { data, error } = await this.client
      .from("lexemes")
      .select("*")
      .ilike("lemma", lemma);
    if (error) {
      throw error;
    }
    return ((data ?? []) as LexemeRow[]).map(mapLexeme);
  }

  async listLexemes(): Promise<Lexeme[]> {
    const { data, error } = await this.client.from("lexemes").select("*");
    if (error) {
      throw error;
    }
    return ((data ?? []) as LexemeRow[]).map(mapLexeme);
  }

  async getRelations(
    lexemeId: string,
    options: GetRelationsOptions = {},
  ): Promise<LexemeRelation[]> {
    const { data, error } = await this.client
      .from("lexeme_relations")
      .select("*")
      .or(`from_lexeme_id.eq.${lexemeId},to_lexeme_id.eq.${lexemeId}`);
    if (error) {
      throw error;
    }
    const mapped = ((data ?? []) as RelationRow[])
      .map(mapRelation)
      .filter((relation) => {
        if (
          relation.toLexemeId === lexemeId &&
          relation.fromLexemeId !== lexemeId &&
          !relation.symmetric
        ) {
          return false;
        }
        return true;
      });
    return selectApprovedRelations(mapped, this.policy, options);
  }

  async getTags(lexemeId: string): Promise<LexemeTags | null> {
    const { data, error } = await this.client
      .from("lexeme_tags")
      .select("*")
      .eq("lexeme_id", lexemeId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const row = data as TagRow;
    return {
      lexemeId: row.lexeme_id,
      topics: row.topics,
      semanticCategories: row.semantic_categories,
      gameTags: row.game_tags,
      topicConfidence: Number(row.topic_confidence ?? 0),
      semanticConfidence: Number(row.semantic_confidence ?? 0),
      gameConfidence: Number(row.game_confidence ?? 0),
    };
  }
}
