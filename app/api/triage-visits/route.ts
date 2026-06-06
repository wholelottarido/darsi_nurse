import { NextResponse } from 'next/server';

import { createClinicalNote, getLatestClinicalNote } from '@/lib/clinical-notes';
import { createTriageVisit, listVisitSummaries, resolveNurseId, resolveVisitContext } from '@/lib/visit-context';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientIdRaw = searchParams.get('patientId');

  if (!patientIdRaw) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const patientId = Number(patientIdRaw);
  if (!Number.isFinite(patientId)) {
    return NextResponse.json({ error: 'patientId must be a number' }, { status: 400 });
  }

  try {
    const [activeVisit, visits] = await Promise.all([
      resolveVisitContext(patientId),
      listVisitSummaries(patientId),
    ]);

    return NextResponse.json({
      visits,
      activeTriageVisitId: activeVisit.triageVisitId,
      activeRegistrationId: activeVisit.registrationId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load triage visits' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId = Number(body.patientId);

    if (!Number.isFinite(patientId)) {
      return NextResponse.json({ error: 'patientId must be a number' }, { status: 400 });
    }

    const nurseId = await resolveNurseId();
    if (!nurseId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const previousVisit = await resolveVisitContext(patientId);
    const previousNote = previousVisit.triageVisitId
      ? await getLatestClinicalNote(patientId, nurseId, previousVisit.registrationId, previousVisit.triageVisitId)
      : null;

    const visit = await createTriageVisit(patientId);

    let carriedNote = null;
    if (previousNote && visit.triageVisitId) {
      const previousEvidence = previousNote.evidence_refs && typeof previousNote.evidence_refs === 'object'
        ? previousNote.evidence_refs
        : {};

      carriedNote = await createClinicalNote({
        patientId,
        doctorId: previousNote.doctor_id ?? null,
        triageVisitId: visit.triageVisitId,
        source: 'clinical_summary',
        status: 'draft',
        patientCondition: previousNote.patient_condition ?? null,
        summary: previousNote.summary ?? null,
        assessment: previousNote.assessment ?? null,
        plan: previousNote.plan ?? null,
        medicationRecommendation: previousNote.medication_recommendation ?? null,
        triageLevel: previousNote.triage_level ?? null,
        evidenceRefs: {
          ...previousEvidence,
          registration_id: visit.registrationId ?? previousVisit.registrationId ?? null,
          triage_visit_id: visit.triageVisitId,
          carried_forward_from_triage_visit_id: previousVisit.triageVisitId,
          carried_forward_from_note_id: previousNote.id,
          nurse_id: nurseId,
        },
      });
    }

    const visits = await listVisitSummaries(patientId);

    return NextResponse.json({ visit, visits, carriedNote }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create triage visit' },
      { status: 500 }
    );
  }
}
