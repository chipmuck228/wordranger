import Link from "next/link";
import { HomeDailyStatus } from "@/components/training/home-daily-status";
import { HomeSettingsMenu } from "@/components/home/home-settings-menu";
import type { DebugToolLink } from "@/server/debug-tools/debug-tool-links";
import type { HomeLearningPaths } from "@/server/home/resolve-home-learning-paths";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring";

export function HomePage({
  debugTools,
  paths,
}: {
  debugTools: readonly DebugToolLink[];
  paths: HomeLearningPaths;
}) {
  return (
    <main
      lang="zh-CN"
      className="home-learning-paths relative min-h-full overflow-x-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,oklch(0.97_0.02_85/0.95),transparent_58%),oklch(0.985_0.008_90)]"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col px-5 pb-20 pt-4 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4 py-2">
          <p className="text-sm font-medium tracking-wide text-foreground/80">
            WordRanger
          </p>
          <HomeSettingsMenu debugTools={debugTools} />
        </header>

        <section className="max-w-2xl pt-10 pb-14 lg:pt-16 lg:pb-20">
          <h1 className="text-[1.85rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            让学过的单词，在需要时想得起来
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
            WordRanger
            通过辨义、回忆和拼写练习，帮助你发现哪些词已经记住，哪些词还需要建立或强化记忆。
          </p>
          <div className="mt-8 flex max-w-md flex-col gap-3">
            <Link
              href={paths.primaryHref}
              className={`bg-primary text-primary-foreground hover:bg-primary/80 inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-lg font-medium ${FOCUS}`}
            >
              继续今天的学习
            </Link>
            <p className="text-muted-foreground text-sm">
              继续完成今天安排的单词练习。
            </p>
            <HomeDailyStatus />
          </div>
        </section>

        <section
          aria-label="学习方式"
          className="grid gap-12 border-t border-foreground/8 py-12 lg:grid-cols-2 lg:gap-16"
        >
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              随时练一组
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              自由练习
            </h2>
            <p className="mt-4 text-base leading-relaxed">
              想快速练几个单词时，从这里开始。通过辨义、英文回忆、拼写和词义关系，检查自己能不能独立想起来。
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              适合复习、课前热身，或者随时练一小组单词。
            </p>
            <p className="text-muted-foreground mt-6 text-sm">
              目前请从今天的学习开始。独立的练习选择稍后提供。
            </p>
          </div>

          <div className="min-w-0 lg:border-l lg:border-foreground/8 lg:pl-16">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              一组有关联的词
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              场景学习
            </h2>
            <p className="mt-4 text-base leading-relaxed">
              把有关联的单词放进同一个生活场景。先检查你已经会了哪些，再为需要的词建立或强化记忆。
            </p>
            <div className="mt-8">
              <h3 className="text-lg font-medium">餐桌与用餐</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                从餐桌上的物品和它们之间的关系开始，学习一组彼此有关联的单词。
              </p>
              {paths.scene.status === "ready" ? (
                <Link
                  href={paths.scene.href}
                  className={`border-border bg-background hover:bg-muted mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border px-5 text-sm font-medium ${FOCUS}`}
                >
                  进入场景
                </Link>
              ) : (
                <p
                  role="status"
                  className="text-muted-foreground mt-5 text-sm font-medium"
                >
                  场景学习正在准备中
                </p>
              )}
            </div>
            <p className="text-muted-foreground mt-8 text-sm">
              更多场景正在准备
            </p>
          </div>
        </section>

        <section className="border-t border-foreground/8 pt-12">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            学习会怎样进行？
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            <li className="min-w-0">
              <p className="text-muted-foreground text-sm font-medium">1</p>
              <h3 className="mt-2 text-base font-semibold">先自己想一想</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                回答前不会先展示答案，让系统看到你现在能不能独立回忆。
              </p>
            </li>
            <li className="min-w-0">
              <p className="text-muted-foreground text-sm font-medium">2</p>
              <h3 className="mt-2 text-base font-semibold">找到合适的学习方式</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                在场景学习中，已经会的词可以继续前进；有印象但不稳定的词会得到强化；还没有建立记忆的词会从场景和含义开始学习。
              </p>
            </li>
            <li className="min-w-0">
              <p className="text-muted-foreground text-sm font-medium">3</p>
              <h3 className="mt-2 text-base font-semibold">再试着回忆一次</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                看完提示后，再独立完成一次回答，检查刚才建立的连接是否清楚。
              </p>
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
