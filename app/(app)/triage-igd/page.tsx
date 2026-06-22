'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Separator } from '@/components/ui/separator';
import { PayerTypeBadge } from "@/components/PayerTypeBadge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Patient {
  id: string;
  nama?: string;
  full_name?: string;
  usia?: number;
  jenis_kelamin?: string;
  nomor_rekam_medis?: string;
  no_rm?: string;
  date_of_birth?: string;
  berat_badan?: number;
  tinggi_badan?: number;
  gol_darah?: string;
  registration_id?: number | null;
  registration_status?: string | null;
  registration_type?: string | null;
  registration_date?: string | null;
  registration_doctor_id?: number | null;
  doctor_full_name?: string | null;
  doctor_specialization?: string | null;
  doctor_username?: string | null;
  examination_status?: string | null;
  clinical_note_doctor_read_at?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  examination_notes?: string | null;
  clinical_note_source?: string | null;
  patient_condition?: string | null;
  clinical_note_summary?: string | null;
  clinical_note_assessment?: string | null;
  clinical_note_plan?: string | null;
  medication_recommendation?: string | null;
  triage_level?: string | null;
  clinical_note_created_at?: string | null;
}

export default function TriageIGDPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      setLoading(true);
      const response = await fetch('/api', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();
      setPatients(data.patients || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  }

  const searchLower = searchQuery.toLowerCase();

  const getPatientName = (patient: Patient) =>
    patient.nama || patient.full_name || '-';

  const getPatientMrn = (patient: Patient) =>
    patient.nomor_rekam_medis || patient.no_rm || '';

  const getPatientAge = (patient: Patient) => {
    if (typeof patient.usia === 'number') return `${patient.usia} tahun`;
    if (!patient.date_of_birth) return '-';
    const dob = new Date(patient.date_of_birth);
    if (Number.isNaN(dob.getTime())) return '-';
    const diffMs = Date.now() - dob.getTime();
    const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    return `${years} tahun`;
  };

  const getGenderLabel = (patient: Patient) => {
    const gender = (patient.jenis_kelamin || '').toLowerCase();
    if (gender === 'm' || gender === 'l' || gender === 'laki-laki') return 'Laki-laki';
    if (gender === 'f' || gender === 'p' || gender === 'perempuan') return 'Perempuan';
    return '-';
  };

  const getDoctorLabel = (patient: Patient) => {
    if (patient.doctor_full_name?.trim()) return patient.doctor_full_name.trim();
    if (patient.doctor_username?.trim()) return patient.doctor_username.trim();
    if (patient.registration_doctor_id) return `Dokter #${patient.registration_doctor_id}`;
    return 'Belum ditetapkan';
  };

  const getDoctorReadStatus = (patient: Patient) => {
    if (patient.clinical_note_doctor_read_at) {
      return {
        label: 'Sudah dibaca dokter',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    }

    return {
      label: 'Belum dibaca dokter',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  };

  const getSummaryPreview = (patient: Patient) =>
    patient.patient_condition || patient.clinical_note_summary || patient.examination_notes || patient.soap_subjective || '-';

  const getLatestTriageLevel = (patient: Patient) => {
    const level = (patient.triage_level || '').trim().toUpperCase();
    return level || 'BELUM DINILAI';
  };

  const getTriageLevelClass = (level: string) => {
    const normalized = level.toLowerCase();
    if (normalized.includes('urgent')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (normalized.includes('high')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (normalized.includes('moderate')) return 'bg-sky-100 text-sky-700 border-sky-200';
    if (normalized.includes('low')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredPatients = patients.filter((patient) => {
    const name = getPatientName(patient).toLowerCase();
    const mrn = getPatientMrn(patient).toLowerCase();
    return name.includes(searchLower) || mrn.includes(searchLower);
  });

  const getInitials = (name?: string) => {
    if (!name) return 'PA';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#f8fffb] to-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#064E3B]">Triage IGD</h1>
            <p className="text-sm text-slate-600">Emergency department patient monitoring dengan tampilan yang konsisten seperti dashboard dan manajemen pasien.</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#047857]">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              {filteredPatients.length} pasien ditampilkan
            </div>
          </div>
          <div className="w-full lg:max-w-xl">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                type="text"
                placeholder="Cari pasien berdasarkan nama atau NRM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border-slate-300 bg-white/90 pl-11 shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={fetchPatients}
            className="mt-2 font-medium text-red-600 underline hover:text-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]"
            />
          ))}
        </div>
      )}

      {!loading && filteredPatients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => {
            const triageLevel = getLatestTriageLevel(patient);

            return (
              <div
                key={patient.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:border-[#059669]/30 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {getInitials(getPatientName(patient))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-slate-900">
                            {getPatientName(patient)}
                          </h3>
                          {patient.registration_type ? (
                            <PayerTypeBadge type={patient.registration_type} compact />
                          ) : null}
                        </div>
                        {getPatientMrn(patient) && (
                          <p className="mt-1 text-sm text-slate-500">NRM: {getPatientMrn(patient)}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-slate-600">
                        Dokter: <span className="font-medium text-slate-900">{getDoctorLabel(patient)}</span>
                      </p>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${getDoctorReadStatus(patient).className}`}>
                        {getDoctorReadStatus(patient).label}
                      </span>
                    </div>
                    {patient.doctor_specialization && (
                      <p className="mt-1 text-xs text-slate-500">{patient.doctor_specialization}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-3 py-1 text-xs font-medium text-white shadow-sm">
                      {getGenderLabel(patient)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold ${getTriageLevelClass(triageLevel)}`}>
                      {triageLevel}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Usia</span>
                    <span className="font-medium text-slate-900">{getPatientAge(patient)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">Kunjungan</span>
                    <span className="font-medium text-slate-900">{patient.registration_id ? `#${patient.registration_id}` : '-'}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-400">Ringkasan Kondisi</p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-700">{getSummaryPreview(patient)}</p>
                  </div>
                </div>

                <Collapsible className="mt-4 rounded-2xl border border-slate-200 bg-white">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-left">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Ringkasan Kondisi Pasien</p>
                      <p className="mt-1 text-xs text-slate-500">Lihat SOAP awal dan kondisi pasien terbaru</p>
                    </div>
                    <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-slate-200 px-4 py-4">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">SOAP Awal Dokter</p>
                        <div className="mt-3 space-y-3 text-sm text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-900">Subjective</p>
                            <p className="mt-1 whitespace-pre-line">{patient.soap_subjective || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Objective</p>
                            <p className="mt-1 whitespace-pre-line">{patient.soap_objective || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Assessment</p>
                            <p className="mt-1 whitespace-pre-line">{patient.soap_assessment || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Plan</p>
                            <p className="mt-1 whitespace-pre-line">{patient.soap_plan || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Kondisi Pasien Terbaru</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold ${getTriageLevelClass(triageLevel)}`}>
                            {triageLevel}
                          </span>
                        </div>
                        <div className="mt-3 space-y-3 text-sm text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-900">Kondisi Pasien</p>
                            <p className="mt-1 whitespace-pre-line">{patient.patient_condition || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Ringkasan Clinical Notes</p>
                            <p className="mt-1 whitespace-pre-line">{patient.clinical_note_summary || patient.examination_notes || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Assessment Terbaru</p>
                            <p className="mt-1 whitespace-pre-line">{patient.clinical_note_assessment || '-'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Plan Terbaru</p>
                            <p className="mt-1 whitespace-pre-line">{patient.clinical_note_plan || '-'}</p>
                          </div>
                          <div className="flex justify-between gap-3 text-xs text-slate-500">
                            <span>Sumber: {patient.clinical_note_source || 'external_examinations'}</span>
                            <span>Diperbarui: {formatDateTime(patient.clinical_note_created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <Link
                    href={`/triage-igd/${patient.id}`}
                    className="inline-flex items-center text-[#059669] transition-all hover:gap-2"
                  >
                    <span className="text-sm font-medium">Buka Triage</span>
                    <span className="transition-transform hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredPatients.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <p className="text-slate-500">
            {searchQuery
              ? 'Tidak ada pasien yang sesuai dengan pencarian'
              : 'Tidak ada pasien terdaftar'}
          </p>
        </div>
      )}

      {!loading && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-600 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          Menampilkan {filteredPatients.length} dari {patients.length} pasien
        </div>
      )}
    </div>
  );
}
