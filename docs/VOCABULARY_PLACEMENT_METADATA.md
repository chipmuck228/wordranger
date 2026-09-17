# Vocabulary Placement Metadata

Evidence-backed curriculum / placement metadata for the junior-high 1600-word list. This is **Vocabulary Domain reference data**, not learner state.

This document is not Adaptive Placement. Scheduler, Daily Training, `StudentLexemeModel`, and `LearningEvidence` do not consume these fields yet.

Status: **PLACEMENT_METADATA_INCOMPLETE**. The schema and provenance rules exist. There is not enough reliable data to drive fast placement.

---

## AVAILABLE NOW

All placement records are keyed by **`lexemeId`** (canonical trainable unit), never by source entry. One PDF line that splits into two lexemes (`actor` / `actress`) yields two metadata rows.

| Field | Value | Provenance | Classification | Notes |
| --- | --- | --- | --- | --- |
| `alphabeticalSection` | PDF letter `A`–`Z` | `SOURCE` / `pdf.section` | SOURCE_FACT | Alphabetical grouping of the printed list. **Not** a grade, unit, or semester. |
| `starred` | PDF starred marker (`Lexeme.starred`) | `SOURCE` / `pdf.starred` | SOURCE_FACT | The printed star, not curriculum foundation, difficulty, frequency, CEFR, or “must know first”. |
| `functionWord` | `true` / `false` when POS is classifiable | `INFERRED` / `canonical.partsOfSpeech` + `function-word-pos-rule/v1` | ENRICHED (rule) | Closed-class POS only. Absent when POS is empty, adverb-only, numeral, interjection, abbreviation, or linking verb. **Not** a skip-training flag and **not** mastery. |

`sourceIndex` remains on `Lexeme` as PDF numbered order. It is **not** a placement field and is **not** difficulty.

### Function-word rule `function-word-pos-rule/v1`

Deterministic over canonical `partsOfSpeech` (normalized from `sourcePosRaw`, not LLM):

- `true` if any POS is `article`, `preposition`, `conjunction`, `pronoun`, `auxiliary_verb`, or `modal_verb`
- `false` if every POS is `noun`, `adjective`, `verb`, `verb_transitive`, or `verb_intransitive`
- **absent** otherwise (do not guess)

Confidence is `0.8` when present. That number is a **heuristic label** (`FUNCTION_WORD_RULE_CONFIDENCE`), not an empirically calibrated accuracy. Source is always `INFERRED`. It must not be used as a production placement weight.

### Other existing vocabulary fields (not placement authority)

| Field | Layer | Classification | Placement use |
| --- | --- | --- | --- |
| `sourceIndex`, pages, raw word/IPA/POS/meaning, `starred`, `section` | Source JSON / `VocabularySourceEntry` | SOURCE_FACT | Order and print structure only |
| lemma, display, `partsOfSpeech`, meanings, forms | Canonical `Lexeme` | NORMALIZED | POS used only via the documented function-word rule |
| `LexemeRelation` (`WORD_FAMILY`, synonym, …) | Enrichment | ENRICHED; production uses `source_structural` / high-confidence `curated_model` | Word-graph, not curriculum order |
| `gameTags` | Enrichment | ENRICHED (`rule_derived`) | Data capability for task types, not placement |
| topics | Enrichment | ENRICHED and currently empty | None |

There is **no** textbook unit, grade/semester, CEFR, frequency rank, or pedagogical difficulty in the PDF or repo.

---

## NOT AVAILABLE

- Grade / semester / textbook unit bands
- CEFR or other externally validated proficiency bands
- Corpus frequency bands or ranks
- Pedagogical difficulty bands
- A true curriculum sequence (A–Z and `sourceIndex` are print order)

Optional overlay file `data/vocabulary/enrichment/word-placement.json` exists as a future extension point. It currently has **zero** curated/external records. Overlay field names match the schema (`starred`, not a semantic `coreFoundation`).

---

## UNSAFE TO INFER

Do not guess and then treat as truth:

- LLM “this word is easy/hard”
- CEFR from model output or from `sourceIndex`
- Grade level from alphabetical section (`A` is not easier than `S`)
- Frequency rank without a licensed corpus list
- “Starred ⇒ skip or mark mastered”
- “Function word ⇒ skip training”
- Using `sourceIndex` as NEW_WORD difficulty (Scheduler still uses it only as **source-list order**)

Inferred **band** fields (`curriculumBand`, `gradeBand`, `frequencyBand`, `difficultyBand`) are rejected by validation. Those keys may be filled later only with `CURATED` or `EXTERNAL_REFERENCE` provenance.

---

## FUTURE SOURCES NEEDED

For `READY_FOR_ADAPTIVE_PLACEMENT`, add at least one reviewed dataset, licensed and imported through the overlay (not scraped):

1. **Curriculum / grade map** for this exact 1600-word junior-high list (publisher scope-and-sequence, or a human-curated band per lexeme).
2. **External frequency bands** from a documented, licensed reference (for example a school-wordlist frequency layer), joined by lemma/`lexemeId` with provenance.
3. **Externally validated CEFR-like bands** from a licensed wordlist, matched conservatively (homographs stay unmatched rather than guessed).

Until those exist, placement must not skip bands, jump indexes, or treat function words as known.

---

## Repository

`VocabularyRepository.listPlacementMetadata()` returns the full derived list in one call. Game renderers must not query it. Scheduler v2 does not call it.
