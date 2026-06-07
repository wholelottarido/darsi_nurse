# Tools

## Tool: `check_medicine_availability`

Source:
- `src/lib/tools/operational-tools.ts`

Purpose:
- Look up pharmacy stock by drug name or code.

Input:
- `{ drugName: string }`

Output:
- `{ query, total, items }`

Database:
- `hospital_cs`

Clinical use:
- Operational stock lookup for nurses.

Error/fallback:
- Returns an error from the tool execution if the query is empty or the DB lookup fails.

## Tool: `list_assigned_patients`

Source:
- `src/lib/tools/operational-tools.ts`

Purpose:
- List patients currently assigned to the logged-in nurse.

Input:
- `{ limit?: number }`

Output:
- `{ total, patients }`

Database:
- `hospital_cs`

Clinical use:
- Nurse workload and patient list management.

Error/fallback:
- Requires login; throws unauthorized if no current nurse is found.

## Tool: `get_assigned_patient_summary`

Source:
- `src/lib/tools/operational-tools.ts`

Purpose:
- Return a compact summary of one assigned patient by name, NRM, or ID.

Input:
- `{ patientQuery: string }`

Output:
- `{ found, patient }`

Database:
- `hospital_cs`

Clinical use:
- Quick patient summary during operational chat.

Error/fallback:
- Returns `found: false` when there is no match.

## Tool: `searchPatient`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Search patients by name or medical record number.

Input:
- Search text through the tool schema in the file.

Output:
- Patient list payload from the legacy patient schema.

Database:
- Legacy DB

Clinical use:
- Older patient lookup flow.

Error/fallback:
- Returns a tool error object if the query fails.

## Tool: `getPatientHealthSummary`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Get a patient snapshot with age, BMI, allergy, and medical record context.

Input:
- `patientId`

Output:
- `{ success, patient }`

Database:
- `hospital_cs`

Clinical use:
- Triage summary and clinical reasoning.

Error/fallback:
- Returns `{ success: false, error }` if the patient does not exist or the query fails.

## Tool: `monitorPatientStatus`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Read a patient status snapshot.

Input:
- `patientId`

Output:
- `{ success, status, lastUpdated }`

Database:
- `hospital_cs`

Clinical use:
- Monitoring or status checks.

Error/fallback:
- Returns a not-found or query error payload.

## Tool: `updatePatientCondition`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Update a patient medical field in `medical_record`.

Input:
- `patientId`, `field`, `value`

Output:
- `{ success, patientId, updatedField, newValue, patient, note }`

Database:
- `hospital_cs`

Clinical use:
- Clinical condition updates in the new hospital schema.

Error/fallback:
- Validates the `medical_record` column and returns a clear error if it is missing.

## Tool: `getPatientAllergies`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Fetch allergy context for a patient.

Input:
- `patientId`

Output:
- `{ success, patient, warning }`

Database:
- `hospital_cs`

Clinical use:
- Medication safety and allergy checks.

## Tool: `getPatientMedicalHistory`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Fetch history and blood type context.

Input:
- `patientId`

Output:
- `{ success, patient }`

Database:
- `hospital_cs`

Clinical use:
- Clinical background and safety checks.

## Tool: `searchDiagnosaWithTriage`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Search ICD references and assign a triage level from symptoms.

Input:
- `symptoms`, optional `limit`

Output:
- Search result with ICD codes, triage level, and references.

Database:
- `hospital_cs`

Clinical use:
- Symptom-to-ICD triage support.

Error/fallback:
- Returns an empty result when no match is found.

## Tool: `getPatientActionRecommendation`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Summarize next actions based on SOAP, ICD, and patient context.

Input:
- `patientId`

Output:
- Text recommendation string.

Database:
- `hospital_cs`

Clinical use:
- Clinical next-step guidance for triage chat.

## Tool: `updateSoapSubjective`

Source:
- `src/lib/tools/agent-tools.ts`

Purpose:
- Update SOAP subjective text for a patient.

Input:
- `patientId`, `subjective`

Output:
- Updated note payload.

Database:
- `hospital_cs`

Clinical use:
- SOAP follow-up support.

## Internal helper functions worth knowing

- `updateLatestSoapSubjective(patientId, subjective)` in `src/lib/tools/agent-tools.ts` updates the latest SOAP subjective text.
- `getPatientActionRecommendation(patientId)` in `src/lib/tools/agent-tools.ts` wraps the recommendation builder.
- `searchClinicalIcdReferences(text, limit)` in `src/lib/clinical/icd-search.ts` powers the ICD lookup layer.
- `resolveClinicalIcdCodes(codes)` in `src/lib/clinical/icd-search.ts` validates and resolves ICD codes.

