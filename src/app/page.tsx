import Link from "next/link";
import { HomeDailyStatus } from "@/components/training/home-daily-status";
import { HomeSettingsMenu } from "@/components/home/home-settings-menu";
import { DEBUG_TOOL_LINKS } from "@/server/debug-tools/debug-tool-links";
import { isDebugToolsEnabled } from "@/server/debug-tools/is-debug-tools-enabled";

export const dynamic = "force-dynamic";

export default function Home() {
  const debugTools = isDebugToolsEnabled() ? DEBUG_TOOL_LINKS : [];
  return (
    <main
      lang="zh-CN"
      className="relative mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-10 px-6 py-16"
    >
      <div className="absolute top-4 right-4">
        <HomeSettingsMenu debugTools={debugTools} />
      </div>
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">WordRanger</h1>
        <p className="text-lg">今天练一点？</p>
        <p className="text-muted-foreground text-sm">
          系统会自动安排今天最值得练的单词。
        </p>
        <HomeDailyStatus />
      </div>
      <Link
        href="/train"
        className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-14 w-full items-center justify-center rounded-lg text-lg font-medium"
      >
        开始今天的训练
      </Link>
      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium">自由练习</h2>
        <div className="flex flex-col gap-2">
          <Link
            href="/play/ranger-trial"
            className="bg-card text-foreground flex min-h-12 items-center justify-between rounded-2xl px-4 py-3 text-sm shadow-sm ring-1 ring-black/5"
          >
            <span>单词闯关</span>
            <span className="text-muted-foreground text-xs">点选 / 输入</span>
          </Link>
          <Link
            href="/play/word-bubble"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            单词泡泡
          </Link>
          <Link
            href="/play/matching"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            连连看
          </Link>
          <Link
            href="/play/snake"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            贪食蛇
          </Link>
        </div>
      </section>
    </main>
  );
}
