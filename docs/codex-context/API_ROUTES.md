# API Routes

## Route summary

| Route | Methods | Input | Output | Main helpers | Database | Safety notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/api` | `GET`, `POST`, `DELETE`, `PUT` | `GET`: none. `POST`: patient body. `DELETE`/`PUT`: `id` query param, plus body for `PUT`. | JSON patient list or CRUD result objects. | `getCurrentPerawat`, `getHospitalPatientsByPerawatUsername`, `createPatient`, `deletePatient`, `updatePatientMedis`, `revalidatePath`. | `GET` uses `hospital_cs`; CRUD uses legacy DB. | Mixed legacy/current behavior. New clinical work should not add legacy DB usage here. |
| `/api/chat` | `POST` | `{ message, patientId?, registrationId?, triageVisitId? }` | `{ success, message, toolsUsed, timestamp }` or error JSON. | `chat`, `getClinicalLlmConfig`, interaction/performance logs, visit resolution, nurse auth. | `hospital_cs` | Core triage chat route. Logs must stay aligned with tool usage. |
| `/api/clinical-notes` | `GET`, `POST` | `GET`: `patientId`, optional `registrationId`, `triageVisitId`, `limit`. `POST`: clinical note body. | `{ note }` or `{ notes }` for `GET`, `{ note }` for `POST`. | `getLatestClinicalNote`, `listClinicalNotes`, `createClinicalNote`, nurse auth, `hospitalQuery`. | `hospital_cs` | Enforces allowed `source` and `status`. |
| `/api/clinical-notes/generate` | `POST` | clinical generation payload with patient/exam context | JSON result from generated clinical note flow, plus logs | triage agent, observability logs, `buildMedicationRecommendation`, SOAP follow-up, clinical note helpers | `hospital_cs` | Derived clinical output only; doctor-authored notes are still separate. |
| `/api/external-examinations` | `GET`, `PATCH` | `GET`: `patientId`. `PATCH`: body with `patientId`, `soap_objective`, exam details. | Examination JSON or update result with refreshed SOAP follow-up. | `getCurrentPerawat`, `hospitalQuery`, `regenerateSoapAssessmentPlan`. | `hospital_cs` | Updates SOAP objective and then recomputes follow-up. |
| `/api/general-chat` | `POST`, `GET` | `POST`: `{ message }` | Chat result or status JSON. | `generalGuidanceChat`, `getGeneralGuidanceAgentStatus`. | none directly | General guidance, not data modification. |
| `/api/nurse-assistant` | `POST`, `GET` | `POST`: `{ message }` | Operational chat result or status JSON. | `operationalChat`, `getOperationalAgentStatus`. | `hospital_cs` | Tool-enabled operational assistant. |
| `/api/nurse-chat` | `POST` | `action`, `message`, `sessionId`, `createNewSession` | Session creation, chat response, history, or status JSON. | nurse chat history, routing, logs, model config. | `hospital_cs` | Hybrid routing can call both operational and general agents. |
| `/api/triage-visits` | `GET`, `POST` | `GET`: `patientId`. `POST`: `{ patientId }`. | Visit list and active visit IDs, or created visit with carried note. | `resolveVisitContext`, `createTriageVisit`, `createClinicalNote`, `getLatestClinicalNote`, `listVisitSummaries`. | `hospital_cs` | Can clone prior note into a new visit context. |
| `/api/auth/login` | `POST` | Login body with username/password | Session result and redirect target | admin log auth, nurse auth, `hospitalQuery` | `hospital_cs` | Handles both nurse and log-admin login paths. |
| `/api/auth/logout` | `POST` | none | logout JSON | session cookie helpers | none directly | Clears both nurse and log-admin cookies. |
| `/api/auth/me` | `GET` | none | current nurse session JSON | `getCurrentPerawat` | `hospital_cs` | Session check only. |
| `/api/auth/register` | `POST` | nurse registration body | registration result JSON | `hospitalQuery`, nurse-auth helpers | `hospital_cs` | Registration is tied to active nurse records. |
| `/api/log-admin/interactions/[id]` | `GET` | path param `id` | interaction log plus source/performance logs | admin auth, interaction log lookup, observability lookup | `hospital_cs` | Read-only audit endpoint. |

## Safety notes

- The mixed legacy/current behavior in `/api` is intentional and should not be expanded casually.
- Most clinical routes assume `hospital_cs` and should stay there.
- Response shapes are part of the current UI contract; keep them stable when editing routes.

