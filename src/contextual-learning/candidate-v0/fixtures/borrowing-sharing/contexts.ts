import type {
  ContextFrame,
  EntityBinding,
  EventBinding,
  PerspectiveBinding,
} from "../../domain/types";
import { FIXTURE_PROVENANCE, entityArg, fact } from "../shared";
import { BORROW_SENSE } from "./knowledge";
import { BORROW_SKELETON_ID } from "./skeleton";

const ACTIONS = [
  "IDENTIFY",
  "SELECT",
  "DISTINGUISH",
  "TYPE",
  "RECALL",
  "OBSERVE",
  "ORDER",
] as const;

function personItemEntities(
  prefix: string,
  labels: { owner: string; requester: string; item: string },
): EntityBinding[] {
  return [
    {
      entityId: `${prefix}-owner`,
      roleId: "OWNER",
      label: labels.owner,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: BORROW_SENSE.own, bindingKind: "NAMES_RELATION" },
        { sense: BORROW_SENSE.lend, bindingKind: "NAMES_RELATION" },
        { sense: BORROW_SENSE.accept, bindingKind: "NAMES_ACTION" },
        { sense: BORROW_SENSE.refuse, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: `${prefix}-requester`,
      roleId: "REQUESTER",
      label: labels.requester,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: BORROW_SENSE.borrow, bindingKind: "NAMES_RELATION" },
        { sense: BORROW_SENSE.ask, bindingKind: "NAMES_ACTION" },
        { sense: BORROW_SENSE.use, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: `${prefix}-item`,
      roleId: "ITEM",
      label: labels.item,
      conceptIds: [],
    },
    {
      entityId: `${prefix}-holder`,
      roleId: "TEMPORARY_HOLDER",
      label: labels.requester,
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: BORROW_SENSE.return, bindingKind: "NAMES_ACTION" },
      ],
    },
  ];
}

function transferEvents(prefix: string): EventBinding[] {
  const owner = `${prefix}-owner`;
  const requester = `${prefix}-requester`;
  const item = `${prefix}-item`;
  const holder = `${prefix}-holder`;
  return [
    {
      eventId: "TRANSFER_TEMPORARY_POSSESSION",
      participantEntityIds: {
        OWNER: owner,
        REQUESTER: requester,
        ITEM: item,
        TEMPORARY_HOLDER: holder,
      },
      beforeFacts: [
        fact("owns", [entityArg(owner), entityArg(item)]),
        fact("possesses", [entityArg(owner), entityArg(item)]),
      ],
      afterFacts: [
        fact("owns", [entityArg(owner), entityArg(item)]),
        fact("temporarily_possesses", [entityArg(holder), entityArg(item)]),
        fact("expected_return", [entityArg(item), entityArg(owner)]),
      ],
    },
    {
      eventId: "RETURN_ITEM",
      participantEntityIds: {
        TEMPORARY_HOLDER: holder,
        OWNER: owner,
        ITEM: item,
      },
      beforeFacts: [
        fact("owns", [entityArg(owner), entityArg(item)]),
        fact("temporarily_possesses", [entityArg(holder), entityArg(item)]),
      ],
      afterFacts: [
        fact("owns", [entityArg(owner), entityArg(item)]),
        fact("possesses", [entityArg(owner), entityArg(item)]),
        fact("return_completed", [entityArg(item)]),
      ],
    },
  ];
}

function borrowPerspectives(): PerspectiveBinding[] {
  return [
    {
      eventId: "TRANSFER_TEMPORARY_POSSESSION",
      observerRole: "REQUESTER",
      expressedSense: BORROW_SENSE.borrow,
      requiredDirection: {
        sourceRole: "OWNER",
        destinationRole: "REQUESTER",
      },
    },
    {
      eventId: "TRANSFER_TEMPORARY_POSSESSION",
      observerRole: "OWNER",
      expressedSense: BORROW_SENSE.lend,
      requiredDirection: {
        sourceRole: "OWNER",
        destinationRole: "REQUESTER",
      },
    },
  ];
}

function borrowFrame(
  id: string,
  title: string,
  prefix: string,
  labels: { owner: string; requester: string; item: string },
  setup: string,
): ContextFrame {
  return {
    id,
    skeletonId: BORROW_SKELETON_ID,
    title,
    kinds: ["SOCIAL", "EVENT"],
    locale: "en",
    entityBindings: personItemEntities(prefix, labels),
    initialFacts: [
      fact("owns", [entityArg(`${prefix}-owner`), entityArg(`${prefix}-item`)]),
      fact("give_would_change_ownership", [
        entityArg(`${prefix}-owner`),
        entityArg(`${prefix}-item`),
      ]),
    ],
    eventBindings: transferEvents(prefix),
    goalBindings: [
      {
        goalId: "REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP",
        active: true,
      },
    ],
    narrative: { setup },
    allowedSemanticActions: [...ACTIONS],
    perspectiveBindings: borrowPerspectives(),
    contentTags: ["borrowing", prefix],
    provenance: FIXTURE_PROVENANCE,
    reviewStatus: "REVIEWED",
  };
}

export const classroomRulerFrame = borrowFrame(
  "classroom-ruler-v0",
  "Borrow a ruler in class",
  "class",
  { owner: "Maya", requester: "Leo", item: "Ruler" },
  "Maya has a ruler. Leo needs it for one task and will give it back.",
);

export const libraryBookFrame = borrowFrame(
  "library-book-v0",
  "Borrow a library book",
  "lib",
  { owner: "Library", requester: "Member", item: "Book" },
  "The library owns the book. A member takes it with a due date.",
);

export const sharePencilsFrame: ContextFrame = {
  id: "share-pencils-v0",
  skeletonId: BORROW_SKELETON_ID,
  title: "Share colored pencils for a poster",
  kinds: ["SOCIAL", "EVENT"],
  locale: "en",
  entityBindings: [
    {
      entityId: "share-owner",
      roleId: "OWNER",
      label: "Pencil owner",
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: BORROW_SENSE.own, bindingKind: "NAMES_RELATION" },
        { sense: BORROW_SENSE.share, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: "share-requester",
      roleId: "REQUESTER",
      label: "Poster partner",
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: BORROW_SENSE.use, bindingKind: "NAMES_ACTION" },
        { sense: BORROW_SENSE.give, bindingKind: "NAMES_ACTION" },
      ],
    },
    {
      entityId: "share-item",
      roleId: "ITEM",
      label: "Colored pencils",
      conceptIds: [],
    },
  ],
  initialFacts: [
    fact("owns", [entityArg("share-owner"), entityArg("share-item")]),
    fact("concurrent_access", [
      entityArg("share-owner"),
      entityArg("share-requester"),
      entityArg("share-item"),
    ]),
  ],
  eventBindings: [
    {
      eventId: "USE_TOGETHER",
      participantEntityIds: {
        OWNER: "share-owner",
        REQUESTER: "share-requester",
        ITEM: "share-item",
      },
      beforeFacts: [
        fact("owns", [entityArg("share-owner"), entityArg("share-item")]),
      ],
      afterFacts: [
        fact("owns", [entityArg("share-owner"), entityArg("share-item")]),
        fact("concurrent_access", [
          entityArg("share-owner"),
          entityArg("share-requester"),
          entityArg("share-item"),
        ]),
      ],
    },
  ],
  goalBindings: [
    {
      goalId: "REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP",
      active: true,
    },
  ],
  narrative: {
    setup: "Two students use the same pencils on one poster at the same time.",
  },
  allowedSemanticActions: [...ACTIONS],
  contentTags: ["sharing"],
  provenance: FIXTURE_PROVENANCE,
  reviewStatus: "REVIEWED",
};

export const BORROW_FRAMES = [
  classroomRulerFrame,
  sharePencilsFrame,
  libraryBookFrame,
] as const;

export function borrowPrefixForFrame(frameId: string): string {
  if (frameId === libraryBookFrame.id) {
    return "lib";
  }
  if (frameId === sharePencilsFrame.id) {
    return "share";
  }
  return "class";
}
