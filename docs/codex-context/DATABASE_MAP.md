# Database Map

## Connection files

| File | Purpose | Database |
| --- | --- | --- |
| `src/lib/db/hospital-db.ts` | Active clinical DB pool and `hospitalQuery` helper | `hospital_cs` |
| `src/lib/db/legacy-db.ts` | Legacy DB pool and `query` helper | Legacy `DATABASE_URL` |

## Database boundary

- `hospital_cs` is the active clinical database and should be used for new clinical workflows.
- `legacy-db.ts` remains for older patient CRUD paths and should not be used for new clinical features.

## Known tables and feature mapping

| Table | Used by | Notes |
| --- | --- | --- |
| `patients` | triage, clinical notes, patient lookup, agent context | Master patient data in `hospital_cs`. |
| `registrations` | triage visit context, assigned-patient lookup | Links patients to nurses and doctors. |
| `external_examinations` | SOAP history, triage, clinical follow-up | Doctor-authored baseline SOAP data. |
| `clinical_notes` | clinical-note generation and retrieval | AI-generated or nurse-captured derived clinical output. |
| `triage_visits` | visit context and triage history | Created/managed in `visit-context.ts`. |
| `conversations` | general conversation history | Patient- or visit-scoped chat memory. |
| `nurse_chat_sessions` | nurse assistant session history | Supports multi-session nurse chat. |
| `nurse_chat_conversations` | nurse assistant message history | Stores user/assistant chat turns. |
| `agent_interaction_logs` | audit log of agent requests | Used by log admin UI. |
| `agent_data_source_logs` | data-source observability details | Shows which tables were read. |
| `agent_performance_logs` | latency/performance observability | Shows timing and runtime stats. |
| `indirect_staff_nurses` | nurse identity lookup | Used in auth and routing. |
| `indirect_staff_doctors` | doctor name/specialization lookup | Used in patient-assignment summaries. |
| `darsi_ph_stok_obat` | medicine stock lookup | Used by operational tools. |
| `soap_keyword_icd` | ICD keyword matching | Used by ICD search. |
| `icd10_diagnoses` | ICD reference validation/search | Used by ICD search and code resolution. |

## Feature-to-table notes

- Patient data, clinical notes, SOAP, ICD, conversations, and logs all center on `hospital_cs`.
- `src/lib/patients/*` still talks to the legacy schema (`pasien`, `medis_pasien`) via `legacy-db.ts`.
- The auth/session helpers read `perawat` and log admin credentials, then use `hospital_cs` for identity checks where needed.
- The triage workflow writes `triage_visits` and may backfill `clinical_notes` and `conversations` with visit IDs.

## Safety notes

- Do not migrate new clinical workflows back to the legacy database.
- Be careful when changing table names in agents or tools because those names are also emitted in observability logs.
- Some helpers create tables or indexes on demand. Treat those as schema-support code, not application logic.

