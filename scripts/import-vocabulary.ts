import { loadVocabularyDataset } from "../src/server/vocabulary/load-vocabulary-dataset";
import { applyVocabularyImport } from "../src/server/vocabulary/import/apply-import";
import { planVocabularyImport } from "../src/server/vocabulary/import/plan-import";
import { buildVocabularySeedManifest } from "../src/server/vocabulary/import/rebuild-contract";
import { createSupabaseServerClient } from "../src/lib/supabase/server";

function parseMode(
  argv: string[],
): "validate" | "dry-run" | "apply" | "fingerprint" {
  if (argv.includes("--fingerprint")) {
    return "fingerprint";
  }
  if (argv.includes("--validate")) {
    return "validate";
  }
  if (argv.includes("--apply")) {
    return "apply";
  }
  return "dry-run";
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const dataset = loadVocabularyDataset();

  if (mode === "fingerprint") {
    console.log(JSON.stringify(buildVocabularySeedManifest(dataset), null, 2));
    return;
  }

  const plan = planVocabularyImport(dataset, mode);
  console.log(JSON.stringify(plan, null, 2));

  if (mode !== "apply") {
    return;
  }

  const client = createSupabaseServerClient();
  if (!client) {
    console.error(
      "Apply mode needs NEXT_PUBLIC_SUPABASE_URL and a Supabase key. Re-run with --dry-run or --validate.",
    );
    process.exitCode = 1;
    return;
  }

  const applied = await applyVocabularyImport(dataset, client);
  console.log("Applied vocabulary import", {
    sourceEntries: applied.sourceEntries,
    lexemes: applied.lexemes,
    relations: applied.relations,
    tags: applied.tags,
  });
}

void main();
