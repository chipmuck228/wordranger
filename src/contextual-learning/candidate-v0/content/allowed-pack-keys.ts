/**
 * Closed allowed-key schema for authored Scene Content packs.
 * Unknown fields fail with CONTENT_UNKNOWN_FIELD. Outcome keys stay
 * CONTENT_OUTCOME_FORBIDDEN.
 */

import {
  SceneContentErrorCode,
  type SceneContentIssue,
} from "./errors";

const FORBIDDEN_KEYS = new Set([
  "evidenceOutcome",
  "mastery",
  "masteryScore",
  "learnerScore",
  "answerKey",
  "correctCandidateIds",
]);

const PACK_KEYS = keys(
  "id",
  "schemaVersion",
  "sceneClusterId",
  "skeletonId",
  "frames",
  "lexemes",
  "planning",
  "provenance",
);
const FRAME_KEYS = keys(
  "frameId",
  "title",
  "settingLabel",
  "introInstruction",
  "entityIds",
  "factIds",
  "presentationOrder",
);
const LEXEME_KEYS = keys(
  "id",
  "target",
  "fixtureSense",
  "canonicalKey",
  "membership",
  "probe",
  "lexicalPresentation",
  "grounding",
  "contrastBindings",
  "build",
  "strengthen",
);
const SENSE_KEYS = keys("lexemeId", "senseId");
const MEMBERSHIP_KEYS = keys("frameBindings", "presentationToken", "presentationRole");
const FRAME_BINDING_KEYS = keys("frameId", "entityId", "roleId", "sceneOrder");
const PROBE_KEYS = keys("skills", "enabled", "recallInstruction");
const LEXICAL_PRESENTATION_KEYS = keys(
  "displayFormSource",
  "meaningGlossSource",
  "phoneticSource",
  "displayLabel",
  "meaningGlossSelector",
);
const MEANING_GLOSS_EXACT_SELECTOR_KEYS = keys("kind", "value");
const MEANING_GLOSS_INDEX_SELECTOR_KEYS = keys("kind", "index");
const GROUNDING_KEYS = keys("frameFacts", "requiredRelationIds");
const FRAME_FACT_GROUP_KEYS = keys("frameId", "facts");
const FACT_KEYS = keys("factId", "predicate", "args", "caption");
const CONNECT_FACT_BINDING_KEYS = keys("frameId", "factId");
const CONTRAST_KEYS = keys("kind", "contrastTarget", "instruction", "caption");
const BUILD_KEYS = keys(
  "enabled",
  "groundInstruction",
  "connectInstruction",
  "connectFactByFrame",
  "teachInstruction",
  "fadeInstruction",
  "recallInstructionKey",
);
const STRENGTHEN_KEYS = keys(
  "enabled",
  "reconnectInstruction",
  "fadeInstruction",
  "verifyInstruction",
);
const PLANNING_KEYS = keys(
  "planIdNamespace",
  "activeGoalId",
  "sourceLearningNeedRef",
  "guidedRationales",
);
const RATIONALE_KEYS = keys("ground", "connect", "teach", "contrast", "fade", "reconnect");
const PROVENANCE_KEYS = keys("status", "sourceRefs", "authoredAt");
const ENTITY_ARG_KEYS = keys("kind", "entityId");
const ROLE_ARG_KEYS = keys("kind", "roleId");
const VALUE_ARG_KEYS = keys("kind", "value");

export function validatePackAllowedKeys(pack: unknown): SceneContentIssue[] {
  if (!isRecord(pack)) {
    return [];
  }
  const issues = objectKeys(pack, PACK_KEYS, "");
  issues.push(...arrayOf(pack.frames, "frames", (frame, path) => objectKeys(frame, FRAME_KEYS, path)));
  issues.push(
    ...arrayOf(pack.lexemes, "lexemes", (lexeme, path) => {
      const local = objectKeys(lexeme, LEXEME_KEYS, path);
      if (!isRecord(lexeme)) {
        return local;
      }
      local.push(...objectKeys(lexeme.target, SENSE_KEYS, `${path}.target`));
      local.push(...objectKeys(lexeme.fixtureSense, SENSE_KEYS, `${path}.fixtureSense`));
      if (isRecord(lexeme.membership)) {
        local.push(...objectKeys(lexeme.membership, MEMBERSHIP_KEYS, `${path}.membership`));
        local.push(
          ...arrayOf(
            lexeme.membership.frameBindings,
            `${path}.membership.frameBindings`,
            (binding, bindingPath) => objectKeys(binding, FRAME_BINDING_KEYS, bindingPath),
          ),
        );
      }
      local.push(...objectKeys(lexeme.probe, PROBE_KEYS, `${path}.probe`));
      local.push(
        ...objectKeys(lexeme.lexicalPresentation, LEXICAL_PRESENTATION_KEYS, `${path}.lexicalPresentation`),
      );
      if (isRecord(lexeme.lexicalPresentation) && isRecord(lexeme.lexicalPresentation.meaningGlossSelector)) {
        const selector = lexeme.lexicalPresentation.meaningGlossSelector;
        local.push(
          ...objectKeys(
            selector,
            selector.kind === "BUNDLED_INDEX"
              ? MEANING_GLOSS_INDEX_SELECTOR_KEYS
              : MEANING_GLOSS_EXACT_SELECTOR_KEYS,
            `${path}.lexicalPresentation.meaningGlossSelector`,
          ),
        );
      }
      if (isRecord(lexeme.grounding)) {
        local.push(...objectKeys(lexeme.grounding, GROUNDING_KEYS, `${path}.grounding`));
        local.push(
          ...arrayOf(
            lexeme.grounding.frameFacts,
            `${path}.grounding.frameFacts`,
            (group, groupPath) => {
              const groupIssues = objectKeys(group, FRAME_FACT_GROUP_KEYS, groupPath);
              if (isRecord(group)) {
                groupIssues.push(
                  ...arrayOf(group.facts, `${groupPath}.facts`, (fact, factPath) => {
                    const factIssues = objectKeys(fact, FACT_KEYS, factPath);
                    if (isRecord(fact)) {
                      factIssues.push(
                        ...arrayOf(fact.args, `${factPath}.args`, (arg, argPath) =>
                          factArgKeys(arg, argPath),
                        ),
                      );
                    }
                    return factIssues;
                  }),
                );
              }
              return groupIssues;
            },
          ),
        );
      }
      local.push(
        ...arrayOf(lexeme.contrastBindings, `${path}.contrastBindings`, (contrast, contrastPath) => {
          const contrastIssues = objectKeys(contrast, CONTRAST_KEYS, contrastPath);
          if (isRecord(contrast)) {
            contrastIssues.push(
              ...objectKeys(contrast.contrastTarget, SENSE_KEYS, `${contrastPath}.contrastTarget`),
            );
          }
          return contrastIssues;
        }),
      );
      local.push(...objectKeys(lexeme.build, BUILD_KEYS, `${path}.build`));
      if (isRecord(lexeme.build)) {
        local.push(
          ...arrayOf(
            lexeme.build.connectFactByFrame,
            `${path}.build.connectFactByFrame`,
            (binding, bindingPath) => objectKeys(binding, CONNECT_FACT_BINDING_KEYS, bindingPath),
          ),
        );
      }
      local.push(...objectKeys(lexeme.strengthen, STRENGTHEN_KEYS, `${path}.strengthen`));
      return local;
    }),
  );
  if (isRecord(pack.planning)) {
    issues.push(...objectKeys(pack.planning, PLANNING_KEYS, "planning"));
    issues.push(
      ...objectKeys(pack.planning.guidedRationales, RATIONALE_KEYS, "planning.guidedRationales"),
    );
  }
  issues.push(...objectKeys(pack.provenance, PROVENANCE_KEYS, "provenance"));
  return issues;
}

function factArgKeys(arg: unknown, path: string): SceneContentIssue[] {
  if (!isRecord(arg)) {
    return [];
  }
  if (arg.kind === "ENTITY") {
    return objectKeys(arg, ENTITY_ARG_KEYS, path);
  }
  if (arg.kind === "ROLE") {
    return objectKeys(arg, ROLE_ARG_KEYS, path);
  }
  if (arg.kind === "VALUE") {
    return objectKeys(arg, VALUE_ARG_KEYS, path);
  }
  return objectKeys(arg, keys("kind"), path);
}

function objectKeys(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
): SceneContentIssue[] {
  if (!isRecord(value)) {
    return [];
  }
  const issues: SceneContentIssue[] = [];
  for (const key of Object.keys(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) {
      issues.push({
        code: SceneContentErrorCode.CONTENT_OUTCOME_FORBIDDEN,
        path: fieldPath,
      });
    } else if (!allowed.has(key)) {
      issues.push({
        code: SceneContentErrorCode.CONTENT_UNKNOWN_FIELD,
        path: fieldPath,
      });
    }
  }
  return issues;
}

function arrayOf(
  value: unknown,
  path: string,
  validateItem: (item: unknown, itemPath: string) => SceneContentIssue[],
): SceneContentIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => validateItem(item, `${path}[${index}]`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function keys(...items: string[]): ReadonlySet<string> {
  return new Set(items);
}
