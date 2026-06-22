# Phase 4 ICD-10 Concurrent Evaluation

The Phase 4 ICD-10 grounding test was executed across 30 nurse workflows in parallel. Clinical summary, update kondisi pasien, and generate clinical notes were evaluated for ICD-10 grounding, while objective summary was treated as N/A because it does not consistently return diagnosis-grounded ICD output. Across all diagnosis-related outputs, grounding accuracy was 100.0%, unsupported diagnosis rate was 27.8%, and retrieval accuracy was 72.2%. The concurrent run completed in 267628 ms.

| Stage | Total Cases | Diagnosis-Related Outputs | Supported ICD-10 Outputs | Unsupported Diagnosis | ICD-10 Grounding Accuracy | Unsupported Diagnosis Rate | ICD-10 Retrieval Accuracy | Missing ICD-10 Rate | Wrong ICD-10 Rate | Avg. Latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Clinical summary | 30 | 30 | 30 | 0 | 100.0% | 0.0% | 100.0% | 0.0% | 0.0% | 2318 ms |
| Objective summary | 30 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 984 ms |
| Update kondisi pasien | 30 | 30 | 30 | 25 | 100.0% | 83.3% | 16.7% | 0.0% | 83.3% | 76996 ms |
| Generate clinical notes | 30 | 30 | 30 | 0 | 100.0% | 0.0% | 100.0% | 0.0% | 0.0% | 128767 ms |
