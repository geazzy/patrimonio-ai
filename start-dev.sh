#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ensure_deps() {
  local dir="$1"
  if [ ! -d "${dir}/node_modules" ]; then
    echo "[setup] Installing dependencies in ${dir}..."
    npm install --prefix "${dir}"
  fi
}

start_backend() {
  ensure_deps "${ROOT_DIR}/backend"
  echo "[backend] Starting dev server..."
  npm run --prefix "${ROOT_DIR}/backend" dev
}

start_frontend() {
  ensure_deps "${ROOT_DIR}/frontend"
  echo "[frontend] Starting dev server..."
  npm run --prefix "${ROOT_DIR}/frontend" dev
}

cleanup() {
  trap - SIGINT SIGTERM EXIT
  [ -n "${backend_pid:-}" ] && kill "${backend_pid}" 2>/dev/null || true
  [ -n "${frontend_pid:-}" ] && kill "${frontend_pid}" 2>/dev/null || true
}

start_backend & backend_pid=$!
start_frontend & frontend_pid=$!

trap cleanup SIGINT SIGTERM EXIT

# macOS ships Bash 3.x (no wait -n); wait for both processes instead.
wait "${backend_pid}" "${frontend_pid}" || true
cleanup
