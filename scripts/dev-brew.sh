#!/usr/bin/env bash
#
# Run the app locally WITHOUT Docker.
# Starts a Homebrew-managed Postgres, applies the Prisma schema, runs `next dev`,
# and stops Postgres again when you quit the script (Ctrl+C) — but only if this
# script was the one that started it.
#
# Override the formula name if you don't use postgresql@15:
#   PG_FORMULA=postgresql@16 npm run dev:brew

set -euo pipefail

PG_FORMULA="${PG_FORMULA:-postgresql@15}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"

# The local dev database lives in Homebrew Postgres (db: image_comparison_dev,
# owner: your macOS user) and is referenced by DATABASE_URL in .env.local.

started_pg=false

cleanup() {
  if [ "$started_pg" = true ]; then
    echo ""
    echo "→ Stopping ${PG_FORMULA} (started by this script)…"
    brew services stop "$PG_FORMULA" || true
  else
    echo ""
    echo "→ Leaving ${PG_FORMULA} running (it was already up before this script)."
  fi
}
trap cleanup EXIT

# 1. Start Postgres only if it isn't already accepting connections.
if pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
  echo "→ Postgres already running on ${PG_HOST}:${PG_PORT}."
else
  echo "→ Starting ${PG_FORMULA}…"
  brew services start "$PG_FORMULA"
  started_pg=true

  # Wait for it to accept connections (max ~30s).
  echo -n "→ Waiting for Postgres"
  for _ in $(seq 1 30); do
    if pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
      echo " — ready."
      break
    fi
    echo -n "."
    sleep 1
  done
  if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
    echo " — timed out waiting for Postgres." >&2
    exit 1
  fi
fi

# 2. Sync Prisma client + schema, then run the dev server.
echo "→ prisma generate && prisma db push"
npx prisma generate
npx prisma db push

echo "→ next dev"
next dev
