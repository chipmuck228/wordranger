#!/usr/bin/env bash
# Optional Docker Postgres runner for Candidate V0 publish/rollback RPCs.
# The default unit suite already executes the same PL/pgSQL through PGlite.
# This script does not apply migrations to a remote Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${CONTEXTUAL_RELEASE_SQL_IMAGE:-postgres:16}"
NAME="wordranger-contextual-release-sql"
PASSWORD="contextual-release-sql"
PORT="${CONTEXTUAL_RELEASE_SQL_PORT:-55432}"
export CONTEXTUAL_RELEASE_SQL_DATABASE_URL="${CONTEXTUAL_RELEASE_SQL_DATABASE_URL:-postgres://postgres:${PASSWORD}@127.0.0.1:${PORT}/postgres}"

if ! command -v docker >/dev/null 2>&1; then
  echo "SQL integration not executed: docker is not available."
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "SQL integration not executed: psql is not available."
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "SQL integration not executed: docker daemon is not running."
  exit 2
fi

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run --rm -d \
  --name "$NAME" \
  -e POSTGRES_PASSWORD="$PASSWORD" \
  -p "${PORT}:5432" \
  "$IMAGE" >/dev/null

for _ in $(seq 1 40); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

psql "$CONTEXTUAL_RELEASE_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null
psql "$CONTEXTUAL_RELEASE_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role login superuser password 'service';
  end if;
end
$$;
SQL

psql "$CONTEXTUAL_RELEASE_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/supabase/migrations_archive/pre_dedicated_baseline/202609220001_contextual_content_releases.sql"
psql "$CONTEXTUAL_RELEASE_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/supabase/migrations_archive/pre_dedicated_baseline/202609220002_contextual_content_active_releases.sql"
psql "$CONTEXTUAL_RELEASE_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
alter function publish_contextual_content_release(text, bigint, jsonb, jsonb, bigint, text, bigint, jsonb) owner to service_role;
alter function rollback_contextual_content_active_release(text, bigint, text, jsonb) owner to service_role;
SQL

export RUN_CONTEXTUAL_RELEASE_SQL=1
npx vitest run tests/contextual-content-release/sql-rpc.integration.test.ts
