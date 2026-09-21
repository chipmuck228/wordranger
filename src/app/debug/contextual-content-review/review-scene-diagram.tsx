import type { ContentReviewFrame } from "@/server/contextual-content-review/types";

export function ReviewSceneDiagram({
  frame,
  hideTargetForm,
}: {
  frame: ContentReviewFrame;
  hideTargetForm: boolean;
}) {
  const target = frame.entities.find((entity) => entity.isTarget);
  const related = frame.entities.find((entity) => entity.isRelated);
  const contrast = frame.entities.find((entity) => entity.isContrast);
  const fact = frame.facts[0];
  return (
    <section
      aria-label={`${frame.title} 场景`}
      className="bg-card min-w-0 overflow-x-hidden rounded-3xl p-4 shadow-sm ring-1 ring-black/5"
    >
      <p className="mb-3 text-sm leading-relaxed">{frame.introInstruction ?? frame.settingLabel}</p>
      <div className="flex min-w-0 flex-col items-stretch gap-4 md:flex-row md:items-center">
        {target ? (
          <article
            data-entity-id={target.entityId}
            aria-current="true"
            className="min-w-0 flex-1 rounded-2xl px-3 py-3 ring-2 ring-foreground/40"
          >
            <p className="text-base font-medium break-words">
              {hideTargetForm ? target.displayLabel : target.displayLabel}
            </p>
            <p className="text-muted-foreground text-xs">
              {target.roleLabel} · 当前关注
            </p>
          </article>
        ) : null}
        {fact && related ? (
          <p className="text-muted-foreground px-2 text-center text-xs" aria-label={`${fact.predicate} 关系`}>
            {fact.predicate}
            <span aria-hidden="true"> → </span>
          </p>
        ) : null}
        {related ? (
          <article
            data-entity-id={related.entityId}
            className="bg-muted/40 min-w-0 flex-1 rounded-2xl px-3 py-3 ring-1 ring-black/5"
          >
            <p className="text-base font-medium break-words">{related.displayLabel}</p>
            <p className="text-muted-foreground text-xs">{related.roleLabel}</p>
          </article>
        ) : null}
      </div>
      {contrast ? (
        <article
          data-entity-id={contrast.entityId}
          className="bg-muted/40 mt-4 min-w-0 rounded-2xl px-3 py-3 ring-1 ring-black/5"
        >
          <p className="text-sm font-medium break-words">{contrast.displayLabel}</p>
          <p className="text-muted-foreground text-xs">{contrast.roleLabel} · 对比对象</p>
        </article>
      ) : null}
    </section>
  );
}
