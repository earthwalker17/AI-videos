#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Starts the published `minidsh web` in WSL on a fixed loopback port for the web take, out of a
# given MiniDSH home and working folder. It prints its one-time link and runs until killed
# (`pkill -f 'bin/minidsh(.js)? web'`). With --seed <log>, a fresh home is made that holds only that
# recorded session (keyless: for rehearsing the take on MiniDSH's own published log).
#
#   bash serve-wsl.sh <home> <cwd> [port] [--seed <session log>]
set -euo pipefail
HOME_DIR="${1:?usage: serve-wsl.sh <home> <cwd> [port] [--seed <log>]}"
CWD="${2:?usage}"
PORT="${3:-20555}"
export PATH=/opt/minidsh-node/bin:/opt/minidsh-pkg/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/code LANG=C.UTF-8
if [ "${4:-}" = "--seed" ]; then
  LOG="${5:?--seed needs a log}"
  ID="$(head -n 1 "$LOG" | node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(0, "utf8")).id)')"
  rm -rf "$HOME_DIR" && mkdir -p "$HOME_DIR/sessions"
  cp "$LOG" "$HOME_DIR/sessions/$ID.jsonl"
  unset DEEPSEEK_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY
fi
pkill -f 'bin/minidsh(.js)? web' 2>/dev/null && sleep 1.5 || true
export MINIDSH_HOME="$HOME_DIR"
cd "$CWD"
exec minidsh web --cwd "$CWD" --port "$PORT"
