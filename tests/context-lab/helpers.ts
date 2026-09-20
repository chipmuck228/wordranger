export const FORBIDDEN_CLIENT_FIELDS = [
  "answerKey",
  "correctOptionIds",
  "expectedAnswer",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "isCorrect",
  "LearningEvidence",
  "StudentLexemeModel",
] as const;

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

export function serializedContains(value: unknown, needle: string): boolean {
  return JSON.stringify(value).includes(needle);
}
