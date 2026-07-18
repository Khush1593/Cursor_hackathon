#!/usr/bin/env bash
# Locally verify Render-style Docker builds + PORT=10000 healthchecks.
# This cannot fully simulate Render free-tier networking limits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.render-sim.yml)

echo "==> Building images (same Dockerfiles as render.yaml)..."
"${COMPOSE[@]}" build

echo "==> Starting stack..."
"${COMPOSE[@]}" up -d

echo "==> Waiting for health..."
for i in $(seq 1 60); do
  py_ok=0
  be_ok=0
  fe_ok=0
  curl -sf http://127.0.0.1:8001/health >/dev/null && py_ok=1 || true
  curl -sf http://127.0.0.1:3002/api/health >/dev/null && be_ok=1 || true
  curl -sf http://127.0.0.1:3001/ >/dev/null && fe_ok=1 || true
  if [[ "$py_ok" -eq 1 && "$be_ok" -eq 1 && "$fe_ok" -eq 1 ]]; then
    echo
    echo "OK  Python  http://127.0.0.1:8001/health"
    echo "OK  Backend http://127.0.0.1:3002/api/health"
    echo "OK  Frontend http://127.0.0.1:3001/"
    echo
    echo "Proxy check (Frontend rewrite → Backend):"
    curl -sf http://127.0.0.1:3001/api-proxy/api/health && echo
    echo
    echo "All local Render-sim checks passed."
    echo "Stop with: docker compose -f docker-compose.render-sim.yml down -v"
    exit 0
  fi
  printf "."
  sleep 3
done

echo
echo "FAILED — one or more services never became healthy. Logs:"
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail 40 python_ai backend frontend
exit 1
