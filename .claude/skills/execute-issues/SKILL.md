---
name: execute-issues
description: Execute GitHub issues for a version sequentially - implement, validate, commit, push, and generate a report.
---

# Skill: Execute GitHub Issues

Execute GitHub issues for a version sequentially: implement, validate, commit, push, and generate a report.

## Usage

```
/execute-issues <label> [--issue HVN-xxx] [--dry-run]
```

The `<label>` is the GitHub version label exactly as it appears (e.g., `v1::version:1`).

- `/execute-issues v1::version:1` -- execute all issues labeled `v1::version:1`
- `/execute-issues v1::version:1 --issue HVN-003` -- execute a single issue from that version
- `/execute-issues v1::version:1 --dry-run` -- show execution plan without making changes

## Instructions

### Step 0: Verify prerequisites

1. Confirm we are on the expected branch (e.g., `main` or the user's working branch)
2. Confirm working tree is clean (`git status`)
3. Confirm `gh` is authenticated
4. Parse the label to determine version:
   - Label `v1::version:1` -> version `n=1`
5. Fetch issues from GitHub:
   ```bash
   gh issue list --label "{label}" --state open --limit 100
   ```
6. Read the version issues file for detailed descriptions: `specification/roadmap/implementation/v{n}-issues.md`
7. If a GitHub report exists (`specification/roadmap/implementation/v{n}-github-report.md`), read the HVN-to-GitHub# mapping
8. Read [specification/ROADMAP.md](../../../specification/ROADMAP.md) for the version goal and the phase (`vA.B`) DoD, and [specification/ARCHITECTURE.md](../../../specification/ARCHITECTURE.md) for the contracts the issue must honor

### Step 1: Build execution queue

From the GitHub issue list, build an ordered queue based on dependencies:
- Parse HVN-xxx IDs from issue titles (format: `HVN-xxx: {title}`)
- Determine dependency order from the version issues file dependency tree
- Issues with no unmet dependencies go first
- Skip issues already closed on GitHub
- If `--issue HVN-xxx` is specified, execute only that issue (but verify its dependencies are closed)

Show the user the execution plan and ask for confirmation.

### Step 2: Execute each issue (loop)

For each issue in the queue:

#### 2a. Assign and announce

Print: `--- Starting HVN-xxx: {title} ---`

#### 2b. Read issue details

Read the full issue description from the version issues file (the detailed section for this HVN-xxx).

#### 2c. Implement

Execute the tasks described in the issue. Follow the project conventions in `CLAUDE.md` and the principles in `specification/MISSION.md`. Route by component:

- **Backend changes** (`/backend`): Python, FastAPI. The world build, walkable grid, drives, decision loop, BFS navigation, the tick loop (world clock), the REST API, and all LLM calls (Anthropic) live here. **Backend in cells** — it reasons only in integer grid cells and never computes pixel animation. It **holds the API key** (server-side from v1). Honor the REST contracts in ARCHITECTURE.md (`/world`, `/state`, `/move`, `/chat`) exactly.
- **Frontend changes** (`/frontend`): React thin client (from v1) — render the top-down SVG scene, take player input, and **interpolate** motion so sprites glide. **Frontend in motion** — all pixel-level smoothing lives here; no world logic, no simulation, no direct model key. It fetches `/world` once and polls `/state`, posting `/move` and `/chat`.
- **v0 prototype** (single self-contained React file `lili_house_aitown.jsx`, no backend): implement against `specification/PROTOTYPE_PHASE1_SPEC.md` — it pins every concrete value (grid, rooms, drives, voice pools, glide durations). The cells-vs-motion split is modeled inside the one file.
- **Shared** (`/shared`): world / floor-plan definitions and contracts shared in spirit between front and back.
- **Contract changes:** any change to a wire format (the `/world`, `/state`, `/move`, `/chat` shapes / data model) updates `specification/ARCHITECTURE.md` AND its contract test, alongside both sides.
- Follow existing code style and patterns; keep each version self-contained (don't pull later-version concerns in early — e.g. no persistence before v2, no multiple agents before v1.3).

#### 2d. Validate

Run validation checks:

1. **Backend unit + contract tests:** `pytest` for the changed packages — unit (world build, drive decay/refill thresholds, `pickTarget` incl. the warmth→office case, BFS shortest-path/unreachable), plus the contract tests that pin the `/world` / `/state` / `/move` / `/chat` wire formats
2. **Integration:** run the relevant full-loop test over the **mock LLM** — a tick advances agents deterministically, and `POST /chat` returns a canned in-character reply (no real model call)
3. **Syntax/import (Python):** `python3 -m py_compile {changed_py_files}` and an import check for changed modules
4. **Lint:** `ruff check backend tests` (backend)
5. **Frontend:** build the client and run its component tests; the interpolation logic and the input/walkability guard are unit-tested
6. **Contract consistency:** verify the REST messages match ARCHITECTURE.md §Contracts and the contract tests
7. **Acceptance criteria:** go through each criterion from the issue and verify against the phase DoD in ROADMAP.md

Record pass/fail for each check. **Tests are part of the work** — a feature lands with the tests that encode its acceptance (see ARCHITECTURE §Testing and CI).

Note: frontend render/visual behavior (gliding sprites, day/night, speech bubbles) and the smoothness of interpolation are partly a manual check; cover the host-testable logic (interpolation math, walkability guard, polling/reconnect) with automated tests and defer the purely visual confirmation to the per-phase DoD.

#### 2e. Commit

```bash
git add {specific files created/modified}
git commit -m "$(cat <<'EOF'
HVN-xxx: {title}

{1-2 sentence summary of what was implemented}

Closes #{github-issue-number}

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 2f. Push

```bash
git push
```

#### 2g. Close issue with summary

```bash
gh issue close {issue-number} --comment "$(cat <<'EOF'
## Implementation Summary

**Commit:** {commit-hash}
**Files changed:** {count}

### What was done
{bullet list of key changes}

### Validation
{pass/fail status for each check}

### Acceptance criteria
{checklist with pass/fail}
EOF
)"
```

#### 2h. Log progress

Append to the in-memory execution log:
- Issue ID, title
- Commit hash
- Files changed (list)
- Validation results (including test pass/fail)
- Status: success/partial/failed

### Step 3: Handle failures

If implementation or validation fails for an issue:

1. Do NOT commit broken code
2. Stash or revert changes: `git checkout -- .`
3. Add a comment to the GitHub issue explaining what failed
4. Log the failure
5. Ask the user: continue to next issue (if no dependency), or stop?

### Step 3b: Version bump on completion

**Do NOT bump the version automatically.** Never change the version (VERSION file, RELEASE.txt, or git tag) without explicit user confirmation. When a phase/version's issues are all done, report completion and let the user decide whether/when to release via `/release-version`.

If — and only if — the user confirms a release:

1. Determine the target semver from the version notation `A.B.C` (`A` = global/roadmap version, `B` = phase, `C` = post-release fix). Roadmap phase `vA.B` → semver `A.B.0` (e.g. v1.1 → `1.1.0`).

2. Update `README.md` with a version note if appropriate

3. Update or create `RELEASE.txt` -- prepend a new version entry:

```
Version {version} ({YYYY-MM-DD})
---------------------------
- {HVN-xxx title}: {1-sentence summary of what was implemented}
- {HVN-xxx title}: {1-sentence summary}
...
```

4. Commit the version bump:

```bash
git add README.md RELEASE.txt
git commit -m "$(cat <<'EOF'
Release v{version} -- Haven {version vN} complete

All {count} issues implemented and validated.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

5. Tag the release:

```bash
git tag -a v{version} -m "v{n}: {version summary from ROADMAP}"
```

6. Report to user: `v{n} complete -> version bumped to {version}, tagged v{version}`

If some issues failed or were skipped, do NOT bump the version. Note in the execution report that the version is incomplete. (You can also delegate steps 3b–6 to `/release-version`.)

### Step 4: Generate execution report

After all issues are processed (or on stop), generate:
`specification/roadmap/implementation/v{n}-execution-report.md`

```markdown
# Version v{n} -- Execution Report

**Date:** {date}
**Branch:** {branch name}
**Label:** {label}
**Target version:** {version}
**Executed by:** Claude Code

## Summary

| Status | Count |
|--------|-------|
| Completed | {n} |
| Failed | {n} |
| Skipped | {n} |
| Remaining | {n} |

## Issues

| # | HVN ID | Title | Phase | Status | Commit | Files | Tests |
|---|--------|-------|-------|--------|--------|-------|-------|
| 1 | HVN-001 | FastAPI backend owns the world | v1.1 | completed | a1b2c3d | 3 | pass |
| ... | ... | ... | ... | ... | ... | ... | ... |

## Detailed Results

### HVN-001: FastAPI backend owns the world

**Status:** completed
**Commit:** a1b2c3d
**Files changed:**
- `backend/...` (created)

**Validation:**
- [x] Unit + contract tests: pass
- [x] Acceptance criteria: all pass
- [ ] Frontend visual confirmation: deferred to per-phase manual DoD

---

### HVN-002: ...

## Next Steps

{List of remaining issues not yet executed, with their dependencies}
```

Commit and push this report:

```bash
git add specification/roadmap/implementation/v{n}-execution-report.md
git commit -m "$(cat <<'EOF'
Add v{n} execution report

{n} issues completed, {n} failed, {n} remaining.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

## Important Rules

- **One issue at a time.** Never work on multiple issues simultaneously.
- **Dependency order.** Never start an issue whose dependencies are not closed.
- **Clean commits.** Each issue = one commit. No mixing work across issues.
- **No broken code.** Only commit code that passes validation (tests included).
- **Tests ship with the feature.** Every issue lands with the tests that encode its acceptance — no "tests later."
- **Backend in cells, frontend in motion.** Never compute pixel animation on the backend; never put world logic or the model key in the frontend (from v1).
- **API key is backend-only.** From v1 the Anthropic key lives in server config and never reaches the browser.
- **Contracts stay stable.** A wire-format change updates ARCHITECTURE.md and its contract test in the same commit.
- **Drives drive the body, the model gives the voice.** The simulation decides what a character does; the model only gives its voice — never let chat drive movement.
- **Ask on ambiguity.** If an issue description is unclear, ask the user rather than guessing.
- **Progress updates.** Print a short status line after each issue completes.
