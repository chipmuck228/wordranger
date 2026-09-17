const STORAGE_KEY = "wordranger.ranger-trial.settings.v1";

export const RANGER_TRIAL_ROUND_SIZE = 8;

export interface RangerTrialUiSettings {
  motionEnabled: boolean;
}

export const DEFAULT_RANGER_TRIAL_UI_SETTINGS: RangerTrialUiSettings = {
  motionEnabled: true,
};

const listeners = new Set<() => void>();
let snapshot: RangerTrialUiSettings = { ...DEFAULT_RANGER_TRIAL_UI_SETTINGS };
let storageHydrated = false;

function readStoredSettings(): RangerTrialUiSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_RANGER_TRIAL_UI_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<RangerTrialUiSettings>;
    return {
      motionEnabled: parsed.motionEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_RANGER_TRIAL_UI_SETTINGS };
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getRangerTrialSettingsSnapshot(): RangerTrialUiSettings {
  return snapshot;
}

export function loadRangerTrialSettings(): RangerTrialUiSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_RANGER_TRIAL_UI_SETTINGS };
  }
  snapshot = readStoredSettings();
  return { ...snapshot };
}

export function saveRangerTrialSettings(
  settings: RangerTrialUiSettings,
): void {
  snapshot = { ...settings };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
  emit();
}

export function subscribeRangerTrialSettings(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (!storageHydrated && typeof window !== "undefined") {
    storageHydrated = true;
    snapshot = readStoredSettings();
    queueMicrotask(emit);
  }
  return () => {
    listeners.delete(onStoreChange);
  };
}
