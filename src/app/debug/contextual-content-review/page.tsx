import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { isContextualContentReviewEnabled } from "@/server/contextual-content-review/gates";
import { listContentReviewTargets } from "@/server/contextual-content-review/list-review-targets";

export const dynamic = "force-dynamic";

export default async function ContextualContentReviewIndexPage() {
  requireDebugTools();
  if (!isContextualContentReviewEnabled()) {
    notFound();
  }
  const items = await listContentReviewTargets();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs">内部内容审核</p>
        <h1 className="text-2xl font-semibold">内容审核工具</h1>
        <p className="text-sm">
          只审核明确登记的 Candidate 内容。通过审核不会发布或接入 /train。
        </p>
      </header>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.reviewKey}>
            <Link
              href={item.href}
              className="bg-card block rounded-2xl px-4 py-4 shadow-sm ring-1 ring-black/5"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground text-sm">Target: {item.targetLabel}</p>
              <p className="text-sm">Status: {item.statusLabel}</p>
              <p className="text-muted-foreground text-sm">
                Frames: {item.frameLabels.join("、")}
              </p>
              <p className="text-xs">Registry: {item.registryStatus}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
