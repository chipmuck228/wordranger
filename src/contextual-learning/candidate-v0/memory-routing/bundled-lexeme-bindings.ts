/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Explicit fixture lemma → bundled vocabulary identity.
 * IDs are the real canonical UUIDs; lemma is never identity.
 */

export interface BundledLexemeBinding {
  fixtureLexemeId: string;
  lemma: string;
  canonicalKey: string;
  lexemeId: string;
}

export const BUNDLED_LEXEME_BINDINGS = {
  spoon: {
    fixtureLexemeId: "lex-spoon",
    lemma: "spoon",
    canonicalKey: "lex-1311-1",
    lexemeId: "87ce6ffc-657f-5d1a-a4cd-1bda6d50c1c4",
  },
  fork: {
    fixtureLexemeId: "lex-fork",
    lemma: "fork",
    canonicalKey: "lex-0548-1",
    lexemeId: "e1b0acdc-de30-5d33-80f9-f1e6a20fb7f3",
  },
  bowl: {
    fixtureLexemeId: "lex-bowl",
    lemma: "bowl",
    canonicalKey: "lex-0179-1",
    lexemeId: "0e2adfba-8389-5ff8-8c63-321d6477122f",
  },
  plate: {
    fixtureLexemeId: "lex-plate",
    lemma: "plate",
    canonicalKey: "lex-1036-1",
    lexemeId: "4ca2bd15-e50d-531b-a379-30eebab1c9c2",
  },
  cup: {
    fixtureLexemeId: "lex-cup",
    lemma: "cup",
    canonicalKey: "lex-0346-1",
    lexemeId: "16ea1697-0049-55fe-9181-03d129352a17",
  },
  soup: {
    fixtureLexemeId: "lex-soup",
    lemma: "soup",
    canonicalKey: "lex-1300-1",
    lexemeId: "0cedaf48-cc16-5132-88ca-cc4f65358729",
  },
  eat: {
    fixtureLexemeId: "lex-eat",
    lemma: "eat",
    canonicalKey: "lex-0430-1",
    lexemeId: "6236d14a-ccec-5a45-9c68-1076cb49baa5",
  },
  drink: {
    fixtureLexemeId: "lex-drink",
    lemma: "drink",
    canonicalKey: "lex-0413-1",
    lexemeId: "9725ed48-3731-5b66-b230-89348ac281ff",
  },
  choose: {
    fixtureLexemeId: "lex-choose",
    lemma: "choose",
    canonicalKey: "lex-0264-1",
    lexemeId: "06eaa4d3-db33-5796-8ad9-f905a5ebd8e9",
  },
  ability: {
    fixtureLexemeId: "lex-ability",
    lemma: "ability",
    canonicalKey: "lex-0002-1",
    lexemeId: "fa8e03eb-221f-5a0d-ac75-e466047bc3bd",
  },
  possible: {
    fixtureLexemeId: "lex-possible",
    lemma: "possible",
    canonicalKey: "lex-1059-1",
    lexemeId: "7158e5bc-e613-52cf-a664-75e6eec411a1",
  },
  difficult: {
    fixtureLexemeId: "lex-difficult",
    lemma: "difficult",
    canonicalKey: "lex-0382-1",
    lexemeId: "674c742d-f1ba-511e-8d57-6c65f3701ab5",
  },
  try: {
    fixtureLexemeId: "lex-try",
    lemma: "try",
    canonicalKey: "lex-1468-1",
    lexemeId: "21610b3f-03d5-5b25-803d-219d3ec5cb04",
  },
  improve: {
    fixtureLexemeId: "lex-improve",
    lemma: "improve",
    canonicalKey: "lex-0695-1",
    lexemeId: "064c0ebc-fb1f-5702-bf6a-72b724129bd9",
  },
  practice: {
    fixtureLexemeId: "lex-practice",
    lemma: "practice",
    canonicalKey: "lex-1068-1",
    lexemeId: "53702453-f7a5-546b-94fd-7315388cb12e",
  },
  success: {
    fixtureLexemeId: "lex-success",
    lemma: "success",
    canonicalKey: "lex-1347-1",
    lexemeId: "58505f9f-9479-5431-a997-a33238803398",
  },
  challenge: {
    fixtureLexemeId: "lex-challenge",
    lemma: "challenge",
    canonicalKey: "lex-0242-1",
    lexemeId: "af6edeed-74b8-5edb-aebd-486ef16f454d",
  },
  result: {
    fixtureLexemeId: "lex-result",
    lemma: "result",
    canonicalKey: "lex-1155-1",
    lexemeId: "956b1c0e-2330-5c08-b3cc-337e8f90d015",
  },
  plan: {
    fixtureLexemeId: "lex-plan",
    lemma: "plan",
    canonicalKey: "lex-1031-1",
    lexemeId: "d23f2e2f-d49b-5d5a-b5a6-c6cd7dfe2329",
  },
  borrow: {
    fixtureLexemeId: "lex-borrow",
    lemma: "borrow",
    canonicalKey: "lex-0174-1",
    lexemeId: "444c4001-d29c-5a5b-814b-98897075ad91",
  },
  lend: {
    fixtureLexemeId: "lex-lend",
    lemma: "lend",
    canonicalKey: "lex-0778-1",
    lexemeId: "b768393f-e122-5054-9dd6-bd94587260d9",
  },
  share: {
    fixtureLexemeId: "lex-share",
    lemma: "share",
    canonicalKey: "lex-1224-1",
    lexemeId: "1e00018b-c06d-516f-808e-0d0cfbca2d1f",
  },
  give: {
    fixtureLexemeId: "lex-give",
    lemma: "give",
    canonicalKey: "lex-0578-1",
    lexemeId: "74931e1b-6f27-518e-939c-ecb0d2cbbf2c",
  },
  take: {
    fixtureLexemeId: "lex-take",
    lemma: "take",
    canonicalKey: "lex-1372-1",
    lexemeId: "e9a29307-9a4f-5e6c-9267-1b36103b0689",
  },
  return: {
    fixtureLexemeId: "lex-return",
    lemma: "return",
    canonicalKey: "lex-1156-1",
    lexemeId: "44c1b81b-4c7c-5fcd-8b14-a19e5d72432f",
  },
  ask: {
    fixtureLexemeId: "lex-ask",
    lemma: "ask",
    canonicalKey: "lex-0085-1",
    lexemeId: "92eea275-f8b4-5547-8f1e-c29a9c4c4744",
  },
  accept: {
    fixtureLexemeId: "lex-accept",
    lemma: "accept",
    canonicalKey: "lex-0008-1",
    lexemeId: "06daf2fd-bd33-5836-ae5c-674726caaf50",
  },
  refuse: {
    fixtureLexemeId: "lex-refuse",
    lemma: "refuse",
    canonicalKey: "lex-1137-1",
    lexemeId: "b3699363-ff83-5798-9090-03408b11120b",
  },
  own: {
    fixtureLexemeId: "lex-own",
    lemma: "own",
    canonicalKey: "lex-0971-1",
    lexemeId: "1ddd9e14-638d-53fa-8f20-76b3670dc60b",
  },
  use: {
    fixtureLexemeId: "lex-use",
    lemma: "use",
    canonicalKey: "lex-1487-1",
    lexemeId: "141444db-c02c-529d-917e-2d537a39319a",
  },
} as const satisfies Record<string, BundledLexemeBinding>;

export const BUNDLED_SPOON_LEXEME_ID = BUNDLED_LEXEME_BINDINGS.spoon.lexemeId;
