"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { DebugToolLink } from "@/server/debug-tools/debug-tool-links";

export function HomeSettingsMenu({
  debugTools,
}: {
  debugTools: readonly DebugToolLink[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="border-border bg-background hover:bg-muted inline-flex h-10 min-h-10 items-center rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setOpen((current) => !current)}
      >
        设置
      </button>
      {open ? (
        <nav
          id={panelId}
          aria-label="设置"
          className="border-border bg-card absolute right-0 z-20 mt-2 w-64 rounded-xl border p-3 shadow-sm"
        >
          {debugTools.length > 0 ? (
            <section aria-labelledby="debug-tools-heading" data-testid="debug-tools-group">
              <h2 id="debug-tools-heading" className="text-muted-foreground mb-2 text-xs font-medium">
                Debug 工具
              </h2>
              <ul className="flex flex-col gap-1">
                {debugTools.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="hover:bg-muted block rounded-lg px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-muted-foreground text-sm">暂无可用设置。</p>
          )}
        </nav>
      ) : null}
    </div>
  );
}
