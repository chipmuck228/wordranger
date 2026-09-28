import { runDedicatedVocabularySeedCli } from "../src/server/vocabulary/import/empty-target-vocabulary-seed";

const result = runDedicatedVocabularySeedCli(process.argv.slice(2));
process.exitCode = result.exitCode;
