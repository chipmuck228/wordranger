export const FREE_PRACTICE_SESSION_STORAGE_KEY =
  "wordranger.free-practice.session-id";

export function readFreePracticeSessionId(): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const value = sessionStorage.getItem(FREE_PRACTICE_SESSION_STORAGE_KEY);
  return value && value.trim() ? value : null;
}

export function writeFreePracticeSessionId(sessionId: string): void {
  sessionStorage.setItem(FREE_PRACTICE_SESSION_STORAGE_KEY, sessionId);
}

export function clearFreePracticeSessionId(): void {
  sessionStorage.removeItem(FREE_PRACTICE_SESSION_STORAGE_KEY);
}
