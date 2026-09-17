import { writeFileSync } from "node:fs";
import { createSupabaseServiceRoleClient } from "../src/lib/supabase/server";
import { curatedPlacementFilePath } from "../src/server/vocabulary/curated-placement-store";
import { serializeCuratedPlacementExport } from "../src/server/vocabulary/import-curated-placement";
import { loadVocabularyDataset } from "../src/server/vocabulary/load-vocabulary-dataset";
import { readProvisionalBandDefinition } from "../src/server/vocabulary/file-vocabulary-placement-provider";
import { SupabaseCuratedPlacementStore } from "../src/server/vocabulary/supabase-curated-placement-store";

async function main() {
  const dataset = loadVocabularyDataset();
  const definition = readProvisionalBandDefinition();
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    console.error(
      "Export needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The exporter does not fall back to the anon key.",
    );
    process.exitCode = 1;
    return;
  }
  const store = new SupabaseCuratedPlacementStore(
    client,
    definition,
    new Set(dataset.lexemes.map((lexeme) => lexeme.id)),
    new Set(dataset.lexemes.map((lexeme) => lexeme.canonicalKey)),
  );
  const records = await store.list();
  const filePath = curatedPlacementFilePath();
  writeFileSync(filePath, serializeCuratedPlacementExport(records), "utf8");
  console.log(
    JSON.stringify(
      {
        filePath,
        recordCount: records.length,
      },
      null,
      2,
    ),
  );
}

void main();
