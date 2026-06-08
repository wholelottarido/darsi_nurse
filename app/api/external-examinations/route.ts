import { NextResponse } from "next/server";

import { hospitalQuery } from "@/lib/db/hospital-db";
import { getCurrentPerawat } from "@/lib/auth/nurse-auth";
import { buildExternalExaminationPriorityOrder } from "@/lib/clinical/external-examinations";
import { regenerateSoapAssessmentPlan } from "@/lib/clinical/soap-followup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  try {
    const perawat = await getCurrentPerawat();
    if (!perawat) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nurseResult = await hospitalQuery(
      `SELECT id
       FROM indirect_staff_nurses
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [perawat.username]
    );

    if (nurseResult.rows.length === 0) {
      return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
    }

    const nurseId = nurseResult.rows[0].id as number;
    const registrationResult = await hospitalQuery(
      `SELECT r.id
       FROM registrations r
       WHERE r.patient_id = $1 AND r.nurse_id = $2
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC
       LIMIT 1`,
      [Number(patientId), nurseId]
    );

    if (registrationResult.rows.length === 0) {
      return NextResponse.json({ examination: null });
    }

    const registrationId = registrationResult.rows[0].id as number;
    const result = await hospitalQuery(
      `SELECT
        id,
        registration_id,
        booking_code,
        patient_id,
        doctor_id,
        doctor_username,
        status,
        soap_subjective,
        soap_objective,
        soap_assessment,
        soap_plan,
        diagnoses,
        disposition,
        examination_notes,
        result_received_at,
        created_at,
        updated_at
      FROM external_examinations
      WHERE registration_id = $1
      ORDER BY ${buildExternalExaminationPriorityOrder('external_examinations')}
      LIMIT 1`,
      [registrationId]
    );

    return NextResponse.json({ examination: result.rows[0] ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load external examinations";
    console.error("External examinations error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseObjectivePayload(input: unknown) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const data = input as Record<string, unknown>;
  const labels = [
    ['TD', 'td'],
    ['Nadi', 'nadi'],
    ['Suhu', 'suhu'],
    ['RR', 'rr'],
    ['BB', 'bb'],
    ['Kepala', 'kepala'],
    ['Mata', 'mata'],
    ['THT', 'tht'],
    ['Leher', 'leher'],
    ['Paru', 'paru'],
    ['Jantung', 'jantung'],
    ['Abdomen', 'abdomen'],
    ['Ekstermitas', 'ekstermitas'],
    ['Uro', 'uro'],
  ] as const;

  const lines = labels
    .map(([display, key]) => {
      const value = data[key];
      const text = typeof value === 'string' ? value.trim() : '';
      return text ? `${display}: ${text}` : null;
    })
    .filter(Boolean) as string[];

  return lines.length > 0 ? lines.join('\n') : null;
}

function parseObjectiveText(value?: string | null) {
  const result: Record<string, string> = {};

  if (!value) return result;

  value.split('\n').forEach((line) => {
    const [rawLabel, ...rest] = line.split(':');
    if (!rawLabel || rest.length === 0) return;

    const label = rawLabel.trim().toLowerCase();
    const text = rest.join(':').trim();
    if (!text) return;

    if (label === 'td') result.td = text;
    else if (label === 'nadi') result.nadi = text;
    else if (label === 'suhu') result.suhu = text;
    else if (label === 'rr') result.rr = text;
    else if (label === 'bb') result.bb = text;
    else if (label === 'kepala') result.kepala = text;
    else if (label === 'mata') result.mata = text;
    else if (label === 'tht') result.tht = text;
    else if (label === 'leher') result.leher = text;
    else if (label === 'paru') result.paru = text;
    else if (label === 'jantung') result.jantung = text;
    else if (label === 'abdomen') result.abdomen = text;
    else if (label === 'ekstermitas' || label === 'ekstremitas') result.ekstermitas = text;
    else if (label === 'uro') result.uro = text;
  });

  return result;
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const patientId = Number(body.patientId);

    if (!Number.isFinite(patientId)) {
      return NextResponse.json({ error: 'patientId must be a number' }, { status: 400 });
    }

    const soapObjective = parseObjectivePayload(body.soap_objective);
    if (!soapObjective) {
      return NextResponse.json({ error: 'soap_objective is required' }, { status: 400 });
    }

    const perawat = await getCurrentPerawat();
    if (!perawat) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nurseResult = await hospitalQuery(
      `SELECT id
       FROM indirect_staff_nurses
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [perawat.username]
    );

    if (nurseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 });
    }

    const nurseId = nurseResult.rows[0].id as number;

    const registrationResult = await hospitalQuery(
      `SELECT r.id
       FROM registrations r
       WHERE r.patient_id = $1 AND r.nurse_id = $2
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC
       LIMIT 1`,
      [patientId, nurseId]
    );

    if (registrationResult.rows.length === 0) {
      return NextResponse.json({ error: 'No registration found for patient' }, { status: 404 });
    }

    const registrationId = registrationResult.rows[0].id as number;
    const examResult = await hospitalQuery(
      `SELECT id, soap_objective
       FROM external_examinations
       WHERE registration_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [registrationId]
    );

    if (examResult.rows.length === 0) {
      return NextResponse.json({ error: 'No external examination found' }, { status: 404 });
    }

    const examinationId = examResult.rows[0].id as number;
    const currentObjective = parseObjectiveText(examResult.rows[0].soap_objective);
    const incomingObjective = parseObjectiveText(soapObjective);
    const mergedObjective = {
      ...currentObjective,
      ...incomingObjective,
    };

    const objectiveText = parseObjectivePayload(mergedObjective);
    if (!objectiveText) {
      return NextResponse.json({ error: 'soap_objective is required' }, { status: 400 });
    }

    const updated = await hospitalQuery(
      `UPDATE external_examinations
       SET soap_objective = $1
       WHERE id = $2
       RETURNING *`,
      [objectiveText, examinationId]
    );

    const refreshedFollowUp = await regenerateSoapAssessmentPlan(patientId, examinationId);
    const finalExamination = refreshedFollowUp.success && refreshedFollowUp.updatedExam
      ? refreshedFollowUp.updatedExam
      : updated.rows[0];

    return NextResponse.json({
      examination: finalExamination ?? null,
      soap_follow_up: refreshedFollowUp.success
        ? {
            assessment: refreshedFollowUp.assessment,
            plan: refreshedFollowUp.plan,
          }
        : null,
      soap_follow_up_error: refreshedFollowUp.success ? null : refreshedFollowUp.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update SOAP objective';
    console.error('SOAP objective update error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
