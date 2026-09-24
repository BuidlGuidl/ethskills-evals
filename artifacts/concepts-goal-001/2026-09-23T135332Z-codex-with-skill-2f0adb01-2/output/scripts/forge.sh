#!/usr/bin/env bash
set -euo pipefail

export HOME="${FOUNDRY_WRITABLE_HOME:-$PWD/.foundry-home}"
export XDG_CACHE_HOME="$HOME/.cache"
mkdir -p "$XDG_CACHE_HOME"

exec forge "$@"

