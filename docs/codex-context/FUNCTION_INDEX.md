# Function Index

## Important exported functions

| Function | File | Purpose | Inputs | Outputs | DB dependency | Called by | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hospitalQuery` | `src/lib/db/hospital-db.ts` | Query helper for `hospital_cs` | SQL text, params | `pg` query result | `hospital_cs` | Most clinical/auth/logging helpers | Active clinical DB path. |
| `query` | `src/lib/db/legacy-db.ts` | Legacy query helper | SQL text, params | `pg` query result | Legacy DB | Old patient CRUD | Preserved for legacy behavior. |
| `getCurrentPerawat` | `src/lib/auth/nurse-auth.ts` | Resolve current nurse session | none | `PerawatSession \| null` | `hospital_cs` | App layouts, routes, agents | Reads signed cookie and validates against `perawat`. |
| `getCurrentLogAdmin` | `src/lib/auth/admin-log-auth.ts` | Resolve log admin session | none | `AdminLogSession \| null` | none directly | log-admin pages/routes | Env-backed login cookie. |
| `logoutNurseClient` | `src/lib/auth/logout-client.ts` | Client logout and redirect | none | Promise<void> | none | Header/sidebar UI | Redirects to portal URL. |
| `logoutAdminLogClient` | `src/lib/auth/logout-client.ts` | Client logout for admin | none | Promise<void> | none | Log admin UI | Redirects to `/login`. |
| `generalGuidanceChat` | `src/lib/agents/general-agent.ts` | General guidance agent call | message, history | chat result object | none | `/api/general-chat`, nurse router | No DB writes. |
| `operationalChat` | `src/lib/agents/operational-agent.ts` | Operational agent call | message, history | chat result object | `hospital_cs` via tools | `/api/nurse-assistant`, nurse router | Uses operational tools. |
| `chat` | `src/lib/agents/triage-agent.ts` | Main clinical triage agent | message, patientId?, visit context | chat result object | `hospital_cs` | `/api/chat`, evaluation runner | Core clinical agent. |
| `generateClinicalNotesFromSoap` | `src/lib/agents/triage-agent.ts` | Derived clinical-note generation | prompt | generated note result | `hospital_cs` | `app/api/clinical-notes/generate` | AI-generated derived content. |
| `routeNurseChat` | `src/lib/conversations/nurse-chat-router.ts` | Classify and route nurse chat | message, history | routed response | none directly | `/api/nurse-chat` | Delegates to general/operational agents. |
| `getNurseChatStatus` | `src/lib/conversations/nurse-chat-router.ts` | Report routing readiness | none | status object | none | `/api/nurse-chat` | Useful for health/status UI. |
| `saveConversation` | `src/lib/conversations/conversations.ts` | Persist conversation turn | scope, role, message | row metadata | `hospital_cs` | triage agent and workflows | Chat memory. |
| `getConversationHistory` | `src/lib/conversations/conversations.ts` | Load chat history | scope, limit | rows | `hospital_cs` | triage agent | Used for context windows. |
| `createClinicalNote` | `src/lib/clinical/clinical-notes.ts` | Insert a clinical note | `ClinicalNoteInput` | `ClinicalNote` | `hospital_cs` | triage workflows | Stores derived note records. |
| `getLatestClinicalNote` | `src/lib/clinical/clinical-notes.ts` | Load latest note | patientId, nurse/visit context | `ClinicalNote \| null` | `hospital_cs` | agents, routes, workflows | Supports visit-aware retrieval. |
| `listClinicalNotes` | `src/lib/clinical/clinical-notes.ts` | Load note history | patientId, limit, context | `ClinicalNote[]` | `hospital_cs` | `/api/clinical-notes` | Visit-aware history. |
| `resolveNurseId` | `src/lib/clinical/visit-context.ts` | Map current nurse to internal ID | none | `number \| null` | `hospital_cs` | visit workflow | Used before creating triage visits. |
| `ensureVisitInfrastructure` | `src/lib/clinical/visit-context.ts` | Ensure visit tables/indexes | none | Promise<void> | `hospital_cs` | visit workflow | Schema-support helper. |
| `createTriageVisit` | `src/lib/clinical/visit-context.ts` | Create a triage visit row | patientId | `VisitSummary` | `hospital_cs` | `/api/triage-visits` | Creates active visit entry. |
| `resolveVisitContext` | `src/lib/clinical/visit-context.ts` | Resolve active visit context | patientId, preferred visit | `VisitContext` | `hospital_cs` | agents, routes, workflows | Central visit lookup. |
| `listVisitSummaries` | `src/lib/clinical/visit-context.ts` | Visit summary list | patientId | `VisitSummary[]` | `hospital_cs` | `/api/triage-visits` | Drives visit selector UI. |
| `searchClinicalIcdReferences` | `src/lib/clinical/icd-search.ts` | Search ICD references by text | text, limit | `ClinicalIcdReference[]` | `hospital_cs` | agent tools, clinical updates | Used for symptom-to-ICD ranking. |
| `resolveClinicalIcdCodes` | `src/lib/clinical/icd-search.ts` | Resolve ICD code list | codes[] | `ClinicalIcdReference[]` | `hospital_cs` | clinical update flow | Validation layer. |
| `buildMedicationRecommendation` | `src/lib/clinical/medication-recommendations.ts` | Symptom/ICD-based medication guidance | args object | string | none directly | clinical note generation | Deterministic helper. |
| `createClinicalNoteFromChatUpdate` | `src/lib/clinical/chat-clinical-updates.ts` | Turn chat update into note | args object | `ChatClinicalUpdateResult` | `hospital_cs` | triage agent/tools | Stores derived output. |
| `saveAgentInteractionLog` | `src/lib/logging/agent-interaction-logs.ts` | Save request/response log | log input | `{ id, created_at }` | `hospital_cs` | `/api/chat`, `/api/nurse-chat`, log admin | Audit trail anchor. |
| `saveAgentDataSourceLogs` | `src/lib/logging/agent-observability-details.ts` | Save source-log rows | entries[] | void | `hospital_cs` | logging flows | Records table reads. |
| `saveAgentPerformanceLog` | `src/lib/logging/agent-observability-details.ts` | Save performance metrics | log input | void | `hospital_cs` | logging flows | Stores latency/runtime metrics. |
| `listAgentInteractionLogs` | `src/lib/logging/agent-interaction-logs.ts` | List audit logs | limit | `AgentInteractionLog[]` | `hospital_cs` | log-admin page | UI data source. |
| `getHospitalPatientsByPerawatUsername` | `src/lib/patients/get-hospital-patients.ts` | Assigned-patient lookup | username, limit | row array | `hospital_cs` | `/api`, operational tools | Active patient list helper. |
| `createPatient` | `src/lib/patients/post-patient.ts` | Legacy patient create | data | patient id | Legacy DB | `/api` POST | Old schema path. |
| `updatePatientMedis` | `src/lib/patients/update-patient.ts` | Legacy medical update | patientId, data | updated row | Legacy DB | `/api` PUT | Old schema path. |
| `deletePatient` | `src/lib/patients/delete-patient.ts` | Legacy delete | patientId | boolean | Legacy DB | `/api` DELETE | Old schema path. |
| `getActiveNavItem` | `src/lib/navigation/app-nav.ts` | Resolve active sidebar item | pathname | `NavItem` | none | header/sidebar UI | Presentation helper. |

