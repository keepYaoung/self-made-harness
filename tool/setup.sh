#!/bin/bash
# 하네스 도구 설치. 저장소 루트에서: bash tool/setup.sh
set -euo pipefail
tool_dir="$(cd "$(dirname "$0")" && pwd)"
command -v uv >/dev/null || { echo 'Missing: uv (brew install uv)' >&2; exit 1; }
command -v npm >/dev/null || { echo 'Missing: node/npm 22.12+' >&2; exit 1; }
git -C "$tool_dir/.." submodule update --init tool/scrapling
UV_CACHE_DIR="$tool_dir/.cache/uv" uv sync --project "$tool_dir/artemis-codex" --frozen
npm ci --prefix "$tool_dir" --cache "$tool_dir/.cache/npm" --no-fund
uv venv --quiet "$tool_dir/scrapling/.venv"
UV_CACHE_DIR="$tool_dir/.cache/uv" uv pip install --quiet --python "$tool_dir/scrapling/.venv/bin/python" -e "$tool_dir/scrapling[ai]"
command -v adb >/dev/null || echo 'Optional: adb (Android 캡처·자동화에 필요)' >&2
echo 'Installed. Scrapling 브라우저가 필요하면: bash tool/run.sh scrapling install'
