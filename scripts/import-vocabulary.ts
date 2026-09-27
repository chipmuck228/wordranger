import {
  attachVocabularyImportCliHandler,
  runVocabularyImportCli,
} from "../src/server/vocabulary/import/run-cli";
import { createSupabaseServiceRoleClient } from "../src/lib/supabase/server";

void attachVocabularyImportCliHandler(
  runVocabularyImportCli(process.argv.slice(2), process.env, {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  }, {
    createClient: createSupabaseServiceRoleClient,
  }),
);
