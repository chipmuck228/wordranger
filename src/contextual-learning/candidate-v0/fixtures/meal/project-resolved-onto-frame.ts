/**
 * Compatibility projection for Meal frames that are not yet authored
 * in the Scene Content pack (Picnic today). Home and Restaurant resolve
 * the caller's real runtime frame and fail closed if that frame is
 * invalid. They do not fall back to a pack snapshot.
 *
 * Meal-only remapping of a home-breakfast snapshot onto another
 * same-skeleton Meal frame. Generic plan factories must not do this
 * lookup; they consume already-bound entity IDs.
 *
 * Facts are not rewritten by entity-ID substitution. The destination
 * frame must already contain exactly one fact with the same predicate
 * and the same ordered arguments after entity remapping. Zero or
 * multiple matches fail closed. The destination factId is taken from
 * that unique runtime fact.
 */

import { sameAuthoredAndFrameFactArgs } from "../../content/fact-args";
import type {
  ContextualFactArgument,
  ResolvedContextualFact,
  ResolvedContextualSceneContent,
} from "../../content/types";
import { sameLexemeSense } from "../../domain/lexeme-sense";
import type { ContextFrame, SemanticFact } from "../../domain/types";

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

  const projectFact = (fact: ResolvedContextualFact): ResolvedContextualFact | null => {
    const args: ContextualFactArgument[] = [];
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
    const matched = matchDestinationFact(frame, fact.predicate, args);
    if (!matched?.id) {
      return null;
    }
    return {
      factId: matched.id,
      predicate: matched.predicate,
      args,
      caption: fact.caption,
    };
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
      const projected = projectFact(fact);
      if (!projected) {
        return null;
      }
      groundingFacts.push(projected);
    }
    let build = { ...lexeme.build };
    if (build.connectFactId) {
      const source =
        lexeme.groundingFacts.find((item) => item.factId === build.connectFactId) ??
        sourceFactById(content, build.connectFactId);
      if (!source) {
        return null;
      }
      const projected = projectFact(source);
      if (!projected) {
        return null;
      }
      build = { ...build, connectFactId: projected.factId };
    }
    lexemes.push({
      ...lexeme,
      frameId: frame.id,
      entityId,
      contrasts,
      groundingFacts,
      build,
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
  const factIds = [];
  for (const catalogFactId of content.frame.factIds) {
    const source = sourceFactById(content, catalogFactId);
    if (!source) {
      return null;
    }
    const projected = projectFact(source);
    if (!projected) {
      return null;
    }
    factIds.push(projected.factId);
  }

  return {
    ...content,
    frame: {
      ...content.frame,
      frameId: frame.id,
      entityIds,
      factIds,
      presentationOrder,
    },
    lexemes,
  };
}

function sourceFactById(
  content: ResolvedContextualSceneContent,
  factId: string,
): ResolvedContextualFact | null {
  for (const lexeme of content.lexemes) {
    const found = lexeme.groundingFacts.find((item) => item.factId === factId);
    if (found) {
      return found;
    }
  }
  return null;
}

function matchDestinationFact(
  frame: ContextFrame,
  predicate: string,
  args: readonly ContextualFactArgument[],
): SemanticFact | null {
  const matches = frame.initialFacts.filter(
    (fact) =>
      fact.predicate === predicate &&
      sameAuthoredAndFrameFactArgs(args, fact.arguments),
  );
  return matches.length === 1 ? matches[0]! : null;
}
