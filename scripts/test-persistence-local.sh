#!/usr/bin/env bash
set -euo pipefail

port="${TEST_LIBSQL_PORT:-8080}"
url="http://127.0.0.1:${port}"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/feelium-turso-XXXXXX")"
database="$workspace/database.db"
log="$workspace/server.log"

turso dev --db-file "$database" --port "$port" >"$log" 2>&1 &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  rm -rf "$workspace"
}
trap cleanup EXIT

ready=false
for _ in {1..50}; do
  if curl --silent "$url" >/dev/null; then
    ready=true
    break
  fi
  sleep 0.1
done

if [[ "$ready" != true ]]; then
  echo "The disposable Turso server did not become ready."
  sed -n '1,120p' "$log"
  exit 1
fi

TEST_LIBSQL_URL="$url" npm run test:persistence
