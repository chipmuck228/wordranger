/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Explicit fixture lemma → bundled vocabulary identity.
 * Identity is canonicalKey resolved through lexemeIdFromCanonicalKey.
 * Lemma is never identity. UUIDs are not hardcoded.
 */

import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";

export interface BundledLexemeBinding {
  fixtureLexemeId: string;
  lemma: string;
  canonicalKey: string;
}

export function bundledBindingLexemeId(binding: {
  canonicalKey: string;
}): string {
  return lexemeIdFromCanonicalKey(binding.canonicalKey);
}

export function listBundledLexemeBindings(): BundledLexemeBinding[] {
  return Object.values(BUNDLED_LEXEME_BINDINGS);
}

export function findBundledLexemeBinding(
  fixtureLexemeId: string,
): BundledLexemeBinding | undefined {
  return listBundledLexemeBindings().find(
    (binding) => binding.fixtureLexemeId === fixtureLexemeId,
  );
}

export const BUNDLED_LEXEME_BINDINGS = {
  spoon: {
    fixtureLexemeId: "lex-spoon",
    lemma: "spoon",
    canonicalKey: "lex-1311-1",
  },
  fork: {
    fixtureLexemeId: "lex-fork",
    lemma: "fork",
    canonicalKey: "lex-0548-1",
  },
  bowl: {
    fixtureLexemeId: "lex-bowl",
    lemma: "bowl",
    canonicalKey: "lex-0179-1",
  },
  plate: {
    fixtureLexemeId: "lex-plate",
    lemma: "plate",
    canonicalKey: "lex-1036-1",
  },
  cup: {
    fixtureLexemeId: "lex-cup",
    lemma: "cup",
    canonicalKey: "lex-0346-1",
  },
  soup: {
    fixtureLexemeId: "lex-soup",
    lemma: "soup",
    canonicalKey: "lex-1300-1",
  },
  eat: {
    fixtureLexemeId: "lex-eat",
    lemma: "eat",
    canonicalKey: "lex-0430-1",
  },
  drink: {
    fixtureLexemeId: "lex-drink",
    lemma: "drink",
    canonicalKey: "lex-0413-1",
  },
  choose: {
    fixtureLexemeId: "lex-choose",
    lemma: "choose",
    canonicalKey: "lex-0264-1",
  },
  ability: {
    fixtureLexemeId: "lex-ability",
    lemma: "ability",
    canonicalKey: "lex-0002-1",
  },
  possible: {
    fixtureLexemeId: "lex-possible",
    lemma: "possible",
    canonicalKey: "lex-1059-1",
  },
  difficult: {
    fixtureLexemeId: "lex-difficult",
    lemma: "difficult",
    canonicalKey: "lex-0382-1",
  },
  try: {
    fixtureLexemeId: "lex-try",
    lemma: "try",
    canonicalKey: "lex-1468-1",
  },
  improve: {
    fixtureLexemeId: "lex-improve",
    lemma: "improve",
    canonicalKey: "lex-0695-1",
  },
  practice: {
    fixtureLexemeId: "lex-practice",
    lemma: "practice",
    canonicalKey: "lex-1068-1",
  },
  success: {
    fixtureLexemeId: "lex-success",
    lemma: "success",
    canonicalKey: "lex-1347-1",
  },
  challenge: {
    fixtureLexemeId: "lex-challenge",
    lemma: "challenge",
    canonicalKey: "lex-0242-1",
  },
  result: {
    fixtureLexemeId: "lex-result",
    lemma: "result",
    canonicalKey: "lex-1155-1",
  },
  plan: {
    fixtureLexemeId: "lex-plan",
    lemma: "plan",
    canonicalKey: "lex-1031-1",
  },
  borrow: {
    fixtureLexemeId: "lex-borrow",
    lemma: "borrow",
    canonicalKey: "lex-0174-1",
  },
  lend: {
    fixtureLexemeId: "lex-lend",
    lemma: "lend",
    canonicalKey: "lex-0778-1",
  },
  share: {
    fixtureLexemeId: "lex-share",
    lemma: "share",
    canonicalKey: "lex-1224-1",
  },
  give: {
    fixtureLexemeId: "lex-give",
    lemma: "give",
    canonicalKey: "lex-0578-1",
  },
  take: {
    fixtureLexemeId: "lex-take",
    lemma: "take",
    canonicalKey: "lex-1372-1",
  },
  return: {
    fixtureLexemeId: "lex-return",
    lemma: "return",
    canonicalKey: "lex-1156-1",
  },
  ask: {
    fixtureLexemeId: "lex-ask",
    lemma: "ask",
    canonicalKey: "lex-0085-1",
  },
  accept: {
    fixtureLexemeId: "lex-accept",
    lemma: "accept",
    canonicalKey: "lex-0008-1",
  },
  refuse: {
    fixtureLexemeId: "lex-refuse",
    lemma: "refuse",
    canonicalKey: "lex-1137-1",
  },
  own: {
    fixtureLexemeId: "lex-own",
    lemma: "own",
    canonicalKey: "lex-0971-1",
  },
  use: {
    fixtureLexemeId: "lex-use",
    lemma: "use",
    canonicalKey: "lex-1487-1",
  },
} as const satisfies Record<string, BundledLexemeBinding>;

export const BUNDLED_SPOON_LEXEME_ID = bundledBindingLexemeId(
  BUNDLED_LEXEME_BINDINGS.spoon,
);
