# Evaluation

## Folder contents

- `evaluation/metrics/` contains metric implementations.
- `evaluation/runners/` contains evaluation runner scripts and test cases.
- `evaluation/results/` contains generated JSON and markdown outputs.

## Metrics used

- `accuracy.ts` calculates token overlap accuracy.
- `f1.ts` calculates token overlap F1.
- `perplexity.ts` is a project-specific heuristic score based on F1 and length penalty.

## Runner files

- `evaluation/runners/runner.ts` runs offline evaluation and writes summary outputs.
- `evaluation/runners/live_runner.ts` runs the live database-backed evaluation using the triage agent.
- `evaluation/runners/data.ts` contains the test cases.

## Result files

- `evaluation/results/accuracy_results.json`
- `evaluation/results/f1_results.json`
- `evaluation/results/perplexity_results.json`
- `evaluation/results/all_metrics_results.json`
- `evaluation/results/live_all_metrics_results.json`
- `evaluation/results/live_db_metrics_results.json`
- `evaluation/results/hasil_scoring.md`
- `evaluation/results/hasil_scoring_db.md`
- `evaluation/results/hasil_scoring_live.md`

## How to run evaluation

- Read the runner you need first.
- Use the repo-specific evaluation script or run the TypeScript runner directly if the environment already supports it.
- The live runner imports the triage agent and may touch the active clinical database.

## What the metrics mean here

- `accuracy`: fraction of expected tokens found in the generated answer.
- `F1`: overlap balance between generated and expected tokens.
- `perplexity`: project heuristic, lower is treated as better in this repo.

## Safety notes

- These scripts are evaluation support, not runtime app code.
- Some files in `evaluation/` are outputs, not source logic.
- The live runner should be treated carefully because it exercises the real triage agent.

