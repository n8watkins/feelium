#!/usr/bin/env bash
set -euo pipefail

database_path=".data/e2e.db"
database_url="file:./${database_path}"

rm -f "${database_path}" "${database_path}-shm" "${database_path}-wal"
DATABASE_URL="${database_url}" npm run db:migrate
DATABASE_URL="${database_url}" npm run db:seed

export AUTH_SECRET="feelium-e2e-secret-not-for-production"
export AUTH_URL="http://127.0.0.1:3100"
export DATABASE_URL="${database_url}"
export NEXT_TELEMETRY_DISABLED=1

npm run build
exec npm run start -- --hostname 127.0.0.1 --port 3100
