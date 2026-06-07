# Clinical Workflows

## Patient triage workflow

- The triage page loads patient data and exam context.
- `app/api/chat` routes the request to the triage agent.
- The triage agent may use ICD search, patient summary, visit context, conversation history, and clinical notes.
- The response is logged with data-source and performance metadata.

## Clinical notes generation workflow

- `app/api/clinical-notes/generate` invokes the triage agent for derived output.
- The route combines exam context, medication recommendation, SOAP follow-up, and visit context.
- `createClinicalNote` stores the derived note in `clinical_notes`.
- This is AI-generated or nurse-captured derived output, not the original doctor-authored note.

## SOAP retrieval and generation workflow

- `app/api/external-examinations` loads and updates SOAP data from `external_examinations`.
- `regenerateSoapAssessmentPlan` can recompute assessment and plan text.
- SOAP follow-up keeps the current complaint context stable and avoids drifting to a different complaint.

## ICD search workflow

- `src/lib/clinical/icd-search.ts` reads keyword and diagnosis tables.
- `searchClinicalIcdReferences()` ranks candidate references by symptom text.
- `resolveClinicalIcdCodes()` validates codes against the active ICD table.

## Conversation history workflow

- `src/lib/conversations/conversations.ts` stores chat memory in `conversations`.
- `src/lib/conversations/nurse-chat-history.ts` stores multi-session nurse chat in `nurse_chat_sessions` and `nurse_chat_conversations`.
- `visit-context.ts` can backfill and attach visit IDs to existing conversation and note records.

## Nurse assistant workflow

- `app/api/nurse-chat` classifies each message as operational, general guidance, hybrid, or out-of-scope.
- Operational messages go to the operational agent.
- General guidance messages go to the general agent.
- Hybrid requests combine both responses.

## Logging and audit workflow

- `src/lib/logging/agent-interaction-logs.ts` stores request/response-level logs.
- `src/lib/logging/agent-observability-details.ts` stores source-level and runtime-performance logs.
- `app/log-admin/page.tsx` and `app/api/log-admin/interactions/[id]` expose the audit UI and detail view.

## Where AI generates derived output

- Triage agent responses.
- Clinical note generation.
- SOAP follow-up recommendation text.
- Medication recommendation text.
- Operational summaries for assigned patients.

## Where doctor-authored notes are stored

- Doctor-authored or upstream SOAP content lives in `external_examinations`.
- Derived or updated clinical note content lives in `clinical_notes`.

## Safety notes

- Do not treat generated clinical notes as doctor-authored records.
- Keep the active database boundary on `hospital_cs`.
- Legacy patient CRUD is outside the new clinical workflow and should not be extended casually.

