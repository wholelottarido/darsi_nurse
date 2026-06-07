# File Map

## Safe to modify

- `src/components/layout/*` for shell, header, sidebar, theme, and breadcrumb UI.
- `src/components/chat/MarkdownMessage.tsx` for chat message rendering.
- `src/components/log-admin/*` for observability UI.
- `src/components/ui/*` for shared primitives.
- `app/(app)/*` pages for dashboard, pasien, triage, and assistant UI.
- `app/login/page.tsx`, `app/register/page.tsx`, `app/log-admin/page.tsx`, `app/page.tsx`.

## Handle carefully

- `src/lib/agents/*` because prompt text, routing, and model selection affect clinical behavior.
- `src/lib/tools/*` because tool inputs and outputs are consumed by agents and logs.
- `src/lib/clinical/*` because these helpers control clinical-note generation, SOAP, ICD, and visit state.
- `src/lib/auth/*` because session behavior affects route access.
- `src/lib/logging/*` because these feed the audit trail.
- `app/api/*` because response contracts are user-visible and often consumed by multiple pages.
- `src/lib/db/hospital-db.ts` and `src/lib/db/legacy-db.ts` because they define database boundaries.

## Old or legacy

- `src/lib/db/legacy-db.ts` is the preserved legacy connection.
- `src/lib/patients/*` uses the legacy database for patient CRUD and should be treated as old behavior.
- `src/lib/agents/triage-agent.ts.old` is an older triage agent backup.
- `src/lib/tools/agent-tools.ts.bak` is an older tool backup.

## Large files that should not be fully scanned unless needed

- `src/lib/agents/triage-agent.ts`
- `src/lib/tools/agent-tools.ts`
- `src/lib/clinical/chat-clinical-updates.ts`
- `src/lib/clinical/visit-context.ts`
- `src/lib/conversations/nurse-chat-history.ts`
- `src/lib/logging/agent-observability-details.ts`
- `app/(app)/triage-igd/[patientId]/page.tsx`
- `src/components/log-admin/log-admin-dashboard.tsx`

## Important responsibilities

| File | Responsibility | Notes |
| --- | --- | --- |
| `src/lib/navigation/app-nav.ts` | Sidebar navigation metadata | Safe UI-adjacent helper. |
| `src/lib/auth/nurse-auth.ts` | Nurse session and current-user lookup | Uses `hospital_cs`. |
| `src/lib/auth/admin-log-auth.ts` | Log admin session and credentials | Uses env-backed login. |
| `src/lib/clinical/visit-context.ts` | Triage visit creation and resolution | Creates supporting tables if needed. |
| `src/lib/clinical/clinical-notes.ts` | Clinical note read/write helpers | Uses `hospital_cs`. |
| `src/lib/conversations/conversations.ts` | General conversation persistence | Uses `hospital_cs`. |
| `src/lib/conversations/nurse-chat-history.ts` | Nurse chat sessions/messages | Uses `hospital_cs`. |
| `src/lib/logging/agent-interaction-logs.ts` | Interaction log persistence | Uses `hospital_cs`. |
| `src/lib/logging/agent-observability-details.ts` | Data source and performance logs | Uses `hospital_cs`. |
| `src/lib/patients/*` | Legacy patient CRUD helpers | Uses legacy DB. |

