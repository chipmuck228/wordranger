export const DAILY_TRAINING_SESSION_KEY = "wordranger.daily-training.sessionId";
export const DAILY_TRAINING_COMPLETED_ROUNDS_KEY =
  "wordranger.daily-training.completedRounds";
export const DAILY_TRAINING_LAST_COMPLETED_SESSION_KEY =
  "wordranger.daily-training.lastCompletedSessionId";

export function markDailyTrainingRoundComplete(sessionId: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const last = sessionStorage.getItem(DAILY_TRAINING_LAST_COMPLETED_SESSION_KEY);
  if (last === sessionId) {
    return;
  }
  sessionStorage.setItem(DAILY_TRAINING_LAST_COMPLETED_SESSION_KEY, sessionId);
  const current = Number(
    sessionStorage.getItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY) ?? "0",
  );
  const next = Number.isFinite(current) ? current + 1 : 1;
  sessionStorage.setItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY, String(next));
}
