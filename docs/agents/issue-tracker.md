# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- `.scratch/` is **gitignored** — it holds ephemeral, short-living issues only (local scaffolding, not committed).
- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is a **durable doc**, promoted to `docs/PRD.md` (committed, alongside `brief.md`) — not kept in `.scratch/`.
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` (ephemeral, gitignored)
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
