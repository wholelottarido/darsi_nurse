# Phase 3 Tool-Calling Evaluation

The tool-calling performance test was conducted using 30 nurse workflow executions. Clinical summary, objective summary, and update kondisi pasien each achieved 100.0% tool-calling success with 0.0% wrong tool calls and 0.0% missing tool calls across the required stages. Generate clinical notes is implemented as a direct endpoint (Direct endpoint / N/A) and is therefore reported as N/A for tool-calling metrics while still contributing to task success and latency analysis. Across tool-required stages, the weighted average latency was 23346 ms; the overall average across all stages was 38646 ms.

| Workflow Stage | Expected Tool | Total Cases | Correct Tool Calls | Missing Tool Calls | Wrong Tool Calls | Tool-Calling Success Rate | Task Success Rate | Average Latency |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Clinical summary | clinical_summary | 30 | 30 | 0 | 0 | 100.0% | 100.0% | 1205 ms |
| Objective summary | external_examinations_objective_summary | 30 | 30 | 0 | 0 | 100.0% | 100.0% | 1016 ms |
| Update kondisi pasien | clinical_notes_chat_update | 30 | 30 | 0 | 0 | 100.0% | 100.0% | 67815 ms |
| Generate clinical notes | Direct endpoint / N/A | 30 | N/A | N/A | N/A | N/A | 100.0% | 84546 ms |
