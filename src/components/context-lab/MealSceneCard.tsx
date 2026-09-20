import { ContextEntityTile } from "./ContextEntityTile";
import { RelationHighlight } from "./RelationHighlight";
import type { PublicContextPresentation } from "./types";

export function MealSceneCard({
  context,
}: {
  context: PublicContextPresentation;
}) {
  const highlighted = new Set(context.highlightedEntityIds);
  return (
    <section
      aria-label="早餐桌上的物品"
      className="bg-card flex min-w-0 flex-col gap-4 rounded-3xl p-4 shadow-sm ring-1 ring-black/5"
    >
      <p className="text-sm leading-relaxed">{context.instruction}</p>
      <div className="grid grid-cols-2 gap-3">
        {context.entities.map((entity) => (
          <ContextEntityTile
            key={entity.id}
            entity={entity}
            highlighted={highlighted.has(entity.id)}
          />
        ))}
      </div>
      {context.relationCaption ? (
        <RelationHighlight caption={context.relationCaption} />
      ) : null}
      {context.contrastCaptions && context.contrastCaptions.length > 0 ? (
        <ul className="space-y-2" aria-label="用途对比">
          {context.contrastCaptions.map((item) => (
            <li
              key={item.entityId}
              className="bg-muted/50 rounded-2xl px-3 py-2 text-sm leading-relaxed"
            >
              {item.caption}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
