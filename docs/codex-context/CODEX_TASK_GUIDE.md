# Codex Task Guide

## Recommended workflow

1. Read `README.md` and the most relevant topic doc.
2. Inspect only the source files named there.
3. Make the smallest change that satisfies the task.
4. Verify behavior with the narrowest useful check.
5. Re-read the docs if the task touches a new area.

## Which docs to read first

- UI changes: `FRONTEND_MAP.md`
- API changes: `API_ROUTES.md`
- Agent changes: `AGENTS.md` and `TOOLS.md`
- Clinical workflow changes: `CLINICAL_WORKFLOWS.md`
- Database changes: `DATABASE_MAP.md`
- Function lookup: `FUNCTION_INDEX.md`
- Evaluation changes: `EVALUATION.md`

## Example prompts

- Modifying chat UI: read `FRONTEND_MAP.md`, then inspect `src/components/chat/MarkdownMessage.tsx` and the relevant `app/(app)` page.
- Adding ICD-9: read `CLINICAL_WORKFLOWS.md`, `TOOLS.md`, and `DATABASE_MAP.md`, then inspect `src/lib/clinical/icd-search.ts` and the tool file.
- Updating a `hospital_cs` query: read `DATABASE_MAP.md` and `FUNCTION_INDEX.md`, then inspect the helper that owns the query.
- Editing an agent prompt: read `AGENTS.md`, then inspect the specific agent file and the tool definitions it uses.
- Adding an audit log: read `API_ROUTES.md`, `AGENTS.md`, and `DATABASE_MAP.md`, then inspect the logging helpers.
- Fixing an API route: read `API_ROUTES.md`, then inspect the route file and its called helpers.

## Token-saving rule

- Read the markdown first.
- Inspect only the relevant source files.
- Do not scan the full repository unless a file is marked `needs review` or the docs do not cover it.

## Practical warning

- `hospital_cs` is the active clinical database.
- Legacy patient CRUD still exists and should be treated as old behavior.
- `triage-agent.ts.old` and `agent-tools.ts.bak` are backup files, not primary sources.

