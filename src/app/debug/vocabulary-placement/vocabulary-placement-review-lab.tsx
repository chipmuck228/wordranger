"use client";

import { useMemo, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PlacementReviewRow,
  PlacementReviewSnapshot,
  PlacementReviewStatusFilter,
} from "@/server/vocabulary/placement-review-snapshot";
import { filterPlacementReviewRows } from "./filter-rows";
import { saveVocabularyPlacementReview } from "./actions";

const PAGE_SIZE = 20;

export function VocabularyPlacementReviewLab({
  snapshot,
}: {
  snapshot: PlacementReviewSnapshot;
}) {
  const [rows, setRows] = useState(snapshot.rows);
  const [coverage, setCoverage] = useState(snapshot.coverage);
  const [query, setQuery] = useState("");
  const [provisionalBand, setProvisionalBand] = useState("");
  const [effectiveBand, setEffectiveBand] = useState("");
  const [reviewStatus, setReviewStatus] =
    useState<PlacementReviewStatusFilter>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    snapshot.rows[0]?.lexemeId ?? null,
  );
  const [draftBand, setDraftBand] = useState(
    snapshot.rows[0]?.effectiveBand ?? snapshot.bands[0]?.id ?? "BAND_1",
  );
  const [draftNote, setDraftNote] = useState(snapshot.rows[0]?.reviewNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      filterPlacementReviewRows(rows, {
        query,
        provisionalBand: provisionalBand || undefined,
        effectiveBand: effectiveBand || undefined,
        reviewStatus,
      }),
    [rows, query, provisionalBand, effectiveBand, reviewStatus],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const selected =
    filtered.find((row) => row.lexemeId === selectedId) ?? pageRows[0] ?? null;

  function selectRow(row: PlacementReviewRow) {
    setSelectedId(row.lexemeId);
    setDraftBand(row.effectiveBand);
    setDraftNote(row.reviewNote ?? "");
    setError(null);
  }

  function save(moveNext: boolean) {
    if (!selected) {
      return;
    }
    const lexemeId = selected.lexemeId;
    const bandId = draftBand;
    const reviewNote = draftNote;
    startTransition(async () => {
      const result = await saveVocabularyPlacementReview({
        lexemeId,
        bandId,
        reviewNote,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      const updatedRows = rows.map((row) => {
        if (row.lexemeId !== lexemeId) {
          return row;
        }
        return {
          ...row,
          curatedBand: result.record.bandId,
          effectiveBand: result.record.bandId,
          origin: "CURATED" as const,
          provenance: [...result.record.provenance],
          reviewed: true,
          reviewNote: result.record.reviewNote ?? null,
          reviewedAt: result.record.reviewedAt,
        };
      });
      setRows(updatedRows);
      const reviewedCount = updatedRows.filter((row) => row.reviewed).length;
      const reviewedBandCounts: Record<string, number> = {};
      for (const band of snapshot.bands) {
        reviewedBandCounts[band.id] = 0;
      }
      for (const row of updatedRows) {
        if (row.curatedBand) {
          reviewedBandCounts[row.curatedBand] =
            (reviewedBandCounts[row.curatedBand] ?? 0) + 1;
        }
      }
      setCoverage({
        totalLexemes: updatedRows.length,
        provisionalCount: updatedRows.length,
        reviewedCount,
        unreviewedCount: Math.max(0, updatedRows.length - reviewedCount),
        reviewedCoverage:
          updatedRows.length === 0 ? 0 : reviewedCount / updatedRows.length,
        reviewedBandCounts,
      });
      if (moveNext) {
        const remaining = filterPlacementReviewRows(updatedRows, {
          query,
          provisionalBand: provisionalBand || undefined,
          effectiveBand: effectiveBand || undefined,
          reviewStatus,
        });
        const currentIndex = remaining.findIndex((row) => row.lexemeId === lexemeId);
        const nextRow = remaining[currentIndex + 1] ?? remaining[currentIndex];
        if (nextRow) {
          selectRow(nextRow);
        }
      } else {
        const updated = updatedRows.find((row) => row.lexemeId === lexemeId);
        if (updated) {
          selectRow(updated);
        }
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const typing =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT";
    if (typing) {
      return;
    }
    if (event.key >= "1" && event.key <= "6") {
      const band = snapshot.bands[Number(event.key) - 1];
      if (band) {
        event.preventDefault();
        setDraftBand(band.id);
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      save(true);
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6"
      onKeyDown={onKeyDown}
    >
      <div>
        <h1 className="text-2xl font-semibold">Vocabulary Placement Review</h1>
        <p className="text-muted-foreground text-sm">
          Internal review of provisional BAND_1–BAND_6 suggestions. Saving writes a
          CURATED override without changing learner state or production scheduling.
          This page is not authorization; writes need PLACEMENT_REVIEW_WRITE_ENABLED=1.
        </p>
        {snapshot.loadError ? (
          <p className="text-destructive mt-2 text-sm" data-testid="review-load-error">
            {snapshot.loadError}
          </p>
        ) : null}
        {snapshot.runtime && !snapshot.runtime.placementReviewWritesEnabled ? (
          <p className="text-muted-foreground mt-2 text-sm" data-testid="review-writes-disabled">
            Review writes are disabled. Read-only inspection is available.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total lexemes" value={coverage.totalLexemes} />
        <Stat label="Provisional" value={coverage.provisionalCount} />
        <Stat label="Reviewed" value={coverage.reviewedCount} />
        <Stat
          label="Reviewed coverage"
          value={`${(coverage.reviewedCoverage * 100).toFixed(2)}%`}
        />
        <Stat label="Unreviewed" value={coverage.unreviewedCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search lemma, canonical key, Chinese meaning, or UUID. 1–6 assigns a
            band; Enter saves and advances when the list is focused.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="placement-search">Search</Label>
            <Input
              id="placement-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
          <BandFilter
            id="provisional-band-filter"
            label="Provisional band"
            value={provisionalBand}
            bands={snapshot.bands.map((band) => band.id)}
            onChange={(value) => {
              setProvisionalBand(value);
              setPage(0);
            }}
          />
          <BandFilter
            id="effective-band-filter"
            label="Effective band"
            value={effectiveBand}
            bands={snapshot.bands.map((band) => band.id)}
            onChange={(value) => {
              setEffectiveBand(value);
              setPage(0);
            }}
          />
          <div className="space-y-1">
            <Label htmlFor="review-status-filter">Review status</Label>
            <select
              id="review-status-filter"
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
              value={reviewStatus}
              onChange={(event) => {
                setReviewStatus(event.target.value as PlacementReviewStatusFilter);
                setPage(0);
              }}
            >
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed only</option>
              <option value="reviewed">Reviewed only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Lexemes</CardTitle>
            <CardDescription>
              {filtered.length} matching · page {safePage + 1} / {pageCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous page
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((value) => value + 1)}
              >
                Next page
              </Button>
            </div>
            <ul className="divide-border max-h-[32rem] overflow-auto rounded-lg border">
              {pageRows.map((row) => (
                <li key={row.lexemeId}>
                  <button
                    type="button"
                    className={`hover:bg-muted flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                      selected?.lexemeId === row.lexemeId ? "bg-muted" : ""
                    }`}
                    onClick={() => selectRow(row)}
                    data-reviewed={row.reviewed ? "true" : "false"}
                  >
                    <span className="font-medium">{row.lemma}</span>
                    <span className="text-muted-foreground text-xs">
                      {row.canonicalKey} · {row.effectiveBand} ·{" "}
                      {row.reviewed ? "REVIEWED" : "unreviewed"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>{selected.canonicalKey}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xl font-semibold" data-testid="review-lemma">
                  {selected.lemma}
                </div>
                <div className="text-muted-foreground">{selected.display}</div>
              </div>
              <div data-testid="review-meanings">
                {selected.meaningsZh.join("；") || "—"}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">POS {selected.partsOfSpeech.join(", ") || "—"}</Badge>
                <Badge variant="secondary">sourceIndex {selected.sourceIndex}</Badge>
                {selected.starred ? <Badge>starred</Badge> : null}
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <Field label="Provisional" testId="provisional-band">
                  {selected.provisionalBand}
                </Field>
                <Field label="Curated override" testId="curated-band">
                  {selected.curatedBand ?? "none"}
                </Field>
                <Field label="Effective" testId="effective-band">
                  {selected.effectiveBand}
                </Field>
                <Field label="Status" testId="review-status">
                  {selected.reviewed ? "REVIEWED" : "unreviewed"}
                </Field>
              </dl>
              <div>
                <div className="text-muted-foreground text-xs">Provenance</div>
                <div data-testid="review-provenance">
                  {selected.provenance.join(", ")}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Selected band</Label>
                <div className="flex flex-wrap gap-1">
                  {snapshot.bands.map((band) => (
                    <Button
                      key={band.id}
                      type="button"
                      size="sm"
                      variant={draftBand === band.id ? "default" : "outline"}
                      data-testid={`band-${band.id}`}
                      onClick={() => setDraftBand(band.id)}
                    >
                      {band.id}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="review-note">Review note</Label>
                <Textarea
                  id="review-note"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                />
              </div>
              {error ? (
                <p className="text-destructive text-sm" data-testid="review-error">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending || !selected}
                  onClick={() => save(false)}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || !selected}
                  onClick={() => save(true)}
                >
                  Save and next
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected}
                  onClick={() => {
                    const index = filtered.findIndex(
                      (row) => row.lexemeId === selected.lexemeId,
                    );
                    const previous = filtered[index - 1];
                    if (previous) {
                      selectRow(previous);
                    }
                  }}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected}
                  onClick={() => {
                    const index = filtered.findIndex(
                      (row) => row.lexemeId === selected.lexemeId,
                    );
                    const next = filtered[index + 1];
                    if (next) {
                      selectRow(next);
                    }
                  }}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-sm">
              No lexemes match these filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Field({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}

function BandFilter({
  id,
  label,
  value,
  bands,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  bands: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {bands.map((band) => (
          <option key={band} value={band}>
            {band}
          </option>
        ))}
      </select>
    </div>
  );
}
