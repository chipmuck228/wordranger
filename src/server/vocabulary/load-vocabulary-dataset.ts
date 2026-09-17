import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import {
  parseLexemeRelationProvenance,
  parseLexemeRelationType,
  type LexemeRelation,
} from "@/domain/vocabulary/lexeme-relation";
import type { LexemeTags } from "@/domain/vocabulary/lexeme-tags";
import { buildPlacementMetadata } from "@/domain/vocabulary/derive-placement-metadata";
import {
  parsePlacementMetadataSource,
  PLACEMENT_FIELD_NAMES,
  type PlacementField,
  type VocabularyPlacementMetadata,
} from "@/domain/vocabulary/placement-metadata";
import type { VocabularySourceEntry } from "@/domain/vocabulary/source-entry";
import {
  lexemeIdFromCanonicalKey,
  relationIdFromCanonicalKey,
  sourceCanonicalKey,
  sourceEntryId,
} from "@/lib/canonical-id";

export interface VocabularyDataset {
  sourceEntries: VocabularySourceEntry[];
  lexemes: Lexeme[];
  relations: LexemeRelation[];
  tags: LexemeTags[];
  placementMetadata?: VocabularyPlacementMetadata[];
  placementOverlay?: VocabularyPlacementMetadata[];
  meta: {
    sourceEntryCount: number;
    lexemeCount: number;
    relationCount: number;
    taggedLexemeCount: number;
    placementMetadataCount?: number;
  };
}

interface SourceFile {
  meta: { actualEntryCount: number; expectedEntryCount: number };
  records: Array<{
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
    parseStatus: "OK" | "REVIEW";
    parseIssues: string[];
    sourceReviewNote: string | null;
  }>;
}

interface CanonicalFile {
  meta: { sourceEntryCount: number; lexemeCount: number };
  lexemes: Array<{
    id: string;
    sourceIndex: number;
    lemma: string;
    display: string;
    role: "primary" | "variant_or_expansion";
    starred: boolean;
    partOfSpeech: string[];
    ipa: string[];
    meaningsZh: string[];
    forms: string[];
    variants: string[];
    abbreviationOf: string | null;
    quality: Lexeme["quality"];
  }>;
}

interface RelationFileItem {
  id: string;
  type: string;
  fromLexemeId: string;
  toLexemeId: string;
  symmetric: boolean;
  confidence: number;
  provenance: string;
  note: string | null;
}

interface TagFileItem {
  lexemeId: string;
  topics: string[];
  semanticCategories: string[];
  gameTags: string[];
  confidence: {
    topics: number;
    semanticCategories: number;
    gameTags: number;
  };
}

interface OverlayFile {
  meta?: { recordCount?: number };
  records: OverlayFileRecord[];
}

interface OverlayFileRecord {
  lexemeId: string;
  alphabeticalSection?: OverlayField;
  starred?: OverlayField;
  functionWord?: OverlayField;
  curriculumBand?: OverlayField;
  gradeBand?: OverlayField;
  frequencyBand?: OverlayField;
  difficultyBand?: OverlayField;
}

interface OverlayField {
  value: unknown;
  source: string;
  provenance: string[];
  confidence?: number;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function defaultVocabularyDataRoot(
  cwd = process.cwd(),
): string {
  return path.join(cwd, "data", "vocabulary");
}

export function loadVocabularyDataset(
  dataRoot = defaultVocabularyDataRoot(),
): VocabularyDataset {
  const sourceFile = readJson<SourceFile>(
    path.join(dataRoot, "source", "words-source.json"),
  );
  const canonicalFile = readJson<CanonicalFile>(
    path.join(dataRoot, "canonical", "words-canonical.json"),
  );
  const relationFile = readJson<RelationFileItem[]>(
    path.join(dataRoot, "enrichment", "word-relations.json"),
  );
  const tagFile = readJson<TagFileItem[]>(
    path.join(dataRoot, "enrichment", "word-tags.json"),
  );
  const overlayPath = path.join(dataRoot, "enrichment", "word-placement.json");
  const overlayFile = existsSync(overlayPath)
    ? readJson<OverlayFile>(overlayPath)
    : { records: [] };

  const sourceEntries = sourceFile.records.map((record) => {
    const canonicalKey = sourceCanonicalKey(record.sourceIndex);
    return {
      id: sourceEntryId(record.sourceIndex),
      canonicalKey,
      sourceIndex: record.sourceIndex,
      section: record.section,
      sourcePageStart: record.sourcePageStart,
      sourcePageEnd: record.sourcePageEnd,
      sourceWordRaw: record.sourceWordRaw,
      starred: record.starred,
      sourceIpaRaw: record.sourceIpaRaw,
      sourcePosRaw: record.sourcePosRaw,
      sourceMeaningRaw: record.sourceMeaningRaw,
      rawEntry: record.rawEntry,
      parseStatus: record.parseStatus,
      parseIssues: record.parseIssues,
      sourceReviewNote: record.sourceReviewNote,
    };
  });

  const sourceByIndex = new Map(
    sourceEntries.map((entry) => [entry.sourceIndex, entry]),
  );

  const abbreviationOfLemmaByCanonical = new Map<string, string>();
  const lexemesWithoutAbbrev = canonicalFile.lexemes.map((record) => {
    const source = sourceByIndex.get(record.sourceIndex);
    if (!source) {
      throw new Error(
        `Lexeme ${record.id} references missing source index ${record.sourceIndex}`,
      );
    }
    if (record.abbreviationOf) {
      abbreviationOfLemmaByCanonical.set(record.id, record.abbreviationOf);
    }
    return {
      id: lexemeIdFromCanonicalKey(record.id),
      canonicalKey: record.id,
      sourceEntryId: source.id,
      sourceIndex: record.sourceIndex,
      lemma: record.lemma,
      display: record.display,
      role: record.role,
      starred: record.starred,
      partsOfSpeech: record.partOfSpeech,
      ipa: record.ipa,
      meaningsZh: record.meaningsZh,
      forms: record.forms,
      variants: record.variants,
      abbreviationOfLexemeId: null as string | null,
      quality: record.quality,
    };
  });

  const lexemesByCanonical = new Map(
    lexemesWithoutAbbrev.map((lexeme) => [lexeme.canonicalKey, lexeme]),
  );
  const lexemesByLemma = new Map<string, typeof lexemesWithoutAbbrev>();
  for (const lexeme of lexemesWithoutAbbrev) {
    const list = lexemesByLemma.get(lexeme.lemma) ?? [];
    list.push(lexeme);
    lexemesByLemma.set(lexeme.lemma, list);
  }

  const lexemes: Lexeme[] = lexemesWithoutAbbrev.map((lexeme) => {
    const abbreviationOfLemma = abbreviationOfLemmaByCanonical.get(
      lexeme.canonicalKey,
    );
    let abbreviationOfLexemeId: string | null = null;
    if (abbreviationOfLemma) {
      const matches = lexemesByLemma.get(abbreviationOfLemma) ?? [];
      abbreviationOfLexemeId = matches[0]?.id ?? null;
    }
    return { ...lexeme, abbreviationOfLexemeId };
  });

  const relations: LexemeRelation[] = relationFile.map((record) => {
    const from = lexemesByCanonical.get(record.fromLexemeId);
    const to = lexemesByCanonical.get(record.toLexemeId);
    if (!from || !to) {
      throw new Error(
        `Relation ${record.id} points at missing lexeme ${record.fromLexemeId} -> ${record.toLexemeId}`,
      );
    }
    return {
      id: relationIdFromCanonicalKey(record.id),
      canonicalKey: record.id,
      type: parseLexemeRelationType(record.type),
      fromLexemeId: from.id,
      toLexemeId: to.id,
      symmetric: record.symmetric,
      confidence: record.confidence,
      provenance: parseLexemeRelationProvenance(record.provenance),
      note: record.note,
    };
  });

  const tags: LexemeTags[] = tagFile.map((record) => {
    const lexeme = lexemesByCanonical.get(record.lexemeId);
    if (!lexeme) {
      throw new Error(`Tag record points at missing lexeme ${record.lexemeId}`);
    }
    return {
      lexemeId: lexeme.id,
      topics: record.topics,
      semanticCategories: record.semanticCategories,
      gameTags: record.gameTags,
      topicConfidence: record.confidence.topics,
      semanticConfidence: record.confidence.semanticCategories,
      gameConfidence: record.confidence.gameTags,
    };
  });

  const placementOverlay = overlayFile.records.map((record) =>
    mapOverlayRecord(record, lexemesByCanonical),
  );
  const placementMetadata = buildPlacementMetadata(
    lexemes,
    sourceEntries,
    placementOverlay,
  );

  return {
    sourceEntries,
    lexemes,
    relations,
    tags,
    placementMetadata,
    placementOverlay,
    meta: {
      sourceEntryCount: sourceFile.meta.actualEntryCount,
      lexemeCount: canonicalFile.meta.lexemeCount,
      relationCount: relations.length,
      taggedLexemeCount: tags.length,
      placementMetadataCount: placementMetadata.length,
    },
  };
}

function mapOverlayRecord(
  record: OverlayFileRecord,
  lexemesByCanonical: Map<string, Lexeme>,
): VocabularyPlacementMetadata {
  const lexeme = lexemesByCanonical.get(record.lexemeId);
  const mapped: VocabularyPlacementMetadata = {
    lexemeId: lexeme?.id ?? record.lexemeId,
  };
  for (const name of PLACEMENT_FIELD_NAMES) {
    const raw = record[name];
    if (!raw) {
      continue;
    }
    mapped[name] = mapOverlayField(raw) as never;
  }
  const allowed = new Set<string>(["lexemeId", ...PLACEMENT_FIELD_NAMES]);
  const extras = record as unknown as Record<string, unknown>;
  const target = mapped as unknown as Record<string, unknown>;
  for (const key of Object.keys(extras)) {
    if (!allowed.has(key)) {
      target[key] = extras[key];
    }
  }
  return mapped;
}

function mapOverlayField(raw: OverlayField): PlacementField<unknown> {
  const field: PlacementField<unknown> = {
    value: raw.value,
    source: parsePlacementMetadataSource(raw.source),
    provenance: [...(raw.provenance ?? [])],
  };
  if (raw.confidence !== undefined) {
    field.confidence = raw.confidence;
  }
  return field;
}
