import { NextResponse } from "next/server";

import { hospitalQuery } from "@/lib/db/hospital-db";

type TimelineRow = {
  id: string;
  kind: "message" | "nurse_note" | "doctor_soap";
  at: string;
  author_role: "nurse" | "doctor" | "system";
  author_name: string;
  author_username: string | null;
  title: string;
  body: string;
};

async function buildTimeline(registrationId: number): Promise<TimelineRow[]> {
  const items: TimelineRow[] = [];

  const nurseNotes = await hospitalQuery(
    `SELECT cn.id, cn.source, cn.patient_condition, cn.summary, cn.assessment, cn.plan,
            cn.medication_recommendation, cn.updated_at, cn.created_at,
            n.full_name AS nurse_name, n.username AS nurse_username
     FROM clinical_notes cn
     LEFT JOIN triage_visits tv ON tv.id = cn.triage_visit_id
     LEFT JOIN indirect_staff_nurses n ON n.id = tv.nurse_id
     WHERE tv.registration_id = $1 AND cn.source IN ('chat', 'clinical_summary', 'nurse_check')
     ORDER BY cn.updated_at ASC`,
    [registrationId],
  );

  for (const row of nurseNotes.rows) {
    const body = [row.patient_condition, row.summary, row.assessment, row.plan, row.medication_recommendation]
      .filter((part) => typeof part === "string" && part.trim())
      .join("\n\n");
    if (!body) continue;
    items.push({
      id: `nurse-note-${row.id}`,
      kind: "nurse_note",
      at: row.updated_at || row.created_at,
      author_role: "nurse",
      author_name: row.nurse_name || row.nurse_username || "Perawat",
      author_username: row.nurse_username || null,
      title: `Catatan perawat (${row.source})`,
      body,
    });
  }

  const exams = await hospitalQuery(
    `SELECT id, doctor_username, status, soap_subjective, soap_objective, soap_assessment,
            soap_plan, examination_notes, result_received_at, updated_at
     FROM external_examinations
     WHERE registration_id = $1
     ORDER BY COALESCE(result_received_at, updated_at) ASC`,
    [registrationId],
  );

  for (const row of exams.rows) {
    const body = [row.soap_subjective, row.soap_objective, row.soap_assessment, row.soap_plan, row.examination_notes]
      .filter((part) => typeof part === "string" && part.trim())
      .join("\n\n");
    if (!body) continue;
    items.push({
      id: `doctor-soap-${row.id}`,
      kind: "doctor_soap",
      at: row.result_received_at || row.updated_at,
      author_role: "doctor",
      author_name: row.doctor_username || "Dokter",
      author_username: row.doctor_username || null,
      title: `SOAP dokter (${row.status})`,
      body,
    });
  }

  const messages = await hospitalQuery(
    `SELECT id, author_role, author_username, author_name, message_text, message_type, created_at
     FROM care_coordination_messages
     WHERE registration_id = $1
     ORDER BY created_at ASC`,
    [registrationId],
  );

  for (const row of messages.rows) {
    items.push({
      id: `msg-${row.id}`,
      kind: "message",
      at: row.created_at,
      author_role: row.author_role,
      author_name: row.author_name,
      author_username: row.author_username,
      title:
        row.message_type === "question"
          ? "Pertanyaan"
          : row.message_type === "instruction"
            ? "Instruksi"
            : row.message_type === "update"
              ? "Pembaruan"
              : "Pesan",
      body: row.message_text,
    });
  }

  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return items;
}

export async function GET(request: Request) {
  const registrationId = Number(new URL(request.url).searchParams.get("registrationId"));
  if (!Number.isFinite(registrationId)) {
    return NextResponse.json({ error: "registrationId wajib diisi" }, { status: 400 });
  }

  try {
    const timeline = await buildTimeline(registrationId);
    return NextResponse.json({ success: true, data: timeline });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat riwayat" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const registrationId = Number(body.registrationId);
    const authorRole = String(body.authorRole || "");
    const authorUsername = String(body.authorUsername || "").trim();
    const authorName = String(body.authorName || "").trim();
    const messageText = String(body.messageText || "").trim();
    const messageType = String(body.messageType || "note");

    if (!Number.isFinite(registrationId) || !authorUsername || !authorName || !messageText) {
      return NextResponse.json({ error: "Data pesan belum lengkap" }, { status: 400 });
    }
    if (authorRole !== "nurse" && authorRole !== "doctor") {
      return NextResponse.json({ error: "authorRole tidak valid" }, { status: 400 });
    }

    const reg = await hospitalQuery(`SELECT patient_id FROM registrations WHERE id = $1 LIMIT 1`, [registrationId]);
    const patientId = reg.rows[0]?.patient_id;
    if (!patientId) {
      return NextResponse.json({ error: "Registrasi tidak ditemukan" }, { status: 404 });
    }

    const insert = await hospitalQuery(
      `INSERT INTO care_coordination_messages (
         registration_id, patient_id, triage_visit_id, author_role, author_staff_id,
         author_username, author_name, message_text, message_type
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, created_at`,
      [
        registrationId,
        patientId,
        body.triageVisitId ?? null,
        authorRole,
        body.authorStaffId ?? null,
        authorUsername.toLowerCase(),
        authorName,
        messageText,
        messageType,
      ],
    );

    const timeline = await buildTimeline(registrationId);
    return NextResponse.json({ success: true, data: timeline, messageId: insert.rows[0]?.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengirim pesan" },
      { status: 500 },
    );
  }
}
