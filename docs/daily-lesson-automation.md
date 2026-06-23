# Daily-lesson automation — operations guide

Two native cron jobs keep the platform building and improving itself. Both run
as the local user via the **user crontab** (no git hooks, no CI), both share a
single flock so they can never run at the same time, and both drive **Claude
Code** headlessly.

| Job | Script | Schedule (Europe/Madrid) | Purpose |
|---|---|---|---|
| **Builder** | `scripts/daily-lesson.sh` | `0 6,18 * * *` (06:00 & 18:00 daily) | Catalog is complete; the build queue is retired. Each run improves one existing course (random pick, en + es), then validates/commits/pushes. |
| **Improver** | `scripts/improve-daily-lesson.sh` | `0 12 * * 0` (Sundays 12:00) | Reviews recent builder **runs** and applies one small, evidence-based improvement to the *execution system* itself. |

Both crontab lines are wrapped in the **same** non-blocking lock,
`/usr/bin/flock -n /tmp/lessons-daily-lesson.lock`, so a run only starts if no
other run holds the lock. Sunday noon is deliberately far from the builder's
06:00/18:00 slots; sharing the lock means that even if a builder run overruns,
the improver simply skips that tick instead of overlapping.

```cron
CRON_TZ=Europe/Madrid
0 6,18 * * * /usr/bin/flock -n /tmp/lessons-daily-lesson.lock /home/alejandro/Projects/lessons/scripts/daily-lesson.sh >> /home/alejandro/Projects/lessons/.daily-lesson-logs/cron.log 2>&1
0 12 * * 0 /usr/bin/flock -n /tmp/lessons-daily-lesson.lock /home/alejandro/Projects/lessons/scripts/improve-daily-lesson.sh >> /home/alejandro/Projects/lessons/.daily-lesson-logs/improve-cron.log 2>&1
```

## What the improver does

It is a **continuous-improvement** job, not a builder. Each Sunday it:

1. Asserts the working tree is **clean**. If a builder run stranded work, it
   skips the tick (a no-op success) — it never mixes with builder changes.
2. Builds an **evidence digest** (`.daily-lesson-logs/improve-evidence-*.md`)
   from the last `EVIDENCE_RUNS` builder logs: per-run mode (normal/recovery),
   repair-attempt count, timeouts, validation failures, outcome, wall-clock.
3. Launches one **Claude Code** session pointed at that digest (and the raw
   logs) with a prompt scoped strictly to the *execution system*: the wrapper
   scripts, the session prompts, the validation strategy, reliability, speed,
   and observability. The session may edit **only `scripts/` and `docs/`**.
4. Applies **at most one small, reversible, evidence-backed change** — or
   **nothing at all** when the evidence does not justify a change. Making no
   change is an explicit, successful outcome.
5. Validates **proportionally to what changed** — `bash -n` (and `shellcheck`
   if installed) on changed shell scripts; `bun run check` only if a
   TypeScript/Astro/MDX file changed. It never runs the full content/OG rebuild,
   because it never touches content.
6. On red validation, runs a bounded repair loop; if still red it **restores the
   clean tree and aborts** (never commits red code).
7. On green, stages **only the allowlist** (`scripts/`, `docs/`), commits, pushes
   to `origin/main`, and verifies the push. Anything changed outside the
   allowlist aborts the run with the tree restored — unrelated changes are never
   landed.

### Hard guarantees

- **Never weakens a correctness gate.** Speed improvements may not loosen
  validation or allow failing code to publish.
- **No overlap with the builder** — same flock lock.
- **Bounded everything** — every Claude/validation step runs under `setsid +
  timeout` in its own process group; the group is killed on exit/timeout so
  nothing it spawned can outlive it.
- **Self-healing tree** — because it only ever starts from a known-clean tree,
  any abort restores that clean state, so a failed improver run never strands
  work for the next builder run.

## Running it manually

Always run under the shared lock so a manual run can't collide with a scheduled
builder run:

```bash
# Smoke test — gather the evidence digest and print the plan. Invokes NO Claude
# session, makes NO repo changes, commits nothing. Safe and free.
/usr/bin/flock -n /tmp/lessons-daily-lesson.lock scripts/improve-daily-lesson.sh --dry-run

# Full run — analyse, apply one scoped improvement, validate, commit, push.
/usr/bin/flock -n /tmp/lessons-daily-lesson.lock scripts/improve-daily-lesson.sh
```

`--analyze-only` and `-n` are aliases for `--dry-run`; `--help` prints usage.

### Tunables (environment variables)

| Var | Default | Meaning |
|---|---|---|
| `CLAUDE_TIMEOUT` | `2400` | Hard deadline (s) for the analyse+implement session. |
| `REPAIR_TIMEOUT` | `1200` | Hard deadline (s) for each focused repair session. |
| `CHECK_TIMEOUT` | `900` | Hard deadline (s) for one `bun run check`. |
| `MAX_REPAIR_ATTEMPTS` | `2` | Bounded repair loop on red validation. |
| `EVIDENCE_RUNS` | `12` | How many recent builder logs to digest. |
| `KILL_GRACE` | `30` | TERM→KILL grace handed to `timeout -k`. |

## Logs

All logs live under `.daily-lesson-logs/` (gitignored):

- `improve-<timestamp>.log` — full per-run log of an improver run.
- `improve-evidence-<timestamp>.md` — the evidence digest fed to the session.
- `improve-cron.log` — cron stdout/stderr for the improver.
- `<timestamp>.log`, `cron.log` — builder run logs (the improver's evidence base).

## Tests

`scripts/improve-daily-lesson.test.ts` (run with `bun test`) is a contract test:
it syntax-checks the script and asserts the safety invariants hold (shared lock,
allowlist, never-commit-red, timeouts, headless Claude, no-op-allowed, dry-run).

## Installing / updating the cron entry

The improver entry is added to the user crontab **idempotently** without touching
the existing builder or sibling-project entries:

```bash
# Show current entries
crontab -l

# Add the improver line only if it isn't already present (idempotent)
( crontab -l 2>/dev/null; \
  grep -q 'improve-daily-lesson.sh' <(crontab -l 2>/dev/null) || \
  echo '0 12 * * 0 /usr/bin/flock -n /tmp/lessons-daily-lesson.lock /home/alejandro/Projects/lessons/scripts/improve-daily-lesson.sh >> /home/alejandro/Projects/lessons/.daily-lesson-logs/improve-cron.log 2>&1' \
) | crontab -
```

The `CRON_TZ=Europe/Madrid` header at the top of the crontab governs both jobs.
