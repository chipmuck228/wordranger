import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildProvisionalWordPlacementFile } from "../src/domain/vocabulary/generate-provisional-placement";
import { serializeProvisionalWordPlacementFile } from "../src/domain/vocabulary/generate-provisional-placement";
import { provisionalPlacementIssues } from "../src/domain/vocabulary/validate-provisional-placement";
import {
  readProvisionalBandDefinition,
  readProvisionalWordPlacementFile,
} from "../src/server/vocabulary/file-vocabulary-placement-provider";
import { loadVocabularyDataset } from "../src/server/vocabulary/load-vocabulary-dataset";

function parseMode(argv: string[]): "write" | "validate" | "check" {
  if (argv.includes("--validate")) {
    return "validate";
  }
  if (argv.includes("--check")) {
    return "check";
  }
  return "write";
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const dataset = loadVocabularyDataset();
  const definition = readProvisionalBandDefinition();
  const identities = dataset.lexemes.map((lexeme) => ({
    canonicalKey: lexeme.canonicalKey,
    sourceIndex: lexeme.sourceIndex,
  }));
  const generated = buildProvisionalWordPlacementFile(definition, identities);
  const serialized = serializeProvisionalWordPlacementFile(generated);
  const canonicalKeys = new Set(
    dataset.lexemes.map((lexeme) => lexeme.canonicalKey),
  );

  if (mode === "validate" || mode === "check") {
    const existing = readProvisionalWordPlacementFile();
    const issues = provisionalPlacementIssues({
      definition,
      records: existing.records,
      canonicalKeys,
    });
    if (issues.length > 0) {
      console.error(JSON.stringify(issues, null, 2));
      process.exitCode = 1;
      return;
    }
    if (mode === "check") {
      const existingBytes = serializeProvisionalWordPlacementFile(existing);
      if (existingBytes !== serialized) {
        console.error(
          "Committed provisional-word-placement.json does not match the generator. Re-run npm run generate:provisional-placement.",
        );
        process.exitCode = 1;
        return;
      }
    }
    console.log(JSON.stringify(generated.meta.qa, null, 2));
    return;
  }

  const outPath = path.join(
    process.cwd(),
    "data",
    "vocabulary",
    "placement",
    "provisional-word-placement.json",
  );
  writeFileSync(outPath, serialized, "utf8");
  console.log(JSON.stringify(generated.meta.qa, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();
