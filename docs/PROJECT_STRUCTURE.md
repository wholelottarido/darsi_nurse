## Project Structure

This repository is organized by runtime responsibility, with a separate context layer for future Codex work.

### Primary source domains

- `app/`: Next.js App Router pages and API routes.
- `src/components/`: shared UI, layout, chat, and log-admin components.
- `src/lib/agents`: triage, general, operational, LLM routing
- `src/lib/tools`: agent tool definitions
- `src/lib/db`: `hospital-db.ts` for active `hospital_cs`, `legacy-db.ts` for preserved legacy access
- `src/lib/clinical`: clinical notes, ICD, SOAP, visit context, chat clinical updates
- `src/lib/patients`: patient CRUD and assigned-patient lookup
- `src/lib/conversations`: nurse chat routing and persistence
- `src/lib/auth`: nurse/admin auth and portal redirects
- `src/lib/logging`: interaction and observability logs
- `src/lib/navigation`: app navigation helpers
- `src/lib/utils`: shared utility helpers
- `evaluation/`: metric implementations, runners, and generated results.
- `database/`: SQL assets, seed material, and migration-related files.
- `scripts/`: database helpers, debug scripts, and dev shell helpers.

### Component domains

- `src/components/layout`: shell, header, sidebar, theme, breadcrumb, profile, logo
- `src/components/chat`: chat-specific UI
- `src/components/log-admin`: log admin UI
- `src/components/ui`: shared shadcn/ui primitives

### Codex context docs

- `docs/codex-context/README.md`: entry point for using the docs with Codex.
- `docs/codex-context/PROJECT_OVERVIEW.md`: product and architecture summary.
- `docs/codex-context/FILE_MAP.md`: where key files live and what is safe to change.
- `docs/codex-context/DATABASE_MAP.md`: `hospital_cs` versus legacy DB usage.
- `docs/codex-context/API_ROUTES.md`: route-by-route API reference.
- `docs/codex-context/AGENTS.md`: agent behavior, routing, and model usage.
- `docs/codex-context/TOOLS.md`: VoltAgent tool catalog.
- `docs/codex-context/CLINICAL_WORKFLOWS.md`: triage, SOAP, ICD, notes, and logging flows.
- `docs/codex-context/FUNCTION_INDEX.md`: exported function index for fast lookup.
- `docs/codex-context/FRONTEND_MAP.md`: pages and component map.
- `docs/codex-context/EVALUATION.md`: evaluation assets and metrics.
- `docs/codex-context/CODEX_TASK_GUIDE.md`: recommended Codex workflow and examples.

### Root cleanup notes

- SQL assets were moved to `database/sql/`.
- Database helper scripts were moved to `scripts/database/`.
- Debug and ad hoc inspection scripts were moved to `scripts/debug/`.
- Dev shell helpers and PM2 launch helpers were moved to `scripts/dev/`.
- Runtime and saved log files were moved to `docs/archive/logs/`.
- Legacy or stray artifacts with unclear runtime ownership were moved to `docs/archive/legacy-files/` or `docs/archive/uncategorized/`.

### Exceptions kept at root

- `AGENTS.md`, `CLAUDE.md`, `package.json`, Next.js config files, and TypeScript config files remain at root because they are repository-control files rather than application docs.
