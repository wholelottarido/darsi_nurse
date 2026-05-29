import { NextResponse } from "next/server";

import { hospitalQuery } from "@/lib/hospital-db";
import { getCurrentPerawat } from "@/lib/nurse-auth";

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
      ORDER BY created_at DESC
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
