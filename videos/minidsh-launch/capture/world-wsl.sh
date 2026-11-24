#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Builds the WSL half of the demo world for the MiniDSH launch film, as root, on short neutral
# paths that read naturally on screen: the scratch project at /code/tinytable, an empty
# /code/reports for the approval beat, and a MiniDSH home of its own at /code/.minidsh.
# The project comes from MiniDSH's own scripts/shots/project.sh (it writes only its target).
# MiniDSH itself is the published package in /opt/minidsh-pkg (npm i -g --prefix … minidsh@2.0.0).
#
#   bash world-wsl.sh <MiniDSH checkout as WSL sees it, e.g. /mnt/c/…/MiniDSH>
set -euo pipefail
MINIDSH="${1:?usage: world-wsl.sh <MiniDSH checkout path>}"
export PATH=/opt/minidsh-node/bin:/opt/minidsh-pkg/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mkdir -p /code
bash "$MINIDSH/scripts/shots/project.sh" /code/tinytable
rm -rf /code/reports && mkdir -p /code/reports
mkdir -p /code/.minidsh
echo "minidsh: $(minidsh --version) at $(command -v minidsh); node $(node --version)"
echo "project: $(ls /code/tinytable | tr '\n' ' ')"
MINIDSH_HOME=/code/.minidsh minidsh credentials list || true
