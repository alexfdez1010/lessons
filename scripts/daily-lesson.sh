#!/usr/bin/env bash
# Launch one unattended Claude Code lesson-building session from cron.
#
# Scheduled at 06:00 and 18:00 Europe/Madrid via the user crontab
# (`0 6,18 * * * /usr/bin/flock -n /tmp/lessons-daily-lesson.lock .../daily-lesson.sh`).
# Do not move the schedule here — it lives in crontab.
#
# After Claude exits, this wrapper does NOT trust the session's own report. It
# independently verifies that the work was actually landed:
#   1. the working tree is clean (no session changes left uncommitted/untracked),
#   2. HEAD advanced past where the session started, and
#   3. that new HEAD is published on origin/main.
# If any check fails it logs a clear error and exits non-zero so the failure is
# visible in cron.log instead of silently looking like success.
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

# Timestamped line to both the per-run log and stderr (stderr is captured into
# cron.log), so failures surface wherever someone is looking.
log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" | tee -a "$LOG" >&2; }

# Log a clear error and abort with a non-zero exit code.
fail() {
  log "ERROR: $*"
  log "daily lesson session FAILED verification — see $LOG"
  exit 1
}

# Start every autonomous session from the latest main branch.
git checkout main
git pull --ff-only origin main

bun install --frozen-lockfile >/dev/null

# Reference the verification compares against: where main sat before the session.
START_REF="$(git rev-parse HEAD)"
log "session starting from $START_REF"

PROMPT='Run one autonomous lesson-building session for this repository.
Read CLAUDE.md, ROADMAP.md, and the relevant skills in .claude/skills first, then follow
them completely. Implement exactly the next unchecked roadmap item from top to bottom,
including its complete English and Spanish content. If fewer than three unchecked items
remain, first append suitable progressively harder finance, quantitative-finance, crypto,
or DeFi items so the roadmap does not run empty, then implement only the first unchecked
item. Inspect the existing working tree carefully and never discard or overwrite changes
you did not create. Work only inside this repository.

Run every command in the foreground and wait for it to fully exit before moving on. Never
launch builds, type-checks, `bun run pre-commit`, `og:generate`, or any validation or
long-running command in the background (no trailing `&`, no `run_in_background`, no
detaching). Do not start a command and proceed before it returns; always wait for and read
its exit status. In particular, run the full `bun run pre-commit` in the foreground and
confirm it exits zero before you commit — if it fails, fix the cause and re-run it to green.

When the implementation is complete, mark the item checked with today'\''s date, run the
full `bun run pre-commit` workflow (foreground, wait for it), then `git add public/og` for
the regenerated cards, commit only changes you understand (without a Claude co-author
trailer), and push to origin/main. Do not stop until the completed work is committed and
pushed, and you have confirmed with `git status` that the tree is clean and with
`git log origin/main` that your commit is on the remote.'

# Capture Claude's exit code without aborting the script, so verification runs
# regardless and remains the source of truth for success/failure.
set +e
claude -p "$PROMPT" --dangerously-skip-permissions >> "$LOG" 2>&1
CLAUDE_RC=$?
set -e

log "claude exited with code $CLAUDE_RC"
if [ "$CLAUDE_RC" -ne 0 ]; then
  log "WARNING: claude returned a non-zero exit code; verifying git state anyway"
fi

# ---------------------------------------------------------------------------
# Post-session verification — independent of whatever the session claimed.
# ---------------------------------------------------------------------------

# 1. No pending changes related to the session: the tree must be fully clean.
#    Anything left modified or untracked means the session did not commit its work.
DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  log "uncommitted or untracked changes remain:"
  printf '%s\n' "$DIRTY" | tee -a "$LOG" >&2
  fail "working tree is not clean after the session"
fi

# 2. HEAD must have advanced past the session's starting point.
HEAD_AFTER="$(git rev-parse HEAD)"
if [ "$HEAD_AFTER" = "$START_REF" ]; then
  fail "HEAD did not advance (still at $START_REF) — the session committed nothing"
fi
log "HEAD advanced $START_REF -> $HEAD_AFTER"

# 3. The new HEAD must be published on origin/main.
if ! git fetch --quiet origin main; then
  fail "could not fetch origin/main to verify the push"
fi
if ! git merge-base --is-ancestor "$HEAD_AFTER" origin/main; then
  fail "HEAD ($HEAD_AFTER) is not reachable from origin/main — the commit was not pushed"
fi
log "verified $HEAD_AFTER is published on origin/main"

log "daily lesson session finished and verified OK"
