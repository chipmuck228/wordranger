# Vocabulary Placement Metadata

Evidence-backed curriculum / placement metadata for the junior-high 1600-word list. This is **Vocabulary Domain reference data**, not learner state.

This document is not Adaptive Placement. Scheduler, Daily Training, `StudentLexemeModel`, and `LearningEvidence` do not consume placement fields for admission. Placement-aware NEW_WORD selection is blocked until production-authoritative bands exist.

Status: **PLACEMENT_METADATA_INCOMPLETE** / Phase 12 **PLACEMENT_DATA_BLOCKER**.

The schema and provenance rules exist. Production overlay `word-placement.json` has **zero** `CURATED` / `EXTERNAL_REFERENCE` band records. Adaptive placement is **not** implemented in Scheduler or Daily Training. `assessAdaptivePlacementReadiness()` returns `PLACEMENT_DATA_BLOCKER` and must not be bypassed with `sourceIndex`, A–Z sections, `starred`, or `functionWord`.

---

## AVAILABLE NOW

All placement records are keyed by **`lexemeId` = `Lexeme.id`** (the canonical trainable unit UUID), never by source entry and never by `canonicalKey`. `canonicalKey` is only a stable vocabulary identifier for normalization/debugging. One PDF line that splits into two lexemes (`actor` / `actress`) yields two metadata rows.

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

## Phase 12 — PLACEMENT_DATA_BLOCKER

Adaptive Placement was not shipped. Fake placement from print order would violate ADR-075 / ADR-077.

### Why current fields are insufficient

| Field | Why it cannot drive placement |
| --- | --- |
| `sourceIndex` | PDF numbered order. Later ≠ harder. |
| `alphabeticalSection` | Lemma A–Z grouping. `ability` is not a lower grade than `zoo`. |
| `starred` | Typographic PDF marker. Not easy, core, CEFR, or mastered. |
| `functionWord` | `INFERRED` POS heuristic. Must not skip training or write mastery. |

Production-authoritative placement requires `source == CURATED` or `source == EXTERNAL_REFERENCE` on a **single** primary band axis.

### Minimum dataset required

1. One primary axis, in this order if complete enough: `curriculumBand`, else `gradeBand`, else `difficultyBand` / `frequencyBand`.
2. At least **3** distinct ordered bands on that axis.
3. Coverage of **≥ 80%** of canonical lexemes (1638), keyed by `lexemeId` (not source entry).
4. Licensed or human-reviewed provenance on every band field. No LLM-inferred CEFR/difficulty.
5. Enough lexemes per band to sample 6–12 Daily Training probes without fabricating Evidence or marking untested words mastered.

Gate constants: `MIN_AUTHORITATIVE_PLACEMENT_BANDS = 3`, `MIN_AUTHORITATIVE_PLACEMENT_COVERAGE = 0.8`.

### Recommended overlay shape

`data/vocabulary/enrichment/word-placement.json` (do not invent values until a real source exists):

```json
{
  "meta": {
    "primaryAxis": "curriculumBand",
    "recordCount": 1638
  },
  "records": [
    {
      "lexemeId": "lex-0001-1",
      "curriculumBand": {
        "value": "FOUNDATION",
        "source": "CURATED",
        "provenance": ["publisher-scope-and-sequence:junior-high-1600/v1"],
        "confidence": 1
      }
    }
  ]
}
```

Band string values must come from the reviewed source. `FOUNDATION` / `MIDDLE` / `ADVANCED` are test-fixture names only; do not write them into production overlay as guessed labels.

Until this overlay is populated and the readiness gate returns `READY`, Daily Training NEW_WORD admission stays source-list order. Untested words remain `UNSEEN`. No fake Evidence.

---

## Provisional review bands (scaffolding)

`data/vocabulary/placement/` holds a **non-authoritative** review layer:

| File | Role |
| --- | --- |
| `provisional-band-definition.json` | Explicit ordered `BAND_1`…`BAND_6`. Consumers must use `order`, never alphabetical ID sort. |
| `provisional-word-placement.json` | One INFERRED assignment per canonical lexeme, keyed by `Lexeme.id`, generated by `npm run generate:provisional-placement`. |
| `curated-word-placement.json` | Sparse human-reviewed CURATED overrides, keyed by `Lexeme.id`. Separate from the provisional artifact. |

These buckets are **not** grade, CEFR, frequency, pedagogical difficulty, or mastery. Labels are intentionally neutral. `sourceIndex` is used only as a stable sort key for a round-robin partition (`balanced-source-index-round-robin/v1`); it is not exposed as difficulty.

Provenance is `INFERRED` with `wordranger-provisional-band-generator/v1`. Records are **not** written onto production `curriculumBand` / `gradeBand` / `difficultyBand` / `frequencyBand`, so they cannot satisfy `assessAdaptivePlacementReadiness()`.

Human review stores **CURATED** overrides in `curated-word-placement.json` without rewriting the provisional file. Effective placement is curated override if present, else the provisional suggestion. Agreeing with the provisional band still writes an explicit CURATED record. Scheduler and Daily Training still do not consume this layer. Production Adaptive Placement remains `PLACEMENT_DATA_BLOCKER` until a later step decides these human-reviewed `BAND_*` values are sufficient production authority.

Internal review UI: `/debug/vocabulary-placement`. This is local/internal tooling, not a student route, and must not appear in student navigation. File-backed curated writes are allowed for local/internal tooling via `CuratedPlacementStore`; they are **not** production-deployment persistence. A read-only deploy filesystem may return `CURATED_PLACEMENT_WRITE_UNAVAILABLE`. Later production review persistence can swap behind the same `CuratedPlacementStore` interface; do not treat the bundled JSON file as the deployed write store.

---

## Repository

`VocabularyRepository.listPlacementMetadata()` returns the full derived list in one call. Game renderers must not query it. Scheduler v2 does not call it.

Provisional review buckets and curated overrides are a separate `VocabularyPlacementProvider` (`listProvisionalPlacements()`, `listCuratedOverrides()`, `listEffectivePlacements()`). Daily Training and Scheduler must not call it. Curated metadata changes never rewrite Evidence or `StudentLexemeModel`.
