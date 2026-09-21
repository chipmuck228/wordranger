/**
 * Meal-only remapping of a home-breakfast snapshot onto another
 * same-skeleton Meal frame. Generic plan factories must not do this
 * lookup; they consume already-bound entity IDs.
 */

import type { ResolvedContextualSceneContent } from "../../content/types";
import { sameLexemeSense } from "../../domain/lexeme-sense";
import type { ContextFrame } from "../../domain/types";

export function projectResolvedMealContentOntoFrame(
  content: ResolvedContextualSceneContent,
  frame: ContextFrame,
): ResolvedContextualSceneContent | null {
  if (content.frame.frameId === frame.id) {
    return content;
  }
  if (content.skeletonId !== frame.skeletonId) {
    return null;
  }

  const remap = (catalogEntityId: string): string | null => {
    const lexeme = content.lexemes.find((item) => item.entityId === catalogEntityId);
    if (!lexeme) {
      return null;
    }
    return (
      frame.entityBindings.find((entity) =>
        entity.lexemeSenseBindings?.some((binding) =>
          sameLexemeSense(binding.sense, lexeme.fixtureSense),
        ),
      )?.entityId ?? null
    );
  };

  const lexemes = [];
  for (const lexeme of content.lexemes) {
    const entityId = remap(lexeme.entityId);
    if (!entityId) {
      return null;
    }
    const contrasts = [];
    for (const contrast of lexeme.contrasts) {
      const contrastEntityId = remap(contrast.contrastEntityId);
      if (!contrastEntityId) {
        return null;
      }
      contrasts.push({ ...contrast, contrastEntityId });
    }
    const groundingFacts = [];
    for (const fact of lexeme.groundingFacts) {
      const args = [];
      for (const arg of fact.args) {
        if (arg.kind !== "ENTITY") {
          args.push(arg);
          continue;
        }
        const remapped = remap(arg.entityId);
        if (!remapped) {
          return null;
        }
        args.push({ ...arg, entityId: remapped });
      }
      groundingFacts.push({ ...fact, args });
    }
    lexemes.push({
      ...lexeme,
      frameId: frame.id,
      entityId,
      contrasts,
      groundingFacts,
    });
  }

  const presentationOrder = [];
  for (const catalogId of content.frame.presentationOrder) {
    const remapped = remap(catalogId);
    if (!remapped) {
      return null;
    }
    presentationOrder.push(remapped);
  }
  const entityIds = [];
  for (const catalogId of content.frame.entityIds) {
    const remapped = remap(catalogId);
    if (!remapped) {
      return null;
    }
    entityIds.push(remapped);
  }

  return {
    ...content,
    frame: {
      ...content.frame,
      frameId: frame.id,
      entityIds,
      presentationOrder,
    },
    lexemes,
  };
}
