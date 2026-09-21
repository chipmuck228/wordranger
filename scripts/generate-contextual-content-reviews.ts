import { generateRegisteredReviewArtifacts } from "../src/server/contextual-content-review/generate-review-artifacts";

async function main() {
  await generateRegisteredReviewArtifacts();
  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
