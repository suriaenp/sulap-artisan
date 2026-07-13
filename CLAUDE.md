# Working with this repo

## Multi-computer sync workflow

The user works on this project from two computers (this work desktop + a personal
computer) and relies on git as the sync point between them.

- **Commit and push after every completed update, automatically, without
  asking first.** As soon as a feature/fix/doc update is done and verified
  (including `PROJECT_NOTES.md` updates), commit it and immediately
  `git push` to `origin main` — don't wait for end of day and don't batch
  unrelated work into one commit. This is a standing exception to the usual
  "confirm before pushing" rule, scoped only to this repo. The user relies on
  `origin/main` being current after every change so the other machine can
  pull and continue at any time.
- Git commits + pushes ARE the backup — no separate local copy/zip is
  needed. Every commit lives in the local `.git` history on this machine,
  and pushing mirrors that history to GitHub as the off-machine backup.
- Before pushing, always make sure the local branch is up to date with
  `origin/main` (pull/rebase if needed) to avoid diverging history between the
  two machines.

## Verify localhost after every change

Whenever you commit or otherwise finish an update to this repo, start (or
reuse) the dev server preview and confirm the app actually loads — page
renders, no console errors, no blank/broken screen — before considering the
task done. Do this every time, not just for changes that look risky.

## Progress & documentation tracking

The user needs a running record of what's built and what rules are baked in,
for future documentation. Two things together serve as that record — keep
both current, don't introduce a third (no separate CHANGELOG.md):

- **`PROJECT_NOTES.md`** is the living reference: every tab's function, every
  business rule, what's wired vs. still mock, and known gaps. **Whenever a
  change modifies a tab's behavior or adds/changes a business rule, update
  the relevant section of PROJECT_NOTES.md in the same session** — this is a
  required step, not optional cleanup.
- **Git commit history** is the dated "what changed when" trail. Write
  commit messages that describe what was built/fixed, not just "update
  files". Commit the PROJECT_NOTES.md update alongside (or immediately
  after) the code change it documents, matching the existing pattern in this
  repo's history (e.g. `254c082` code change → `ba372f8` matching notes
  update).
