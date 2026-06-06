import { NextResponse } from "next/server";

import {
  createClinicalNote,
  getLatestClinicalNote,
  listClinicalNotes,
} from "@/lib/clinical-notes";
import { getCurrentPerawat } from "@/lib/nurse-auth";
import { hospitalQuery } from "@/lib/hospital-db";

const allowedSources = new Set([
  "chat",
  "clinical_summary",
  "external_examinations",
  "nurse_check",
]);

const allowedStatuses = new Set(["draft", "final"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientIdRaw = searchParams.get("patientId");
  const registrationIdRaw = searchParams.get("registrationId");
  const triageVisitIdRaw = searchParams.get("triageVisitId");
  const limitRaw = searchParams.get("limit");
  const limit = Math.max(1, Number(limitRaw ?? "1"));

  if (!patientIdRaw) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const patientId = Number(patientIdRaw);
  if (!Number.isFinite(patientId)) {
    return NextResponse.json({ error: "patientId must be a number" }, { status: 400 });
  }
  const registrationId = registrationIdRaw ? Number(registrationIdRaw) : null;
  if (registrationIdRaw && !Number.isFinite(registrationId)) {
    return NextResponse.json({ error: "registrationId must be a number" }, { status: 400 });
  }
  const triageVisitId = triageVisitIdRaw ? Number(triageVisitIdRaw) : null;
  if (triageVisitIdRaw && !Number.isFinite(triageVisitId)) {
    return NextResponse.json({ error: "triageVisitId must be a number" }, { status: 400 });
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
    if (limit === 1) {
      const note = await getLatestClinicalNote(patientId, nurseId, registrationId, triageVisitId);
      return NextResponse.json({ note });
    }

    const notes = await listClinicalNotes(patientId, limit, nurseId, registrationId, triageVisitId);
    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load clinical notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId = Number(body.patientId);

    if (!Number.isFinite(patientId)) {
      return NextResponse.json({ error: "patientId must be a number" }, { status: 400 });
    }

    if (!body.source || !allowedSources.has(body.source)) {
      return NextResponse.json({ error: "source is invalid" }, { status: 400 });
    }

    if (body.status && !allowedStatuses.has(body.status)) {
      return NextResponse.json({ error: "status is invalid" }, { status: 400 });
    }

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
    const mergedEvidence = {
      ...(body.evidenceRefs || {}),
      nurse_id: nurseId,
    };

    const note = await createClinicalNote({
      patientId,
      doctorId: body.doctorId ?? null,
      triageVisitId: body.triageVisitId ?? null,
      source: body.source,
      status: body.status ?? "draft",
      summary: body.summary ?? null,
      assessment: body.assessment ?? null,
      plan: body.plan ?? null,
      medicationRecommendation: body.medicationRecommendation ?? null,
      triageLevel: body.triageLevel ?? null,
      evidenceRefs: mergedEvidence,
      doctorReadAt: body.doctorReadAt ?? null,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save clinical note" },
      { status: 500 }
    );
  }
}
