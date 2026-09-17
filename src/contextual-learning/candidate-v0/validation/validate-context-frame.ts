import { collectReferencedIds } from "../domain/predicates";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type {
  ContextFrame,
  LexemeSenseRef,
  SemanticSkeleton,
} from "../domain/types";
import { DIRECTIONAL_SENSE_MARKERS } from "../domain/types";
import { DomainErrorCode, errorIssue, validationResult } from "../domain/errors";
import type { DomainValidationResult } from "../domain/errors";
import { attributesLeakRenderer, textLeaksRenderer } from "./renderer-leak";

export interface ValidateContextFrameInput {
  frame: ContextFrame;
  skeleton: SemanticSkeleton;
}

/**
 * Structural checks for a ContextFrame against its SemanticSkeleton.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function validateContextFrame(
  input: ValidateContextFrameInput,
): DomainValidationResult {
  const { frame, skeleton } = input;
  const issues = [];

  if (frame.skeletonId !== skeleton.id) {
    issues.push(
      errorIssue(
        DomainErrorCode.CTX_UNKNOWN_GOAL,
        "skeletonId",
        `Frame ${frame.id} references skeleton ${frame.skeletonId}, not ${skeleton.id}`,
      ),
    );
  }

  const roleIds = new Set(skeleton.roleDefinitions.map((role) => role.id));
  const requiredRoles = skeleton.roleDefinitions.filter(
    (role) => role.cardinality === "ONE",
  );
  const boundRoles = new Set(frame.entityBindings.map((binding) => binding.roleId));
  const entityIds = new Set(frame.entityBindings.map((binding) => binding.entityId));
  const goalIds = new Set(skeleton.goalDefinitions.map((goal) => goal.id));
  const licensedActions = new Set(
    (skeleton.affordanceDefinitions ?? []).map((item) => item.action),
  );
  const eventIds = new Set(
    (skeleton.eventDefinitions ?? []).map((event) => event.id),
  );

  for (const role of requiredRoles) {
    if (!boundRoles.has(role.id)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_MISSING_REQUIRED_BINDING,
          `entityBindings.${role.id}`,
          `Required role ${role.id} is not bound in frame ${frame.id}`,
        ),
      );
    }
  }

  for (const binding of frame.entityBindings) {
    if (!roleIds.has(binding.roleId)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ROLE,
          `entityBindings.${binding.entityId}.roleId`,
          `Entity ${binding.entityId} uses unknown role ${binding.roleId}`,
        ),
      );
    }
    if (attributesLeakRenderer(binding.attributes)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_RENDERER_LEAK,
          `entityBindings.${binding.entityId}.attributes`,
          `Entity ${binding.entityId} stores screen coordinates`,
        ),
      );
    }
    for (const lexeme of binding.lexemeSenseBindings ?? []) {
      if (!lexeme.sense.senseId.trim() || !lexeme.sense.lexemeId.trim()) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_MISSING_SENSE_ID,
            `entityBindings.${binding.entityId}.lexemeSenseBindings`,
            `Lexeme binding on ${binding.entityId} is missing lexemeId or senseId`,
          ),
        );
      }
      if (
        lexeme.bindingKind === "EXPRESSES_CLAIM" &&
        !hasClaimGrounding(frame, lexeme.sense)
      ) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNGROUNDED_CLAIM,
            `entityBindings.${binding.entityId}.lexemeSenseBindings`,
            `Claim binding ${lexeme.sense.senseId} has no supporting predicates`,
          ),
        );
      }
    }
  }

  for (const fact of frame.initialFacts) {
    const refs = collectReferencedIds(fact.arguments);
    for (const entityId of refs.entityIds) {
      if (!entityIds.has(entityId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ENTITY,
            "initialFacts",
            `Fact ${fact.predicate} references unknown entity ${entityId}`,
          ),
        );
      }
    }
    for (const roleId of refs.roleIds) {
      if (!roleIds.has(roleId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ROLE,
            "initialFacts",
            `Fact ${fact.predicate} references unknown role ${roleId}`,
          ),
        );
      }
    }
    if (fact.predicate === "has_general_ability") {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_GENERAL_ABILITY_OVERCLAIM,
          "initialFacts",
          "A local challenge must not assert general ability",
        ),
      );
    }
  }

  for (const goal of frame.goalBindings) {
    if (!goalIds.has(goal.goalId)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_GOAL,
          `goalBindings.${goal.goalId}`,
          `Active goal ${goal.goalId} is not defined by skeleton ${skeleton.id}`,
        ),
      );
    }
  }

  if (licensedActions.size > 0) {
    for (const action of frame.allowedSemanticActions) {
      if (!licensedActions.has(action)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_ACTION_NOT_LICENSED,
            "allowedSemanticActions",
            `Action ${action} is not licensed by skeleton affordances`,
          ),
        );
      }
    }
  }

  for (const grounding of frame.claimGroundings ?? []) {
    if (grounding.supportingFacts.length === 0) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNGROUNDED_CLAIM,
          `claimGroundings.${grounding.sense.senseId}`,
          `Claim ${grounding.sense.senseId} has an empty grounding set`,
        ),
      );
    }
    if (
      grounding.claim.predicate === "has_general_ability" ||
      grounding.sense.senseId.includes("general-ability")
    ) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_GENERAL_ABILITY_OVERCLAIM,
          `claimGroundings.${grounding.sense.senseId}`,
          "Local performance cannot ground a general-ability claim",
        ),
      );
    }
  }

  const directionalSenses = collectDirectionalSenses(frame);
  if (directionalSenses.length > 0) {
    const perspectives = frame.perspectiveBindings ?? [];
    if (perspectives.length === 0) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_MISSING_PERSPECTIVE,
          "perspectiveBindings",
          `Frame ${frame.id} binds directional senses (${directionalSenses.join(", ")}) without perspective`,
        ),
      );
    }
    for (const perspective of perspectives) {
      if (!eventIds.has(perspective.eventId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_MISSING_PERSPECTIVE,
            `perspectiveBindings.${perspective.eventId}`,
            `Perspective event ${perspective.eventId} is not defined on the skeleton`,
          ),
        );
      }
      if (!roleIds.has(perspective.observerRole)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ROLE,
            `perspectiveBindings.${perspective.eventId}.observerRole`,
            `Perspective observer ${perspective.observerRole} is unknown`,
          ),
        );
      }
      const { sourceRole, destinationRole } = perspective.requiredDirection;
      if (!roleIds.has(sourceRole) || !roleIds.has(destinationRole)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ROLE,
            `perspectiveBindings.${perspective.eventId}.requiredDirection`,
            "Perspective direction references an unknown role",
          ),
        );
      }
      if (sourceRole === destinationRole) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_AMBIGUOUS_DIRECTION,
            `perspectiveBindings.${perspective.eventId}.requiredDirection`,
            "borrow/lend direction must distinguish source from destination",
          ),
        );
      }
      if (
        !perspective.expressedSense.senseId.trim() ||
        !perspective.expressedSense.lexemeId.trim()
      ) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_MISSING_SENSE_ID,
            `perspectiveBindings.${perspective.eventId}.expressedSense`,
            "Perspective expressed sense is missing lexemeId or senseId",
          ),
        );
      }
    }
  }

  if (frame.narrative && textLeaksRenderer(frame.narrative.setup)) {
    issues.push(
      errorIssue(
        DomainErrorCode.CTX_RENDERER_LEAK,
        "narrative.setup",
        "Narrative embeds renderer language",
      ),
    );
  }

  return validationResult(issues);
}

function hasClaimGrounding(frame: ContextFrame, sense: LexemeSenseRef): boolean {
  return (frame.claimGroundings ?? []).some(
    (item) =>
      sameLexemeSense(item.sense, sense) && item.supportingFacts.length > 0,
  );
}

function collectDirectionalSenses(frame: ContextFrame): string[] {
  const found: string[] = [];
  for (const binding of frame.entityBindings) {
    for (const lexeme of binding.lexemeSenseBindings ?? []) {
      const marker = DIRECTIONAL_SENSE_MARKERS.find((item) =>
        lexeme.sense.senseId.toLowerCase().includes(item),
      );
      if (marker) {
        found.push(lexeme.sense.senseId);
      }
    }
  }
  return found;
}
