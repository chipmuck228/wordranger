import { collectReferencedIds } from "../domain/predicates";
import type { SemanticSkeleton } from "../domain/types";
import { DomainErrorCode, errorIssue, validationResult } from "../domain/errors";
import type { DomainValidationResult } from "../domain/errors";
import { collectTextLeaves, textLeaksRenderer } from "./renderer-leak";

/**
 * Structural checks for a reusable SemanticSkeleton.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function validateSemanticSkeleton(
  skeleton: SemanticSkeleton,
): DomainValidationResult {
  const issues = [];
  const roleIds = new Set(skeleton.roleDefinitions.map((role) => role.id));
  const conceptHints = new Set<string>();

  for (const relation of skeleton.relationDefinitions) {
    if (!roleIds.has(relation.fromRole)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ROLE,
          `relationDefinitions.${relation.id}.fromRole`,
          `Relation ${relation.id} references unknown role ${relation.fromRole}`,
        ),
      );
    }
    if (!roleIds.has(relation.toRole)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ROLE,
          `relationDefinitions.${relation.id}.toRole`,
          `Relation ${relation.id} references unknown role ${relation.toRole}`,
        ),
      );
    }
  }

  for (const event of skeleton.eventDefinitions ?? []) {
    for (const roleId of event.participantRoles) {
      if (!roleIds.has(roleId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ROLE,
            `eventDefinitions.${event.id}.participantRoles`,
            `Event ${event.id} references unknown role ${roleId}`,
          ),
        );
      }
    }
  }

  for (const goal of skeleton.goalDefinitions) {
    const refs = collectReferencedIds(goal.successPredicate.arguments);
    for (const roleId of refs.roleIds) {
      if (!roleIds.has(roleId)) {
        issues.push(
          errorIssue(
            DomainErrorCode.CTX_UNKNOWN_ROLE,
            `goalDefinitions.${goal.id}.successPredicate`,
            `Goal ${goal.id} references unknown role ${roleId}`,
          ),
        );
      }
    }
    for (const entityId of refs.entityIds) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ENTITY,
          `goalDefinitions.${goal.id}.successPredicate`,
          `Skeleton goal ${goal.id} must not bind a concrete entity ${entityId}`,
        ),
      );
    }
    for (const conceptId of refs.conceptIds) {
      conceptHints.add(conceptId);
    }
  }

  for (const affordance of skeleton.affordanceDefinitions ?? []) {
    if (!roleIds.has(affordance.actorRole)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ROLE,
          `affordanceDefinitions.${affordance.id}.actorRole`,
          `Affordance ${affordance.id} references unknown role ${affordance.actorRole}`,
        ),
      );
    }
    if (affordance.objectRole && !roleIds.has(affordance.objectRole)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_UNKNOWN_ROLE,
          `affordanceDefinitions.${affordance.id}.objectRole`,
          `Affordance ${affordance.id} references unknown role ${affordance.objectRole}`,
        ),
      );
    }
  }

  for (const role of skeleton.roleDefinitions) {
    if (looksLikeLexemeSurface(role.id) || looksLikeLexemeSurface(role.label)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_LEXEME_AS_ROLE_IDENTITY,
          `roleDefinitions.${role.id}`,
          `Role ${role.id} looks like a lexeme surface form, not a semantic slot`,
        ),
      );
    }
  }

  for (const text of collectTextLeaves(skeleton)) {
    if (textLeaksRenderer(text)) {
      issues.push(
        errorIssue(
          DomainErrorCode.CTX_RENDERER_LEAK,
          "skeleton",
          `Skeleton ${skeleton.id} embeds renderer or coordinate language: ${text}`,
        ),
      );
      break;
    }
  }

  void conceptHints;
  return validationResult(issues);
}

function looksLikeLexemeSurface(value: string): boolean {
  return /^[a-z][a-z-]*$/.test(value) && value.length <= 16;
}
