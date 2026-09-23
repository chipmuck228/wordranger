import { cn } from "@/lib/utils";
import type { PublicContextEntity } from "./types";

const ROLE_LABEL: Record<PublicContextEntity["role"], string> = {
  FOOD: "食物",
  CONTAINER: "容器",
  TOOL: "餐具",
};

export function ContextEntityTile({
  entity,
  highlighted,
}: {
  entity: PublicContextEntity;
  highlighted: boolean;
}) {
  return (
    <article
      data-entity-id={entity.id}
      data-highlighted={highlighted ? "true" : "false"}
      aria-current={highlighted ? "true" : undefined}
      className={cn(
        "flex min-h-20 min-w-0 flex-col justify-center rounded-2xl px-3 py-3 ring-1",
        highlighted
          ? "bg-card text-foreground ring-2 ring-foreground/40 shadow-sm"
          : "bg-muted/40 text-foreground ring-black/5",
      )}
    >
      <p className="text-base font-medium break-words">{entity.label}</p>
      <p className="text-muted-foreground text-xs">
        {ROLE_LABEL[entity.role]}
        {highlighted ? " · 当前关注" : ""}
      </p>
    </article>
  );
}
