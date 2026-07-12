# Working with this repo

## Multi-computer sync workflow

The user works on this project from two computers (this work desktop + a personal
computer) and relies on git as the sync point between them.

- **Commit after each completed task.** As soon as a feature/fix is done and
  verified, create a commit for it — don't batch unrelated work into one commit.
- **Push at end of day, without asking first.** When the user signals they're
  done for the session (e.g. "done for today", "wrapping up", "that's it for
  now"), commit any remaining changes and `git push` to `origin main`
  immediately — no confirmation needed for this specific action. This is a
  standing exception to the usual "confirm before pushing" rule, scoped only
  to this repo and only to end-of-day pushes.
- Mid-session pushes still follow the normal rule (ask first) unless the user
  says otherwise.
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
