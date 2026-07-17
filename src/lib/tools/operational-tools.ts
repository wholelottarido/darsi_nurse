import { createTool } from "@voltagent/core";
import { z } from "zod";

import { getHospitalPatientsByPerawatUsername } from "@/lib/patients/get-hospital-patients";
import { hospitalQuery } from "@/lib/db/hospital-db";
import { getCurrentPerawat } from "@/lib/auth/nurse-auth";

type AssignedPatientRow = {
  id: number;
  no_rm?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  registration_id?: number | null;
  registration_status?: string | null;
  registration_date?: string | null;
  doctor_full_name?: string | null;
  doctor_specialization?: string | null;
  examination_status?: string | null;
  clinical_note_id?: number | null;
  clinical_note_summary?: string | null;
  clinical_note_assessment?: string | null;
  clinical_note_plan?: string | null;
  medication_recommendation?: string | null;
  triage_level?: string | null;
  patient_condition?: string | null;
  diagnoses?: Array<{ icd_code?: string | null; icd_name?: string | null }> | null;
};

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  return Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function buildIcdSummary(diagnoses?: Array<{ icd_code?: string | null; icd_name?: string | null }> | null) {
  if (!Array.isArray(diagnoses) || diagnoses.length === 0) {
    return "-";
  }

  return diagnoses
    .map((item) => `${item.icd_code || "-"} - ${item.icd_name || "-"}`)
    .join("; ");
}

async function requirePerawat() {
  const perawat = await getCurrentPerawat();
  if (!perawat) {
    throw new Error("Unauthorized");
  }

  return perawat;
}

export async function getAssignedPatients(limit = 20) {
  const perawat = await requirePerawat();
  const rows = (await getHospitalPatientsByPerawatUsername(perawat.username, limit)) as AssignedPatientRow[];

  return rows.map((row) => ({
    patient_id: row.id,
    no_rm: row.no_rm || "-",
    full_name: row.full_name || "Pasien",
    age: calculateAge(row.date_of_birth),
    registration_id: row.registration_id ?? null,
    registration_status: row.registration_status || "-",
    doctor_name: row.doctor_full_name || row.doctor_specialization || "-",
    triage_level: row.triage_level || "-",
    examination_status: row.examination_status || "-",
    patient_condition: row.patient_condition || "-",
  }));
}

export async function getAssignedPatientSummary(patientQuery: string) {
  const perawat = await requirePerawat();
  const normalizedQuery = patientQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    throw new Error("patientQuery is required");
  }

  const rows = (await getHospitalPatientsByPerawatUsername(perawat.username, 100)) as AssignedPatientRow[];
  const matched =
    rows.find((row) => String(row.id) === normalizedQuery) ||
    rows.find((row) => (row.no_rm || "").toLowerCase() === normalizedQuery) ||
    rows.find((row) => (row.full_name || "").toLowerCase().includes(normalizedQuery));

  if (!matched) {
    return null;
  }

  return {
    patient_id: matched.id,
    no_rm: matched.no_rm || "-",
    full_name: matched.full_name || "Pasien",
    age: calculateAge(matched.date_of_birth),
    registration_id: matched.registration_id ?? null,
    doctor_name: matched.doctor_full_name || "-",
    doctor_specialization: matched.doctor_specialization || "-",
    triage_level: matched.triage_level || "-",
    patient_condition: matched.patient_condition || "-",
    summary: matched.clinical_note_summary || "-",
    assessment: matched.clinical_note_assessment || "-",
    plan: matched.clinical_note_plan || "-",
    medication_recommendation: matched.medication_recommendation || "-",
    diagnoses: buildIcdSummary(matched.diagnoses),
  };
}

export async function checkMedicineAvailability(keyword: string) {
  const normalized = keyword.trim();
  if (!normalized) {
    throw new Error("drugName is required");
  }

  const result = await hospitalQuery(
    `SELECT nomor_obat, nama, stok, satuan, expired_at, lokasi, status, source
     FROM darsi_ph_stok_obat
     WHERE nama ILIKE $1 OR nomor_obat ILIKE $1
     ORDER BY
       CASE
         WHEN nama ILIKE $2 THEN 1
         WHEN nama ILIKE $1 THEN 2
         ELSE 3
       END,
       stok DESC,
       nama ASC
     LIMIT 10`,
    [`%${normalized}%`, `${normalized}%`]
  );

  return result.rows.map((row) => ({
    nomor_obat: row.nomor_obat || "-",
    nama: row.nama || "-",
    stok: typeof row.stok === "number" ? row.stok : Number(row.stok ?? 0),
    satuan: row.satuan || "-",
    expired_at: row.expired_at || null,
    lokasi: row.lokasi || "-",
    status: row.status || "-",
    source: row.source || "-",
  }));
}

export const checkMedicineAvailabilityTool = createTool({
  name: "check_medicine_availability",
  description: "Cek ketersediaan obat dari stok farmasi rumah sakit.",
  parameters: z.object({
    drugName: z.string().min(1, "drugName is required"),
  }),
  execute: async ({ drugName }) => {
    const items = await checkMedicineAvailability(drugName);
    return {
      query: drugName,
      total: items.length,
      items,
    };
  },
});

export const listAssignedPatientsTool = createTool({
  name: "list_assigned_patients",
  description: "Menampilkan daftar pasien yang sedang ditangani oleh perawat yang login.",
  parameters: z.object({
    limit: z.number().int().min(1).max(50).optional(),
  }),
  execute: async ({ limit }) => {
    const patients = await getAssignedPatients(limit ?? 20);
    return {
      total: patients.length,
      patients,
    };
  },
});

export const getAssignedPatientSummaryTool = createTool({
  name: "get_assigned_patient_summary",
  description: "Mengambil ringkasan singkat pasien yang sedang ditangani perawat berdasarkan nama, NRM, atau patient id.",
  parameters: z.object({
    patientQuery: z.string().min(1, "patientQuery is required"),
  }),
  execute: async ({ patientQuery }) => {
    const patient = await getAssignedPatientSummary(patientQuery);
    return {
      found: Boolean(patient),
      patient,
    };
  },
});

export const operationalTools = [
  checkMedicineAvailabilityTool,
  listAssignedPatientsTool,
  getAssignedPatientSummaryTool,
];
