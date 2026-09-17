import type { SemanticSkeleton } from "../../domain/types";
import { FIXTURE_PROVENANCE, pred, roleArg } from "../shared";

export const BORROW_SKELETON_ID = "temporary-resource-access-v0";

export const borrowingSharingSkeleton: SemanticSkeleton = {
  id: BORROW_SKELETON_ID,
  version: 0,
  title: "Temporary resource access",
  description:
    "Ownership, request, temporary possession, and return without treating transfer as a generic blob.",
  supportedContextKinds: ["SOCIAL", "EVENT"],
  roleDefinitions: [
    { id: "OWNER", label: "Owner", cardinality: "ONE", accepts: [] },
    { id: "REQUESTER", label: "Requester", cardinality: "ONE", accepts: [] },
    { id: "ITEM", label: "Item", cardinality: "ONE", accepts: [] },
    {
      id: "TEMPORARY_HOLDER",
      label: "Temporary holder",
      cardinality: "OPTIONAL_ONE",
      accepts: [],
    },
  ],
  relationDefinitions: [
    {
      id: "OWNS",
      label: "Owns",
      fromRole: "OWNER",
      toRole: "ITEM",
      directionality: "DIRECTED",
      temporalScope: "PERSISTENT",
    },
    {
      id: "REQUESTS_FROM",
      label: "Requests from",
      fromRole: "REQUESTER",
      toRole: "OWNER",
      directionality: "DIRECTED",
      temporalScope: "EVENT",
    },
    {
      id: "TEMPORARILY_POSSESSES",
      label: "Temporarily possesses",
      fromRole: "TEMPORARY_HOLDER",
      toRole: "ITEM",
      directionality: "DIRECTED",
      temporalScope: "STATE",
    },
  ],
  eventDefinitions: [
    {
      id: "REQUEST_ACCESS",
      participantRoles: ["REQUESTER", "OWNER", "ITEM"],
      preconditions: [],
      effects: [],
    },
    {
      id: "ACCEPT_REQUEST",
      participantRoles: ["OWNER", "REQUESTER"],
      preconditions: [],
      effects: [],
    },
    {
      id: "REFUSE_REQUEST",
      participantRoles: ["OWNER", "REQUESTER"],
      preconditions: [],
      effects: [],
    },
    {
      id: "TRANSFER_TEMPORARY_POSSESSION",
      participantRoles: ["OWNER", "REQUESTER", "ITEM", "TEMPORARY_HOLDER"],
      preconditions: [],
      effects: [],
    },
    {
      id: "USE_TOGETHER",
      participantRoles: ["OWNER", "REQUESTER", "ITEM"],
      preconditions: [],
      effects: [],
    },
    {
      id: "RETURN_ITEM",
      participantRoles: ["TEMPORARY_HOLDER", "OWNER", "ITEM"],
      preconditions: [],
      effects: [],
    },
  ],
  affordanceDefinitions: [
    { id: "identify-verb", actorRole: "REQUESTER", action: "IDENTIFY", enabledWhen: [] },
    { id: "select-verb", actorRole: "REQUESTER", action: "SELECT", enabledWhen: [] },
    {
      id: "distinguish-verb",
      actorRole: "REQUESTER",
      action: "DISTINGUISH",
      enabledWhen: [],
    },
    { id: "type-verb", actorRole: "REQUESTER", action: "TYPE", enabledWhen: [] },
    { id: "recall-verb", actorRole: "REQUESTER", action: "RECALL", enabledWhen: [] },
    { id: "observe-event", actorRole: "REQUESTER", action: "OBSERVE", enabledWhen: [] },
    { id: "order-event", actorRole: "REQUESTER", action: "ORDER", enabledWhen: [] },
  ],
  goalDefinitions: [
    {
      id: "REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP",
      description: "Requester can use the item; ownership does not change",
      successPredicate: pred("can_use_without_ownership_change", [
        roleArg("REQUESTER"),
        roleArg("ITEM"),
        roleArg("OWNER"),
      ]),
    },
  ],
  validationRules: [],
  provenance: FIXTURE_PROVENANCE,
  reviewStatus: "REVIEWED",
};
