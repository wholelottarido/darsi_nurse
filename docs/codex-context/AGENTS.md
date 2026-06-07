# Agents

## Agent files

| File | Purpose |
| --- | --- |
| `src/lib/agents/triage-agent.ts` | Main clinical triage agent for patient-specific answers, summary generation, action recommendations, and derived clinical output. |
| `src/lib/agents/general-agent.ts` | General guidance agent for non-operational, non-tool-heavy clinical advice. |
| `src/lib/agents/operational-agent.ts` | Operational nurse agent for stock, assigned patients, and concise operational summaries. |
| `src/lib/agents/llm-router.ts` | Chooses provider/model per profile: clinical, operational, general. |
| `src/lib/agents/llm.ts` | Resolves the base model configuration and creates the default chat model. |
| `src/lib/conversations/nurse-chat-router.ts` | Routes nurse chat requests to general, operational, hybrid, or out-of-scope behavior. |

## Triage agent flow

1. Detects summary, action, subjective-update, and objective-update requests.
2. Reads patient context, latest clinical notes, visit context, and conversation history.
3. May call tools from `src/lib/tools/agent-tools.ts`.
4. Generates clinical text or derived clinical note output.
5. Saves conversation data when applicable.

## General agent flow

- Uses the general guidance model from `llm-router`.
- Answers in a helpful, calm, clinical style.
- Does not write to the database or change notes.
- Is intended for broad guidance and follow-up context.

## Operational agent flow

- Uses the operational model from `llm-router`.
- Has access to operational tools only.
- Focuses on stock lookup, assigned patients, and concise patient summaries.
- Formats assigned-patient output into a list-style response.

## LLM router behavior

- `getClinicalLlmConfig()` resolves the clinical model.
- `getOperationalLlmConfig()` resolves the operational model.
- `getGeneralGuidanceLlmConfig()` defaults to an Ollama general model unless overridden.
- `getClinicalModel()`, `getOperationalModel()`, and `getGeneralGuidanceModel()` create the model instances.

## Ollama / local model usage

- General guidance defaults to Ollama `medgemma:4b` when no general override is set.
- Clinical and operational profiles can use either Ollama or an OpenAI-compatible endpoint depending on env config.
- Default localhost Ollama base URL is `http://localhost:11434/api`.

## Prompt summary

- Triage agent: must use tools when patient ID or symptoms are present and should prefer SOAP/clinical-note aware responses.
- General agent: must not invent hospital data, must not write clinical notes, and should provide safe general guidance.
- Operational agent: should stay focused on stock and patient assignment data and avoid clinical note writes.
- Nurse chat router: classifies the intent before delegating to one or two agents.

## Important safety rules

- Do not swap clinical workflows back to the legacy DB.
- Do not remove tool calls that are required by the triage prompts.
- Keep prompts aligned with actual tool names and route contracts.
- Treat `triage-agent.ts.old` as legacy reference only.

