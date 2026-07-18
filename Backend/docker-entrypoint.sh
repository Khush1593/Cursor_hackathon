#!/bin/sh
set -e

# Render Postgres requires TLS. Local Docker Postgres does not.
# Render sets RENDER=true on every service automatically.
if [ "${RENDER:-}" = "true" ] && [ -n "${DATABASE_URL:-}" ]; then
  if ! echo "$DATABASE_URL" | grep -q "sslmode="; then
    case "$DATABASE_URL" in
      *\?*) export DATABASE_URL="${DATABASE_URL}&sslmode=require" ;;
      *)    export DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
    esac
    echo "Appended sslmode=require to DATABASE_URL (Render)"
  fi
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting NestJS on :${PORT:-3000}..."
exec node dist/main.js
