import type {
  ContrastSet,
  Misconception,
  SemanticConcept,
} from "../../domain/types";
import { FIXTURE_PROVENANCE, pred, profile, sense } from "../shared";

export const BORROW_SENSE = {
  borrow: sense("lex-borrow", "borrow#temporary-receive"),
  lend: sense("lex-lend", "lend#temporary-provide"),
  share: sense("lex-share", "share#joint-access"),
  give: sense("lex-give", "give#transfer-ownership"),
  take: sense("lex-take", "take#gain-control"),
  return: sense("lex-return", "return#restore-possession"),
  ask: sense("lex-ask", "ask#request-access"),
  accept: sense("lex-accept", "accept#allow-access"),
  refuse: sense("lex-refuse", "refuse#deny-access"),
  own: sense("lex-own", "own#ownership"),
  use: sense("lex-use", "use#access"),
} as const;

export const BORROW_CONCEPTS: SemanticConcept[] = [
  {
    id: "concept-temporary-receive",
    label: "Temporary receive",
    kind: "RELATION",
    gloss: "Requester gains temporary possession; ownership stays put",
    provenance: FIXTURE_PROVENANCE,
  },
  {
    id: "concept-temporary-provide",
    label: "Temporary provide",
    kind: "RELATION",
    gloss: "Owner grants temporary possession; ownership stays put",
    provenance: FIXTURE_PROVENANCE,
  },
];

export const BORROW_PROFILES = [
  profile(BORROW_SENSE.borrow, "borrow", ["concept-temporary-receive"]),
  profile(BORROW_SENSE.lend, "lend", ["concept-temporary-provide"]),
  profile(BORROW_SENSE.share, "share", []),
  profile(BORROW_SENSE.give, "give", []),
  profile(BORROW_SENSE.return, "return", []),
  profile(BORROW_SENSE.take, "take", []),
  profile(BORROW_SENSE.ask, "ask", []),
  profile(BORROW_SENSE.accept, "accept", []),
  profile(BORROW_SENSE.refuse, "refuse", []),
  profile(BORROW_SENSE.own, "own", []),
  profile(BORROW_SENSE.use, "use", []),
];

export const BORROW_CONTRASTS: ContrastSet[] = [
  {
    id: "contrast-borrow-lend",
    members: [BORROW_SENSE.borrow, BORROW_SENSE.lend],
    discriminators: [
      {
        id: "disc-perspective",
        dimension: "observer-role",
        rule: pred("same_transfer_different_observer", [], true),
      },
    ],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "contrast-borrow-give",
    members: [BORROW_SENSE.borrow, BORROW_SENSE.give],
    discriminators: [],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
  {
    id: "contrast-share-give",
    members: [BORROW_SENSE.share, BORROW_SENSE.give],
    discriminators: [],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];

export const BORROW_MISCONCEPTIONS: Misconception[] = [
  {
    id: "misc-borrow-equals-give",
    appliesTo: [BORROW_SENSE.borrow, BORROW_SENSE.give],
    incorrectClaim: pred("ownership_changes_on_borrow", [], true),
    correction: pred("ownership_unchanged_on_borrow", [], true),
    supportBlockId: "borrow-support-contrast",
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  },
];
