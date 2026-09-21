import { generateMealBatch01CupReviewArtifacts } from "../src/server/contextual-content-review/generate-review-artifacts";

async function main() {
  const result = await generateMealBatch01CupReviewArtifacts();
  console.log(
    JSON.stringify(
      {
        ok: true,
        fingerprint: result.fingerprint,
        stale: result.stale,
        registryStatus: "CANDIDATE",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
