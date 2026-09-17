import { loadVocabularyDataset } from "../src/server/vocabulary/load-vocabulary-dataset";
import { readProvisionalBandDefinition } from "../src/server/vocabulary/file-vocabulary-placement-provider";
import {
  applyCuratedPlacementImport,
  planCuratedPlacementImport,
  readCuratedWordPlacementFile,
} from "../src/server/vocabulary/import-curated-placement";
import { createSupabaseServiceRoleClient } from "../src/lib/supabase/server";
import { SupabaseCuratedPlacementStore } from "../src/server/vocabulary/supabase-curated-placement-store";

function parseMode(argv: string[]): "dry-run" | "apply" {
  if (argv.includes("--apply")) {
    return "apply";
  }
  return "dry-run";
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const dataset = loadVocabularyDataset();
  const definition = readProvisionalBandDefinition();
  const plan = planCuratedPlacementImport({ dataset, definition });
  console.log(
    JSON.stringify(
      {
        mode,
        filePath: plan.filePath,
        recordCount: plan.recordCount,
        valid: plan.valid,
        issues: plan.issues,
      },
      null,
      2,
    ),
  );

  if (!plan.valid) {
    console.error("Curated placement file is invalid. No writes were attempted.");
    process.exitCode = 1;
    return;
  }

  if (mode !== "apply") {
    return;
  }

  const client = createSupabaseServiceRoleClient();
  if (!client) {
    console.error(
      "Apply mode needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The importer does not fall back to the anon key or the file store.",
    );
    process.exitCode = 1;
    return;
  }

  const file = readCuratedWordPlacementFile(plan.filePath);
  const store = new SupabaseCuratedPlacementStore(
    client,
    definition,
    new Set(dataset.lexemes.map((lexeme) => lexeme.id)),
    new Set(dataset.lexemes.map((lexeme) => lexeme.canonicalKey)),
  );
  const applied = await applyCuratedPlacementImport({
    store,
    records: file.records,
  });
  console.log("Applied curated placement import", applied);
}

void main();
