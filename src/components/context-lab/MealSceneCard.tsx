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
      {context.supportReveal ? (
        <div
          data-support-kind={context.supportReveal.kind}
          className="bg-muted/50 rounded-2xl px-3 py-3 text-sm leading-relaxed"
        >
          <p className="text-muted-foreground">{context.supportReveal.note}</p>
          {context.supportReveal.kind === "LEXICAL_FORM" ? (
            <dl className="mt-2 space-y-2">
              {context.supportReveal.lexicalForm ? (
                <div data-support-field="english">
                  <dt className="text-muted-foreground text-xs">英文</dt>
                  <dd className="text-lg font-semibold">{context.supportReveal.lexicalForm}</dd>
                </div>
              ) : null}
              {context.supportReveal.meaningGloss ? (
                <div data-support-field="meaning">
                  <dt className="text-muted-foreground text-xs">意思</dt>
                  <dd>{context.supportReveal.meaningGloss}</dd>
                </div>
              ) : null}
              {context.supportReveal.phonetic ? (
                <div data-support-field="phonetic">
                  <dt className="text-muted-foreground text-xs">读音</dt>
                  <dd className="text-muted-foreground">{context.supportReveal.phonetic}</dd>
                </div>
              ) : null}
              {context.supportReveal.inflectionNote ? (
                <div data-support-field="inflection">
                  <dt className="text-muted-foreground text-xs">词形</dt>
                  <dd className="text-muted-foreground">
                    {context.supportReveal.inflectionNote}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {context.supportReveal.spellingCue ? (
            <p aria-label="拼写提示" className="mt-2 font-mono text-lg tracking-widest">
              {context.supportReveal.spellingCue}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
