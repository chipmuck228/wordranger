"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VocabularyDebugSnapshot } from "@/server/vocabulary/debug-view";

export function VocabularyDebugLab({
  snapshot,
}: {
  snapshot: VocabularyDebugSnapshot;
}) {
  const [query, setQuery] = useState("quiet");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return snapshot.lexemes.slice(0, 8);
    }
    return snapshot.lexemes
      .filter(
        (lexeme) =>
          lexeme.lemma.toLowerCase().includes(needle) ||
          lexeme.display.toLowerCase().includes(needle) ||
          lexeme.canonicalKey.toLowerCase().includes(needle),
      )
      .slice(0, 20);
  }, [query, snapshot.lexemes]);
  const selected = matches[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Vocabulary Debug Lab</h1>
        <p className="text-muted-foreground text-sm">
          Inspect source entries, canonical lexemes, relations, and tags. This
          is not a student UI.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Source entries" value={snapshot.sourceEntryCount} />
        <Stat label="Lexemes" value={snapshot.lexemeCount} />
        <Stat label="Relations" value={snapshot.relationCount} />
        <Stat label="Tagged lexemes" value={snapshot.tagCount} />
        <Stat label="QA issues" value={snapshot.qaIssueCount} />
        <Stat
          label="Rejected by production policy"
          value={snapshot.rejectedRelationCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relation inventory</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <CountList title="Types" counts={snapshot.relationTypeCounts} />
          <CountList title="Provenance" counts={snapshot.provenanceCounts} />
        </CardContent>
      </Card>

      {snapshot.qaIssues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>QA errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {snapshot.qaIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">QA reported no errors.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="search">Search Lexeme</Label>
        <Input
          id="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="quiet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Matches</CardTitle>
            <CardDescription>{matches.length} shown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {matches.map((lexeme) => (
              <button
                key={lexeme.id}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selected?.id === lexeme.id ? "bg-muted" : ""
                }`}
                onClick={() => setQuery(lexeme.lemma)}
              >
                <div className="font-medium">{lexeme.lemma}</div>
                <div className="text-muted-foreground">
                  #{lexeme.sourceIndex} · {lexeme.canonicalKey}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.lemma}</CardTitle>
              <CardDescription>{selected.canonicalKey}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>display {selected.display}</div>
              <div>IPA {selected.ipa.join(" / ") || "—"}</div>
              <div>POS {selected.partsOfSpeech.join(", ") || "—"}</div>
              <div>meaning {selected.meaningsZh.join("；") || "—"}</div>
              <div>
                sourceIndex {selected.sourceIndex} · {selected.sourceWordRaw}
              </div>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {selected.rawEntry || "(no raw entry)"}
              </pre>
              <div>
                <div className="mb-1 font-medium">Relations</div>
                {selected.relations.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  selected.relations.map((relation, index) => (
                    <div key={`${relation.otherLexemeId}-${index}`}>
                      {selected.lemma} → {relation.type} → {relation.otherLemma}{" "}
                      <Badge variant={relation.productionUsable ? "secondary" : "outline"}>
                        {relation.provenance} {relation.confidence}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div className="mb-1 font-medium">Tags</div>
                <div>topics {(selected.tags?.topics ?? []).join(", ") || "—"}</div>
                <div>
                  semantic{" "}
                  {(selected.tags?.semanticCategories ?? []).join(", ") || "—"}
                </div>
                <div>
                  game tags {(selected.tags?.gameTags ?? []).join(", ") || "—"}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">No matching lexeme.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CountList({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}) {
  return (
    <div>
      <div className="mb-2 font-medium">{title}</div>
      <div className="space-y-1">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4">
            <span>{key}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
