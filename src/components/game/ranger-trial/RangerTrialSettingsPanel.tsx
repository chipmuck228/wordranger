"use client";

import { Button } from "@/components/ui/button";
import {
  RANGER_TRIAL_ROUND_SIZE,
  type RangerTrialUiSettings,
} from "./ranger-trial-settings";

export function RangerTrialSettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: RangerTrialUiSettings;
  onChange(next: RangerTrialUiSettings): void;
  onClose(): void;
}) {
  return (
    <div
      className="ranger-feedback-in flex flex-col gap-6"
      role="dialog"
      aria-labelledby="ranger-trial-settings-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="ranger-trial-settings-title"
            className="text-xl font-semibold tracking-tight"
          >
            设置
          </h2>
          <p className="text-muted-foreground text-sm">
            目前对所有人开放，之后会改为仅管理员可见。
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>

      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/8">
        <p className="text-muted-foreground text-sm">这一轮</p>
        <p className="mt-1 text-base font-medium">
          {RANGER_TRIAL_ROUND_SIZE} 题 · 点选或输入
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          题数由练习安排决定，设置里暂不改动。
        </p>
      </section>

      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-medium">界面动画</p>
            <p className="text-muted-foreground text-sm">轻微、只用于反馈和进度</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.motionEnabled}
            aria-label="界面动画"
            onClick={() =>
              onChange({ ...settings, motionEnabled: !settings.motionEnabled })
            }
            className={`h-8 w-14 rounded-full transition-colors ${
              settings.motionEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`block size-6 rounded-full bg-white shadow-sm transition-transform ${
                settings.motionEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
