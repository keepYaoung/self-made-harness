#!/bin/bash
set -euo pipefail
tool_dir="$(cd "$(dirname "$0")" && pwd)"
export PATH="$tool_dir/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export UV_CACHE_DIR="$tool_dir/.cache/uv"
export XCODEBUILDMCP_SENTRY_DISABLED=true
export XCODEBUILDMCP_ENABLED_WORKFLOWS="${XCODEBUILDMCP_ENABLED_WORKFLOWS:-simulator,macos,ui-automation,project-discovery,debugging}"
case "${1:-}" in
  artemis-codex)
    shift
    exec "$tool_dir/artemis-codex/.venv/bin/python" "$tool_dir/artemis-codex/server.py" "$@"
    ;;
  xcodebuildmcp)
    shift
    exec "$tool_dir/node_modules/.bin/xcodebuildmcp" "$@"
    ;;
  mobile-mcp)
    shift
    exec "$tool_dir/node_modules/.bin/mcp-server-mobile" "$@"
    ;;
  scrapling)
    shift
    exec "$tool_dir/scrapling/.venv/bin/scrapling" "$@"
    ;;
  design-ops)
    # self-made-design-ops 는 전체를 들고 오지 않고, 필요한 폴더만 giget 으로 받아 캐시한다.
    shift
    ops="$tool_dir/.cache/design-ops"
    fetch() {
      for p in "$@"; do
        [ -e "$ops/$p" ] && [ -z "${DESIGN_OPS_REFRESH:-}" ] && continue
        npx --yes giget@2 "gh:Self-made-Orange/self-made-design-ops/$p#main" "$ops/$p" --force >&2
      done
    }
    case "${1:-}" in
      get) shift; fetch "$@"; for p in "$@"; do echo "$ops/$p"; done ;;
      i18n-lint) shift; fetch i18n tools; exec node "$ops/i18n/lint.mjs" "$@" ;;
      events) shift; fetch event-taxonomy tools; exec node "$ops/event-taxonomy/convert.mjs" "$@" ;;
      *) echo 'Usage: bash tool/run.sh design-ops {get <path>...|i18n-lint <args>|events <args>}' >&2; exit 2 ;;
    esac
    ;;
  *)
    echo 'Usage: bash tool/run.sh {artemis-codex|xcodebuildmcp|mobile-mcp|scrapling|design-ops} [arguments...]' >&2
    exit 2
    ;;
esac
