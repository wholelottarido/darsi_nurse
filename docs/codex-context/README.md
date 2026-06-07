# Codex Context

Use these docs first when working in DARSI Nurse. They are meant to reduce source scanning and give a quick map of the repo.

## What to read first

- `PROJECT_OVERVIEW.md` for the product and architecture summary.
- `DATABASE_MAP.md` for `hospital_cs` versus legacy database usage.
- `FILE_MAP.md` for where key code lives and what is safe to change.
- `API_ROUTES.md` before changing any `app/api` handler.
- `AGENTS.md` before changing prompts, routing, or model selection.
- `TOOLS.md` before changing any VoltAgent tool or tool-calling flow.
- `CLINICAL_WORKFLOWS.md` before touching clinical or patient-facing logic.
- `FUNCTION_INDEX.md` when you need the main exported functions without reading full source.
- `FRONTEND_MAP.md` before changing app pages or shared UI.
- `EVALUATION.md` before touching evaluation assets.

## How to use

- Read the smallest relevant doc first.
- Only open the source files named in that doc.
- Prefer the docs over broad repository scans for future Codex tasks.
- If something is marked `legacy`, `possibly temporary`, or `needs review`, inspect it carefully before editing.

## Recommended order for typical tasks

- UI change: `FRONTEND_MAP.md` -> `FILE_MAP.md` -> relevant component file.
- API route change: `API_ROUTES.md` -> `DATABASE_MAP.md` -> relevant route and helper files.
- Agent change: `AGENTS.md` -> `TOOLS.md` -> relevant agent file.
- Clinical workflow change: `CLINICAL_WORKFLOWS.md` -> `DATABASE_MAP.md` -> the specific clinical helper.
- Database change: `DATABASE_MAP.md` -> `FILE_MAP.md` -> the exact DB helper.

