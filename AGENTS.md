# AGENTS.md

Guidance for AI agents working in this repository.

## What this repo is

**SAT Question Bank** is a **data-only** archive — not a runnable web app or API server. It contains ~9,630 College Board–style SAT/PSAT practice questions as JSON, plus cached index files that mirror a question-bank API layout.

There are **no** `package.json`, Docker services, databases, or application entrypoints. Development work here is typically **consuming, validating, or transforming** the JSON data.

## Layout

```
archive/
├── lookup.json           # Taxonomy: assessments, domains, skills, metadata
├── get-questions.json    # Six cached question-list responses (by assessment/test/domain)
├── 99/                   # SAT
│   ├── 1/                # Reading and Writing
│   └── 2/                # Math
├── 100/                  # PSAT/NMSQT & PSAT 10
└── 102/                  # PSAT 8/9
```

Per-question files live at `archive/{assessmentId}/{testId}/{external_id}.json`. Most use the digital SAT `mcq` shape (`stem`, `stimulus`, `answerOptions`, `correct_answer`). Some Math items use legacy `*-DC.json` naming with a different schema (`prompt`, `answer.choices`, etc.).

## Cursor Cloud specific instructions

- **No dependency install step.** Python 3 (stdlib) is sufficient for JSON validation and ad-hoc scripts. No `npm install`, Docker, or database is required.
- **No long-running “app” in-repo.** To browse files over HTTP locally, use: `python3 -m http.server 8765 --directory archive` from the repo root (serves under `/workspace/archive` when run with that path).
- **Lint / test equivalents:** Run JSON parse validation over `archive/**/*.json` and optionally verify index → file resolution (see validation snippet in setup docs or re-run the cloud agent’s validation script).
- **Core workflow to verify data:** (1) load `archive/lookup.json` for taxonomy, (2) load `archive/get-questions.json` for list buckets, (3) resolve `external_id` from a list entry to `archive/{asmtEventId}/{test}/{external_id}.json`.
- **Assessment IDs:** `99` = SAT, `100` = PSAT/NMSQT & PSAT 10, `102` = PSAT 8/9. Test IDs: `1` = Reading and Writing, `2` = Math.
