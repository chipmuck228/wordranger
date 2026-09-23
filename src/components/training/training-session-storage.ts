export const DAILY_TRAINING_SESSION_KEY = "wordranger.daily-training.sessionId";
export const DAILY_TRAINING_COMPLETED_ROUNDS_KEY =
  "wordranger.daily-training.completedRounds";
export const DAILY_TRAINING_LAST_COMPLETED_SESSION_KEY =
  "wordranger.daily-training.lastCompletedSessionId";
export const DAILY_TRAINING_STATUS_EVENT = "wordranger-daily-training-status";

export function readCompletedDailyTrainingRounds(): number {
  if (typeof sessionStorage === "undefined") {
    return 0;
  }
  const raw = sessionStorage.getItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function subscribeDailyTrainingStatus(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DAILY_TRAINING_STATUS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DAILY_TRAINING_STATUS_EVENT, onChange);
  };
}

export function notifyDailyTrainingStatus(): void {
  window.dispatchEvent(new Event(DAILY_TRAINING_STATUS_EVENT));
}

export function hasIncompleteDailyTrainingSession(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  const sessionId = sessionStorage.getItem(DAILY_TRAINING_SESSION_KEY);
  if (!sessionId) {
    return false;
  }
  return (
    sessionStorage.getItem(DAILY_TRAINING_LAST_COMPLETED_SESSION_KEY) !==
    sessionId
  );
}

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
  notifyDailyTrainingStatus();
}
