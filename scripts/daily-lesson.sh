#!/usr/bin/env bash
# Launch one unattended Claude Code lesson-building session from cron.
set -euo pipefail

export TZ="Europe/Madrid"
export HOME="${HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}"
export LANG="en_US.UTF-8"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

REPO="$HOME/Projects/lessons"
LOG_DIR="$REPO/.daily-lesson-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y-%m-%dT%H%M%S).log"

cd "$REPO"

# Start every autonomous session from the latest main branch.
git checkout main
git pull --ff-only origin main

bun install --frozen-lockfile >/dev/null

PROMPT='Run one autonomous lesson-building session for this repository.
Read CLAUDE.md, ROADMAP.md, and the relevant skills in .claude/skills first, then follow
them completely. Implement exactly the next unchecked roadmap item from top to bottom,
including its complete English and Spanish content. If fewer than three unchecked items
remain, first append suitable progressively harder finance, quantitative-finance, crypto,
or DeFi items so the roadmap does not run empty, then implement only the first unchecked
item. Inspect the existing working tree carefully and never discard or overwrite changes
you did not create. Work only inside this repository. When the implementation is complete,
mark the item checked with today'\''s date, run the full `bun run pre-commit` workflow,
commit only changes you understand (without a Claude co-author trailer), and push to
origin/main. Do not stop until the completed work is committed and pushed.'

claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1

echo "[$(date)] daily lesson session finished" >> "$LOG"
