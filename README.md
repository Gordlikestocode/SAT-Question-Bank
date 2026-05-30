# SAT Question Bank

A simple static SAT question bank powered by the archived question JSON in this repository.

## Run locally

Serve the repository root with any static web server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The app loads SAT questions from `archive/get-questions.json` and fetches individual question bodies from `archive/99/...` as you select them.

## Features

- Bluebook-inspired practice test layout with a header, question pane, answer choices, and navigation.
- Filters for section, difficulty, domain, skill, and whether the question is active in Bluebook.
- Question search by ID, domain, skill, and metadata.
- Multiple-choice and student-produced response question rendering.
- Answer checking and explanation display.