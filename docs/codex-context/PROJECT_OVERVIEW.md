# Project Overview

DARSI Nurse is a Next.js + TypeScript healthcare assistant for nurse workflows. It combines patient management, triage support, SOAP/clinical-note generation, ICD lookup, nurse chat, and audit logging.

## Main features

- Nurse login, registration, and session gating.
- Patient dashboard and patient list.
- Triage IGD workflow with visit context and clinical note history.
- Clinical note generation and SOAP follow-up.
- ICD search and medication recommendation support.
- Operational nurse assistant for stock, assigned patients, and patient summary.
- General guidance agent for non-operational clinical guidance.
- Log admin dashboard for agent observability.

## Main clinical workflow

1. Nurse authenticates.
2. App loads patient and visit context from `hospital_cs`.
3. Triage or chat request is routed to the correct agent.
4. Agent may call tools for patient data, SOAP, ICD, or visit history.
5. Generated output is stored as clinical notes, conversations, and/or logs.

## Technical stack

- Next.js App Router.
- TypeScript.
- PostgreSQL.
- VoltAgent.
- Ollama and OpenAI-compatible model routing.
- Tailwind-based UI components.

## Database stance

- Active clinical database: `hospital_cs` via `HOSPITAL_CS_DATABASE_URL`.
- Legacy database: preserved separately via `DATABASE_URL`.
- New clinical workflows should use `hospital_cs`.
- Legacy patient CRUD still uses the legacy database and must be treated carefully.

## High-level architecture

- `app/` contains routes and pages.
- `src/components/` contains UI components.
- `src/lib/` contains domain logic, DB helpers, agents, tools, auth, logging, and clinical workflows.
- `evaluation/` contains benchmark scripts and result files.
- `docs/` now contains repo knowledge and context for future Codex tasks.

