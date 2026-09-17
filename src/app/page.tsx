import Link from "next/link";
import { HomeDailyStatus } from "@/components/training/home-daily-status";

export default function Home() {
  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-10 px-6 py-16"
    >
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
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            单词闯关
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
      <section className="space-y-2">
        <Link
          href="/debug/vocabulary"
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          Open Vocabulary Debug Lab
        </Link>
        <div>
          <Link
            href="/debug/tasks"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Open Task Protocol Debug Lab
          </Link>
        </div>
        <div>
          <Link
            href="/debug/scheduler"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Open Scheduler Debug Lab
          </Link>
        </div>
        <div>
          <Link
            href="/debug/learning"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Open Learning Core Debug Lab
          </Link>
        </div>
        <div>
          <Link
            href="/debug/vocabulary-placement"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Open Vocabulary Placement Review
          </Link>
        </div>
      </section>
    </main>
  );
}
