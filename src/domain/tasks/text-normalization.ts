import type { TaskEvaluationPolicy } from "./task-evaluation-policy";

export function normalizeStudentText(
  value: string,
  policy: TaskEvaluationPolicy,
): string {
  let text = value.normalize("NFKC");
  if (policy.textNormalization.trimWhitespace) {
    text = text.trim();
  }
  if (policy.textNormalization.caseInsensitive) {
    text = text.toLocaleLowerCase("en");
  }
  return text;
}

export function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, row) => {
    const line = Array.from({ length: cols }, (__, col) =>
      row === 0 ? col : col === 0 ? row : 0,
    );
    return line;
  });
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }
  return matrix[left.length][right.length];
}
