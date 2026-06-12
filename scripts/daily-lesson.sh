#!/usr/bin/env bash
# Launch one unattended Claude Code lesson-building session from cron.
#
# Scheduled at 06:00 and 18:00 Europe/Madrid via the user crontab
# (`0 6,18 * * * /usr/bin/flock -n /tmp/lessons-daily-lesson.lock .../daily-lesson.sh`).
# Do not move the schedule here -- it lives in crontab.
#
# This wrapper never trusts the session's own report. It enforces the invariant
# that every run ends with a CLEAN tree whose HEAD is published on origin/main,
# and it never publishes code that did not pass full validation.
#
# Resilience model (a Claude session can die right after implementing, leaving
# the work uncommitted):
#   1. Startup guard: if the tree is already dirty (a previous run crashed
#      mid-flight), do NOT start a new roadmap item -- go straight into recovery
#      so we finish the stranded work instead of piling a new course on top.
#   2. Recovery: launch a focused "rescue" Claude session whose ONLY job is to
#      inspect and finish the pending changes, run `bun run pre-commit` to green,
#      then commit and push. If the rescue session finishes the job, great.
#   3. Deterministic finalization: if changes still remain after the rescue
#      session, the wrapper itself runs full validation; only if it passes does
#      it `git add -A`, commit, and push on its own. If validation fails it
#      aborts WITHOUT committing -- never publish unvalidated code.
#   4. Push/fetch use bounded retries, and the run only succeeds once HEAD is
#      verified reachable from origin/main and the tree is clean.
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
  log "daily lesson session FAILED -- see $LOG"
  exit 1
}

# True (exit 0) when the working tree has uncommitted or untracked changes.
tree_dirty() { [ -n "$(git status --porcelain)" ]; }

# Dump the current porcelain status to the log + stderr.
dump_status() { git status --porcelain | tee -a "$LOG" >&2 || true; }

# Run the full validation pipeline in the foreground. Returns its exit code.
# This is the single source of truth for "is this safe to publish?".
run_validation() {
  log "running full validation: bun run pre-commit"
  if bun run pre-commit >>"$LOG" 2>&1; then
    log "validation passed (bun run pre-commit exited 0)"
    return 0
  fi
  log "validation FAILED (bun run pre-commit exited non-zero)"
  return 1
}

# Fetch origin/main with bounded retries and growing backoff.
fetch_with_retry() {
  local n=1 max=5
  while true; do
    if git fetch --quiet origin main; then
      return 0
    fi
    if [ "$n" -ge "$max" ]; then
      log "git fetch origin main failed after $max attempts"
      return 1
    fi
    log "git fetch origin main failed (attempt $n/$max); retrying in $((n * 5))s"
    sleep "$((n * 5))"
    n="$((n + 1))"
  done
}

# Push HEAD to origin/main with bounded retries. On a rejected push it
# re-fetches and rebases onto the latest main before retrying, so a remote that
# advanced underneath us does not strand the commit locally.
push_with_retry() {
  local n=1 max=5
  while true; do
    if git push origin HEAD:main >>"$LOG" 2>&1; then
      log "git push succeeded (attempt $n/$max)"
      return 0
    fi
    if [ "$n" -ge "$max" ]; then
      log "git push failed after $max attempts"
      return 1
    fi
    log "git push failed (attempt $n/$max); re-fetching, rebasing, retrying in $((n * 5))s"
    fetch_with_retry || true
    git pull --rebase origin main >>"$LOG" 2>&1 || log "git pull --rebase reported an issue; will retry push anyway"
    sleep "$((n * 5))"
    n="$((n + 1))"
  done
}

# Ensure the current HEAD is published on origin/main, pushing if needed, then
# verify it independently. Aborts the run on any unrecoverable failure.
ensure_pushed_and_verified() {
  local head
  head="$(git rev-parse HEAD)"
  fetch_with_retry || fail "could not fetch origin/main to check publication state"
  if ! git merge-base --is-ancestor "$head" origin/main; then
    log "HEAD ($head) is not yet on origin/main; pushing"
    push_with_retry || fail "could not push HEAD ($head) to origin/main after retries"
    fetch_with_retry || fail "could not re-fetch origin/main after pushing"
  fi
  if ! git merge-base --is-ancestor "$head" origin/main; then
    fail "HEAD ($head) is still not reachable from origin/main after push"
  fi
  log "verified $head is published on origin/main"
}

# Assert the tree is clean; abort loudly otherwise.
assert_clean_tree() {
  if tree_dirty; then
    log "working tree is unexpectedly dirty at the final check:"
    dump_status
    fail "working tree is not clean after finalization"
  fi
}

# Run a Claude session with the given prompt. Never aborts the wrapper on a
# non-zero exit code -- the independent git verification stays the source of
# truth. Returns Claude's exit code for logging only.
run_claude() {
  local prompt="$1"
  set +e
  claude -p "$prompt" --dangerously-skip-permissions >>"$LOG" 2>&1
  local rc=$?
  set -e
  log "claude exited with code $rc"
  return "$rc"
}

# Recover stranded work: a focused rescue session finishes the pending changes;
# if any remain afterwards the wrapper validates and commits them deterministically.
# Pushing is handled by the caller via ensure_pushed_and_verified.
recover() {
  local context="$1"
  log "RECOVERY ($context): pending changes detected:"
  dump_status

  # Dependencies may be needed by the rescue session and by validation. Use a
  # non-frozen install because the stranded changes might touch the lockfile.
  log "RECOVERY ($context): installing dependencies"
  bun install >>"$LOG" 2>&1 || log "WARNING: bun install reported an issue; continuing"

  log "RECOVERY ($context): launching focused rescue session"
  run_claude "$RESCUE_PROMPT" || log "WARNING: rescue session returned non-zero; the wrapper will finalize"

  if ! tree_dirty; then
    log "RECOVERY ($context): tree is clean after the rescue session"
    return 0
  fi

  log "RECOVERY ($context): changes still present after rescue; validating before any commit"
  dump_status
  if ! run_validation; then
    fail "RECOVERY ($context): validation failed; refusing to commit (never publish unvalidated code)"
  fi

  # Validation passed and changes remain -> finalize deterministically.
  git add -A
  if git diff --cached --quiet; then
    log "RECOVERY ($context): nothing staged after validation; nothing to commit"
    return 0
  fi
  git commit -q -m "chore(daily-lesson): finalize autonomous session work (wrapper recovery)" \
    -m "A prior session exited before committing; validation passed, so the wrapper landed the work." \
    >>"$LOG" 2>&1
  log "RECOVERY ($context): committed pending work deterministically -> $(git rev-parse HEAD)"
}

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
confirm it exits zero before you commit -- if it fails, fix the cause and re-run it to green.

When the implementation is complete, mark the item checked with today'\''s date, run the
full `bun run pre-commit` workflow (foreground, wait for it), then `git add public/og` for
the regenerated cards, commit only changes you understand (without a Claude co-author
trailer), and push to origin/main. Do not stop until the completed work is committed and
pushed, and you have confirmed with `git status` that the tree is clean and with
`git log origin/main` that your commit is on the remote.'

RESCUE_PROMPT='A previous autonomous session for this repository exited while leaving
uncommitted or untracked changes in the working tree. Do NOT start any new roadmap item or
any new lesson. Your ONLY job is to safely finish the work that is already present in the
working tree.

1. Run `git status` and inspect every pending change so you understand exactly what it is.
   It is most likely an in-progress course, lesson, component, or regenerated OG cards.
2. Complete only what is needed to make that work consistent and valid. Never discard,
   revert, or overwrite changes you did not create.
3. Run the full `bun run pre-commit` in the foreground, wait for it to fully exit, and fix
   any failures, re-running until it exits zero. Run every command in the foreground and
   never in the background (no trailing `&`, no run_in_background, no detaching).
4. Then `git add -A` (including the regenerated public/og cards), commit the changes with a
   clear message and NO Claude co-author trailer, and push to origin/main.

Do not stop until either the tree is clean and your commit is on origin/main, or you are
certain `bun run pre-commit` cannot be made to pass -- in which case leave the changes in
place untouched and clearly explain the blocker. Never commit or push if validation is red.'

# ---------------------------------------------------------------------------
# 0. Make sure we are on main.
# ---------------------------------------------------------------------------
git checkout main >>"$LOG" 2>&1 || fail "could not checkout main"

# ---------------------------------------------------------------------------
# 1. Startup guard. If the tree is already dirty, a previous run crashed
#    mid-flight: recover that stranded work FIRST instead of starting a new
#    roadmap item on top of a dirty tree. Do not pull onto a dirty tree.
# ---------------------------------------------------------------------------
if tree_dirty; then
  log "startup: working tree is NOT clean -- entering recovery mode (no new roadmap item this run)"
  recover "startup"
  ensure_pushed_and_verified
  assert_clean_tree
  log "daily lesson session (startup recovery) finished and verified OK"
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Normal run. Start from the latest main and a clean install.
# ---------------------------------------------------------------------------
git pull --ff-only origin main >>"$LOG" 2>&1 || fail "could not fast-forward main from origin"
bun install --frozen-lockfile >>"$LOG" 2>&1

# Reference the verification compares against: where main sat before the session.
START_REF="$(git rev-parse HEAD)"
log "session starting from $START_REF"

run_claude "$PROMPT" || log "WARNING: main session returned non-zero; verifying git state anyway"

# ---------------------------------------------------------------------------
# 3. Post-session handling. If the session left changes behind, recover them
#    (rescue session -> validated deterministic commit). Otherwise the session
#    already committed; we still independently verify below.
# ---------------------------------------------------------------------------
if tree_dirty; then
  log "post-session: working tree is dirty -- the session did not land its work; recovering"
  recover "post-session"
fi

# ---------------------------------------------------------------------------
# 4. Independent verification -- source of truth regardless of session claims.
# ---------------------------------------------------------------------------
ensure_pushed_and_verified
assert_clean_tree

HEAD_AFTER="$(git rev-parse HEAD)"
if [ "$HEAD_AFTER" = "$START_REF" ]; then
  fail "HEAD did not advance (still at $START_REF) -- the session produced no committed work"
fi
log "HEAD advanced $START_REF -> $HEAD_AFTER"
log "daily lesson session finished and verified OK"
