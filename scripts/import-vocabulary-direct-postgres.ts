import {
  attachDirectPostgresCliHandler,
  runTransactionalDirectPostgresCli,
} from "../src/server/vocabulary/import/transactional-direct-postgres-runner";

void attachDirectPostgresCliHandler(
  runTransactionalDirectPostgresCli(process.argv.slice(2), {}, {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  }),
);
