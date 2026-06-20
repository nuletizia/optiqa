#!/bin/bash
#
# Copy the production database into a fresh local database.
#
# Requires PRODUCTION_DATABASE_URL to be set (e.g. in .env.local or your shell).
# This script NEVER hardcodes credentials. Load them from the environment:
#
#   set -a; source .env.local; set +a
#   ./scripts/copy-prod-to-local.sh
#
set -euo pipefail

if [[ -z "${PRODUCTION_DATABASE_URL:-}" ]]; then
  echo "Error: PRODUCTION_DATABASE_URL is not set." >&2
  echo "Export it (or source .env.local) before running this script." >&2
  exit 1
fi

LOCAL_DB_NAME="${LOCAL_DB_NAME:-image_comparison_dev}"
DUMP_FILE="$(mktemp -t optiqa_prod_dump.XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "Creating local database '$LOCAL_DB_NAME' if it doesn't exist..."
createdb "$LOCAL_DB_NAME" 2>/dev/null || true

echo "Dumping production database..."
pg_dump "$PRODUCTION_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  --no-comments \
  > "$DUMP_FILE"

echo "Restoring into local database '$LOCAL_DB_NAME'..."
psql -d "$LOCAL_DB_NAME" -f "$DUMP_FILE"

echo "Done! Local database '$LOCAL_DB_NAME' now contains a copy of production data."
