import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectLearnerLexicalForm } from "@/contextual-learning/candidate-v0/content/project-learner-lexical-form";

type CanonicalLexeme = {
  id: string;
  lemma: string;
  display: string;
};

const ANNOTATION = /[()（）/／=]|pl\.|过去|复数|AmE/;

describe("annotated vocabulary audit", () => {
  it("classifies source notes and keeps unprojectable forms BLOCKED", () => {
    const dataset = JSON.parse(
      readFileSync("data/vocabulary/canonical/words-canonical.json", "utf8"),
    ) as { lexemes: CanonicalLexeme[] };
    const annotated = dataset.lexemes.filter(
      (lexeme) => ANNOTATION.test(lexeme.lemma) || ANNOTATION.test(lexeme.display),
    );
    const projectable = annotated.filter((lexeme) => projectLearnerLexicalForm(lexeme).ok);
    const blocked = annotated.filter((lexeme) => !projectLearnerLexicalForm(lexeme).ok);

    expect(annotated.length).toBeGreaterThan(20);
    expect(projectable.some((lexeme) => lexeme.id === "lex-0747-1")).toBe(true);
    expect(
      projectable.every((lexeme) => /\(\s*pl\.?\s*[A-Za-z-]+/i.test(lexeme.lemma)),
    ).toBe(true);
    expect(blocked.some((lexeme) => lexeme.lemma.includes("/"))).toBe(true);
    expect(blocked.some((lexeme) => lexeme.lemma.includes("="))).toBe(true);
    expect(blocked.some((lexeme) => /过去/.test(lexeme.lemma))).toBe(true);
    expect(blocked.map((lexeme) => lexeme.lemma)).toContain("email/e-mail");
    expect(blocked.map((lexeme) => lexeme.lemma)).toContain("would (will的过去时)");

    const parentheses = annotated.filter((lexeme) => /[()（）]/.test(lexeme.lemma));
    const slashes = annotated.filter((lexeme) => /[/／]/.test(lexeme.lemma));
    const spaces = annotated.filter((lexeme) => /\s/.test(lexeme.lemma));
    const pluralNotes = annotated.filter((lexeme) => /pl\.|复数/.test(lexeme.lemma));
    const pastNotes = annotated.filter((lexeme) => /过去/.test(lexeme.lemma));
    expect(parentheses.length).toBeGreaterThan(0);
    expect(slashes.length).toBeGreaterThan(0);
    expect(spaces.length).toBeGreaterThan(0);
    expect(pluralNotes.some((lexeme) => lexeme.id === "lex-0747-1")).toBe(true);
    expect(pastNotes.length).toBeGreaterThan(0);
    expect(slashes.every((lexeme) => !projectLearnerLexicalForm(lexeme).ok)).toBe(true);
    expect(pastNotes.every((lexeme) => !projectLearnerLexicalForm(lexeme).ok)).toBe(true);
  });
});
