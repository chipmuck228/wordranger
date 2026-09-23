import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileContentReviewRepository } from "./file-content-review-repository";
import { renderHumanReviewMarkdown } from "./human-review-markdown";
import { projectContentReviewPacket } from "./project-review-packet";
import { safeReviewArtifactDirectory } from "./review-artifact-path";
import {
  CONTENT_REVIEW_TARGETS,
  reviewTargetByKey,
  type ContentReviewTargetSpec,
} from "./review-target-registry";
import type { ContentReviewPacket } from "./types";

function renderPacketMarkdown(packet: ContentReviewPacket, spec: ContentReviewTargetSpec): string {
  const frames = packet.frames
    .map((frame) => {
      const facts = frame.facts
        .map(
          (fact) =>
            `- ${fact.predicate}(${fact.args
              .map((arg) => (arg.kind === "ENTITY" ? arg.entityId : arg.kind === "ROLE" ? arg.roleId : arg.value))
              .join(", ")}) \`${fact.factId}\``,
        )
        .join("\n");
      const steps = frame.steps
        .map(
          (step) =>
            `### ${step.title}\n\nStudent: ${step.student.instruction}\n\nAudit: ${step.audit.guidedOrAssessable} / form visible ${step.audit.lexicalFormVisible} / leak ${step.audit.answerLeakage}`,
        )
        .join("\n\n");
      return `## ${frame.title} (\`${frame.frameId}\`)\n\n${facts}\n\n${steps}`;
    })
    .join("\n\n");
  const checks = packet.machineChecks
    .map((check) => `- ${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`)
    .join("\n");
  const limitations =
    spec.reviewKey === "meal-expansion-batch-01-cup"
      ? `- drink / plate / eat / choose are not in this review.
- Saving APPROVED does not change pack or registry status.
- This is not 1600-word coverage.`
      : `- This packet reviews only the registered target.
- Saving APPROVED does not change pack or registry status.
- This is not 1600-word coverage.`;
  const statusLine =
    packet.pack.registryStatus === "APPROVED_FOR_EXPERIMENT"
      ? "Status: Candidate V0 / Experimental / APPROVED_FOR_EXPERIMENT only"
      : "Status: Candidate V0 / Experimental / CANDIDATE only";
  return `# Review packet

${statusLine}

This file is machine-generated. It is not a human approval.

- Pack: \`${packet.pack.packId}\`
- Registry status: \`${packet.pack.registryStatus}\`
- Target: \`${packet.target.lexemeId}\` / \`${packet.target.senseId}\`
- Canonical key: \`${packet.target.canonicalKey}\`${
    spec.reviewKey === "meal-expansion-batch-01-cup"
      ? ""
      : `
- Selected meaning: \`${packet.target.meaningGloss}\``
  }
- Content fingerprint: \`${packet.pack.contentFingerprint}\`
- Human review: ${packet.reviewStatus}
- Stale state: ${packet.staleState}

## Notices

${packet.notices.map((item) => `- ${item}`).join("\n")}

## Machine checks

${checks}

${frames}

## Known limitations

${limitations}
`;
}

function publicManifest(packet: ContentReviewPacket, spec: ContentReviewTargetSpec) {
  return {
    schemaVersion: packet.schemaVersion,
    packId: packet.pack.packId,
    registryStatus: packet.pack.registryStatus,
    contentFingerprint: packet.pack.contentFingerprint,
    target: {
      lexemeId: packet.target.lexemeId,
      senseId: packet.target.senseId,
      canonicalKey: packet.target.canonicalKey,
      roleId: packet.target.roleId,
      ...(spec.reviewKey === "meal-expansion-batch-01-cup"
        ? {}
        : { meaningGloss: packet.target.meaningGloss }),
    },
    frameIds: packet.frames.map((frame) => frame.frameId),
    machineChecks: packet.machineChecks,
    reviewStatus: packet.reviewStatus,
    staleState: packet.staleState,
  };
}

export async function generateReviewArtifacts(reviewKey: string): Promise<{
  fingerprint: string;
  stale: boolean;
  registryStatus: string;
}> {
  const spec = reviewTargetByKey(reviewKey);
  const dir = safeReviewArtifactDirectory(reviewKey);
  if (!spec || !dir) {
    throw new Error("Unknown review target cannot generate artifacts.");
  }
  const record = await fileContentReviewRepository.get(spec.reviewKey);
  const packet = projectContentReviewPacket({ spec, record, writeEnabled: false });
  if (!packet) {
    throw new Error(`Failed to project the review packet for ${spec.reviewKey}.`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "REVIEW_PACKET.md"), renderPacketMarkdown(packet, spec), "utf8");
  writeFileSync(
    path.join(dir, "REVIEW_MANIFEST.json"),
    `${JSON.stringify(publicManifest(packet, spec), null, 2)}\n`,
    "utf8",
  );
  const humanPath = path.join(dir, "HUMAN_REVIEW.md");
  if (!existsSync(humanPath) && !record) {
    writeFileSync(
      humanPath,
      renderHumanReviewMarkdown({
        fingerprint: packet.pack.contentFingerprint,
        record: null,
      }),
      "utf8",
    );
  } else if (record) {
    writeFileSync(
      humanPath,
      renderHumanReviewMarkdown({
        fingerprint: packet.pack.contentFingerprint,
        record,
      }),
      "utf8",
    );
  } else if (existsSync(humanPath)) {
    const current = readFileSync(humanPath, "utf8");
    if (!current.includes(packet.pack.contentFingerprint) && current.includes("Decision: PENDING")) {
      writeFileSync(
        humanPath,
        renderHumanReviewMarkdown({
          fingerprint: packet.pack.contentFingerprint,
          record: null,
        }),
        "utf8",
      );
    }
  }
  return {
    fingerprint: packet.pack.contentFingerprint,
    stale: packet.staleState === "STALE_REVIEW",
    registryStatus: packet.pack.registryStatus,
  };
}

export async function generateRegisteredReviewArtifacts(): Promise<void> {
  for (const spec of CONTENT_REVIEW_TARGETS) {
    await generateReviewArtifacts(spec.reviewKey);
  }
}

export async function generateMealBatch01CupReviewArtifacts(): Promise<{
  fingerprint: string;
  stale: boolean;
  registryStatus: string;
}> {
  return generateReviewArtifacts("meal-expansion-batch-01-cup");
}
