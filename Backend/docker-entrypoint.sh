#!/bin/sh
set -e

# Render Postgres often needs SSL; append if missing
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -qv "sslmode="; then
  case "$DATABASE_URL" in
    *\?*) export DATABASE_URL="${DATABASE_URL}&sslmode=require" ;;
    *)    export DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
  esac
  echo "Appended sslmode=require to DATABASE_URL"
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting NestJS on :${PORT:-3000}..."
exec node dist/main.js
