'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Patient {
  id: string | number;
  nama?: string;
  full_name?: string;
  usia?: number;
  jenis_kelamin?: string;
  tanggal_lahir?: string;
  date_of_birth?: string;
  nomor_rekam_medis?: string;
  no_rm?: string;
  berat_badan?: number;
  tinggi_badan?: number;
  gol_darah?: string;
  alergi?: string;
  riwayat_penyakit?: string;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'agent';
  message: string;
  timestamp?: string;
}

type ExternalDiagnosis = {
  icd_code?: string;
  icd_name?: string;
};

type ExternalExamination = {
  id: number;
  patient_id: number;
  doctor_username?: string | null;
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  diagnoses?: ExternalDiagnosis[] | null;
  disposition?: string | null;
  result_received_at?: string | null;
  created_at?: string | null;
};

type ClinicalNote = {
  id: number;
  patient_id: number;
  doctor_id?: number | null;
  source: "chat" | "clinical_summary" | "external_examinations" | "nurse_check";
  status: "draft" | "final";
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  medication_recommendation?: string | null;
  triage_level?: string | null;
  evidence_refs?: Record<string, unknown> | null;
  doctor_read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function PatientChatPage() {
  const params = useParams();
  const patientId = params.patientId as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [examination, setExamination] = useState<ExternalExamination | null>(null);
  const [clinicalNote, setClinicalNote] = useState<ClinicalNote | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesGenerating, setNotesGenerating] = useState(false);
  const [notesRefreshing, setNotesRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialNoteCreatedRef = useRef(false);
  const soapNoteGeneratedRef = useRef(false);

  // Load patient data and messages
  useEffect(() => {
    setError(null);
    setMessages([]); // Clear messages when switching patient
    initialNoteCreatedRef.current = false;
    soapNoteGeneratedRef.current = false;
    fetchPatientData();
    fetchExternalExamination();
    fetchClinicalNote();
    fetchMessages();
  }, [patientId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchPatientData() {
    try {
      const response = await fetch('/api', {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to fetch patients');

      const data = await response.json();
      const foundPatient = data.patients?.find(
        (p: Patient) => String(p.id) === String(patientId)
      );

      if (!foundPatient) {
        throw new Error('Patient not found');
      }

      setPatient(foundPatient);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching patient:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      // This would typically call an API to get conversation history
      // For now, we'll just leave it empty (messages will be added during chat)
      setMessages([]);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  async function fetchExternalExamination() {
    try {
      const response = await fetch(`/api/external-examinations?patientId=${encodeURIComponent(patientId)}`);
      if (!response.ok) {
        let errorMessage = 'Failed to fetch external examinations';
        try {
          const errorBody = await response.json();
          if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Ignore JSON parse errors for non-JSON responses.
        }
        console.warn('External examinations fetch failed:', response.status, errorMessage);
        setExamination(null);
        return;
      }
      const data = await response.json();
      setExamination(data.examination ?? null);
    } catch (err) {
      console.error('Error fetching external examinations:', err);
      setExamination(null);
    }
  }

  async function fetchClinicalNote() {
    try {
      setNotesLoading(true);
      const response = await fetch(`/api/clinical-notes?patientId=${encodeURIComponent(patientId)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch clinical notes');
      }
      const data = await response.json();
      setClinicalNote(data.note ?? null);
    } catch (err) {
      console.error('Error fetching clinical notes:', err);
      setClinicalNote(null);
    } finally {
      setNotesLoading(false);
    }
  }

  const getPatientName = (value?: Patient | null) => value?.nama || value?.full_name || 'Pasien';
  const getPatientMrn = (value?: Patient | null) => value?.nomor_rekam_medis || value?.no_rm || 'N/A';
  const getPatientAge = (value?: Patient | null) => {
    if (!value) return '-';
    if (typeof value.usia === 'number') return `${value.usia} tahun`;
    const dobRaw = value.tanggal_lahir || value.date_of_birth;
    if (!dobRaw) return '-';
    const dob = new Date(dobRaw);
    if (Number.isNaN(dob.getTime())) return '-';
    const years = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return `${years} tahun`;
  };
  const getGenderLabel = (value?: Patient | null) => {
    const gender = (value?.jenis_kelamin || '').toLowerCase();
    if (gender === 'm' || gender === 'l' || gender === 'laki-laki') return 'Laki-laki';
    if (gender === 'f' || gender === 'p' || gender === 'perempuan') return 'Perempuan';
    return '-';
  };

  const getExamStatusLabel = (value?: string | null) => {
    if (!value) return '-';
    return value.replace(/_/g, ' ');
  };

  const getExamStatusClass = (value?: string | null) => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'examined') return 'bg-emerald-100 text-emerald-700';
    if (normalized === 'pending') return 'bg-amber-100 text-amber-700';
    if (normalized === 'forwarded') return 'bg-slate-100 text-slate-600';
    return 'bg-slate-100 text-slate-600';
  };

  const buildInitialClinicalNote = (currentPatient: Patient, currentExam: ExternalExamination | null) => {
    const summaryParts: string[] = [];
    summaryParts.push(`Nama: ${getPatientName(currentPatient)}`);
    summaryParts.push(`NRM: ${getPatientMrn(currentPatient)}`);
    summaryParts.push(`Usia: ${getPatientAge(currentPatient)}`);
    summaryParts.push(`Gender: ${getGenderLabel(currentPatient)}`);

    if (currentPatient.alergi) summaryParts.push(`Alergi: ${currentPatient.alergi}`);
    if (currentPatient.riwayat_penyakit) summaryParts.push(`Riwayat: ${currentPatient.riwayat_penyakit}`);
    if (currentPatient.berat_badan) summaryParts.push(`BB: ${currentPatient.berat_badan} kg`);
    if (currentPatient.tinggi_badan) summaryParts.push(`TB: ${currentPatient.tinggi_badan} cm`);

    let assessment = currentExam?.soap_assessment || null;
    let plan = currentExam?.soap_plan || null;
    let triageLevel: string | null = null;

    if (!assessment) assessment = null;
    if (!plan) plan = null;

    return {
      source: "clinical_summary" as const,
      status: "draft" as const,
      summary: summaryParts.join("\n"),
      assessment,
      plan,
      medicationRecommendation: null,
      triageLevel,
      evidenceRefs: {
        patient_id: currentPatient.id,
        external_examination_id: currentExam?.id ?? null,
      },
    };
  };

  useEffect(() => {
    if (!patient || notesLoading || clinicalNote || initialNoteCreatedRef.current) return;

    const payload = buildInitialClinicalNote(patient, examination);
    initialNoteCreatedRef.current = true;

    const createInitialNote = async () => {
      try {
        const response = await fetch("/api/clinical-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: Number(patientId),
            source: payload.source,
            status: payload.status,
            summary: payload.summary,
            assessment: payload.assessment,
            plan: payload.plan,
            medicationRecommendation: payload.medicationRecommendation,
            triageLevel: payload.triageLevel,
            evidenceRefs: payload.evidenceRefs,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create initial clinical note");
        }

        const data = await response.json();
        setClinicalNote(data.note ?? null);
      } catch (err) {
        console.error("Error creating initial clinical note:", err);
        initialNoteCreatedRef.current = false;
      }
    };

    createInitialNote();
  }, [patient, examination, clinicalNote, notesLoading, patientId]);

  const generateSoapNotes = async () => {
    try {
      setNotesGenerating(true);
      soapNoteGeneratedRef.current = true;
      const response = await fetch("/api/clinical-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: Number(patientId) }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate clinical notes";
        try {
          const errorBody = await response.json();
          if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Ignore JSON parse errors.
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.note) {
        setClinicalNote(data.note as ClinicalNote);
      }
    } catch (err) {
      console.error("Error generating clinical notes:", err);
      // Avoid immediate retry storms; user can click Regenerate.
    } finally {
      setNotesGenerating(false);
    }
  };

  useEffect(() => {
    if (!examination?.id || notesGenerating) return;
    if (soapNoteGeneratedRef.current) return;
    if (clinicalNote && clinicalNote.source !== 'clinical_summary') return;

    soapNoteGeneratedRef.current = true;
    generateSoapNotes();
  }, [examination?.id, clinicalNote, notesGenerating, patientId]);

  const getNoteSourceLabel = (value?: ClinicalNote['source']) => {
    if (value === 'external_examinations') return 'SOAP External';
    if (value === 'nurse_check') return 'Check Perawat';
    if (value === 'clinical_summary') return 'Clinical Summary';
    if (value === 'chat') return 'Triage Chat';
    return 'Unknown';
  };

  const getNoteStatusClass = (value?: ClinicalNote['status']) => {
    if (value === 'final') return 'bg-emerald-100 text-emerald-700';
    return 'bg-amber-100 text-amber-700';
  };

  const normalizeIcdList = (list: Array<ExternalDiagnosis | { kode?: string; nama?: string }>) =>
    list.map((item) => ({
      icd_code: (item as ExternalDiagnosis).icd_code || (item as { kode?: string }).kode,
      icd_name: (item as ExternalDiagnosis).icd_name || (item as { nama?: string }).nama,
    }));

  const getNoteIcdList = (note: ClinicalNote | null) => {
    if (!note?.evidence_refs) return [] as ExternalDiagnosis[];
    const refs = typeof note.evidence_refs === 'string'
      ? (() => {
          try {
            return JSON.parse(note.evidence_refs);
          } catch {
            return null;
          }
        })()
      : note.evidence_refs;
    if (!refs || typeof refs !== 'object') return [] as ExternalDiagnosis[];
    const icd = (refs as { icd?: Array<ExternalDiagnosis | { kode?: string; nama?: string }> }).icd;
    return Array.isArray(icd) ? normalizeIcdList(icd) : [];
  };

  const getFallbackIcdList = () => {
    if (!examination?.diagnoses) return [] as ExternalDiagnosis[];
    return normalizeIcdList(examination.diagnoses as Array<ExternalDiagnosis | { kode?: string; nama?: string }>);
  };

  const getTriageLevelClass = (value?: string | null) => {
    const normalized = (value || '').toLowerCase();
    if (normalized.includes('urgent')) return 'from-rose-500 to-red-600 text-white';
    if (normalized.includes('high')) return 'from-orange-400 to-amber-500 text-white';
    if (normalized.includes('moderate')) return 'from-sky-400 to-cyan-500 text-white';
    if (normalized.includes('low')) return 'from-emerald-400 to-teal-500 text-white';
    return 'from-slate-200 to-slate-300 text-slate-700';
  };

  const formatSoapValue = (label: string, value: string) => {
    if (!label) return value;
    if (/suhu/i.test(label)) {
      const normalized = value.replace(/\./g, ',');
      if (/c|°/i.test(normalized)) return normalized;
      return `${normalized} C`;
    }
    return value;
  };

  const parseSoapObjective = (value?: string | null) => {
    if (!value) return [] as Array<{ label: string; value: string; category: 'vital' | 'pe' | 'other' }>;

    const items: Array<{ label: string; value: string; category: 'vital' | 'pe' | 'other' }> = [];
    const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);

    const vitalLabels = new Set([
      'td',
      'nadi',
      'suhu',
      'rr',
      'bb',
      'tb',
      'spo2',
      'saturasi',
      'gcs',
      'nyeri',
    ]);

    lines.forEach((line) => {
      const segments = line.split(',');

      segments.forEach((segment) => {
        const trimmed = segment.trim();
        if (!trimmed) return;

        if (/^pe\s*:/i.test(trimmed)) {
          const content = trimmed.replace(/^pe\s*:/i, '').trim();
          content.split(';').forEach((part) => {
            const piece = part.trim();
            if (!piece) return;
            const [labelRaw, ...rest] = piece.split(':');
            const label = labelRaw?.trim() || 'Catatan';
            const rawValue = rest.join(':').trim() || '-';
            items.push({ label, value: formatSoapValue(label, rawValue), category: 'pe' });
          });
          return;
        }

        const parts = trimmed.split(';');
        parts.forEach((part) => {
          const piece = part.trim();
          if (!piece) return;
          const [labelRaw, ...rest] = piece.split(':');
          const label = labelRaw?.trim() || 'Catatan';
          const rawValue = rest.join(':').trim() || '-';
          const category = vitalLabels.has(label.toLowerCase()) ? 'vital' : 'other';
          items.push({ label, value: formatSoapValue(label, rawValue), category });
        });
      });
    });

    return items;
  };

  const getObjectiveLabelClass = (category: 'vital' | 'pe' | 'other') => {
    if (category === 'vital') return 'bg-sky-100 text-sky-700';
    if (category === 'pe') return 'bg-violet-100 text-violet-700';
    return 'bg-slate-100 text-slate-700';
  };

  const renderClinicalSummary = (currentPatient: Patient) => (
    <div className="space-y-4">
      {examination && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dokter Pemeriksa</p>
              <p className="text-sm font-semibold text-slate-800">
                {examination.doctor_username || 'N/A'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getExamStatusClass(examination.status)}`}>
              {getExamStatusLabel(examination.status)}
            </span>
          </div>
        </div>
      )}

      <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
        <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
          Vital Signs
          <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Usia</span>
              <span className="font-medium">{getPatientAge(currentPatient)}</span>
            </div>
            {currentPatient.berat_badan && (
              <div className="flex justify-between">
                <span className="text-slate-600">Berat Badan</span>
                <span className="font-medium">{currentPatient.berat_badan} kg</span>
              </div>
            )}
            {currentPatient.tinggi_badan && (
              <div className="flex justify-between">
                <span className="text-slate-600">Tinggi Badan</span>
                <span className="font-medium">{currentPatient.tinggi_badan} cm</span>
              </div>
            )}
            {currentPatient.berat_badan && currentPatient.tinggi_badan && (
              <>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span className="text-slate-600">BMI</span>
                  <span className="font-medium">
                    {(currentPatient.berat_badan / ((currentPatient.tinggi_badan / 100) ** 2)).toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {currentPatient.gol_darah && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            Blood Type
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="inline-block rounded-full bg-red-50 px-4 py-2 font-bold text-red-700 ring-1 ring-red-100">
              {currentPatient.gol_darah}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {currentPatient.alergi && (
        <Collapsible defaultOpen className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <CollapsibleTrigger className="group mb-2 flex w-full items-center justify-between font-semibold text-orange-900">
            ⚠️ Allergies
            <ChevronDown className="size-4 text-orange-500 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-orange-800">{currentPatient.alergi}</p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {currentPatient.riwayat_penyakit && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            Medical History
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-slate-700">{currentPatient.riwayat_penyakit}</p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {examination && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            SOAP - Subjective
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {examination.soap_subjective || '-'}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {examination && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            SOAP - Objective
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              {parseSoapObjective(examination.soap_objective).length > 0 ? (
                <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                  {parseSoapObjective(examination.soap_objective).map((item, idx) => (
                    <li key={`${item.label}-${idx}`} className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getObjectiveLabelClass(item.category)}`}>
                        {item.label}
                      </span>
                      <span className="text-slate-700">{item.value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-700">-</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {examination && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            SOAP - Assessment
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {examination.soap_assessment || '-'}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {examination && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            SOAP - Plan
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {examination.soap_plan || '-'}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {examination?.diagnoses && examination.diagnoses.length > 0 && (
        <Collapsible defaultOpen className="rounded-2xl border border-slate-200 bg-white p-4">
          <CollapsibleTrigger className="group mb-3 flex w-full items-center justify-between font-semibold text-slate-900">
            Diagnosa ICD
            <ChevronDown className="size-4 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-2 text-sm text-slate-700">
              {examination.diagnoses.map((diag, idx) => (
                <li key={`${diag.icd_code || 'icd'}-${idx}`} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{diag.icd_code || '-'}</span>
                  <span className="text-slate-600">{diag.icd_name || '-'}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  async function sendMessage() {
    if (!inputMessage.trim() || !patientId) return;

    const messageToSend = inputMessage; // Save message BEFORE clearing

    const userMessage: ChatMessage = {
      role: 'user',
      message: messageToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage(''); // Clear AFTER saving
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend, // Use saved message
          patientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const agentMessage: ChatMessage = {
        role: 'agent',
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      const agentMessage: ChatMessage = {
        role: 'agent',
        message: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMessage]);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#059669]" />
          <p className="text-sm font-medium text-slate-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
          <p className="mb-4 text-sm font-semibold text-red-700">Error: {error || 'Patient not found'}</p>
          <Link
            href="/triage-igd"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-6 py-3 text-sm font-semibold text-white shadow-sm"
          >
            Back to Patient List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4 overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-[#f8fffb] to-white px-4 py-4 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              href="/triage-igd"
              className="shrink-0 text-sm font-semibold text-[#059669] hover:text-[#047857]"
            >
              ← Back
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[#064E3B] sm:text-xl lg:text-2xl">{getPatientName(patient)}</h1>
              <p className="text-xs text-slate-600 sm:text-sm">NRM: {getPatientMrn(patient)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="rounded-full bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-2.5 py-1 text-xs font-medium text-white shadow-sm sm:px-3 sm:text-sm">
              {getGenderLabel(patient)}
            </span>
            <span className="text-xs font-medium text-slate-600 sm:text-sm">{getPatientAge(patient)}</span>
            <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold sm:px-3 sm:text-xs ${getExamStatusClass(examination?.status)}`}>
              {getExamStatusLabel(examination?.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileSummary((value) => !value)}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
        >
          <span className="text-sm font-semibold text-[#064E3B]">Clinical Summary</span>
          <ChevronDown className={`size-4 text-slate-400 transition-transform ${showMobileSummary ? 'rotate-180' : ''}`} />
        </button>

        {showMobileSummary && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
            <p className="mb-3 text-xs text-slate-600">Ringkasan kondisi pasien.</p>
            {patient ? renderClinicalSummary(patient) : null}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="hidden min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] sm:p-5 lg:block">
          <div className="mb-4">
            <h2 className="text-base font-extrabold tracking-tight text-[#064E3B] sm:text-lg">Clinical Summary</h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">Ringkasan kondisi pasien.</p>
          </div>
          {renderClinicalSummary(patient)}
        </div>

        {/* Right Main Area - Chat */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
          {/* Tabs */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#f8fffb] to-white px-4 sm:px-5">
            <div className="flex gap-3 sm:gap-4">
              <button
                onClick={() => setActiveTab('chat')}
                className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 sm:py-4 ${
                  activeTab === 'chat'
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Triage Chat
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 sm:py-4 ${
                  activeTab === 'notes'
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Clinical Notes
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <p className="mb-2 text-slate-500">Welcome to Triage Chat</p>
                        <p className="text-sm text-slate-400">
                          Start a conversation to assess this patient&apos;s condition
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md rounded-lg px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-900 shadow-sm'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        {msg.timestamp && (
                          <p
                            className={`mt-1 text-xs ${
                              msg.role === 'user'
                                ? 'text-white/70'
                                : 'text-slate-400'
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-slate-200 bg-white">
                <Separator />
                <div className="p-4 sm:p-6">
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !sending) {
                          sendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      disabled={sending}
                      className="flex-1 rounded-2xl border-slate-300 bg-white"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={sending || !inputMessage.trim()}
                      className="rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-5 shadow-sm"
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Clinical Notes Tab */}
          {activeTab === 'notes' && (
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h3 className="mb-4 text-base font-extrabold tracking-tight text-[#064E3B] sm:text-lg">
                  Clinical Assessment Notes
                </h3>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {clinicalNote && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {getNoteSourceLabel(clinicalNote.source)}
                      </span>
                    )}
                    {clinicalNote && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getNoteStatusClass(clinicalNote.status)}`}>
                        {clinicalNote.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={notesGenerating || notesRefreshing}
                    onClick={async () => {
                      setNotesRefreshing(true);
                      soapNoteGeneratedRef.current = false;
                      await generateSoapNotes();
                      setNotesRefreshing(false);
                    }}
                    className="rounded-full border-slate-200 text-xs"
                  >
                    {notesRefreshing ? "Regenerating..." : "Regenerate Notes"}
                  </Button>
                </div>

                {notesLoading || notesGenerating ? (
                  <p className="text-sm text-slate-500">
                    {notesLoading ? "Memuat clinical notes..." : "Membuat clinical notes dari SOAP..."}
                  </p>
                ) : clinicalNote ? (
                  <div className="space-y-4">
                    {clinicalNote.created_at && (
                      <span className="text-xs text-slate-500">
                        {new Date(clinicalNote.created_at).toLocaleString('id-ID')}
                      </span>
                    )}

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Ringkasan</p>
                        <p className="mt-2 text-sm text-slate-700">{clinicalNote.summary || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Assessment</p>
                        <p className="mt-2 text-sm text-slate-700">{clinicalNote.assessment || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Plan</p>
                        <p className="mt-2 text-sm text-slate-700">{clinicalNote.plan || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Rekomendasi Obat</p>
                        <p className="mt-2 text-sm text-slate-700">{clinicalNote.medication_recommendation || '-'}</p>
                      </div>
                      {(getNoteIcdList(clinicalNote).length > 0 || getFallbackIcdList().length > 0) && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Diagnosa ICD</p>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {(getNoteIcdList(clinicalNote).length > 0 ? getNoteIcdList(clinicalNote) : getFallbackIcdList()).map((diag, idx) => (
                              <li key={`${diag.icd_code || 'icd'}-${idx}`} className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">{diag.icd_code || '-'}</span>
                                <span className="text-slate-600">{diag.icd_name || '-'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {clinicalNote.triage_level && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Triage Level</p>
                          <div className={`mt-2 inline-flex rounded-xl bg-gradient-to-r px-3 py-1.5 text-sm font-semibold ${getTriageLevelClass(clinicalNote.triage_level)}`}>
                            {clinicalNote.triage_level}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Belum ada clinical notes. Notes akan dibuat dari SOAP, check perawat, atau ringkasan triage.
                  </div>
                )}

                {messages.filter((m) => m.role === 'agent').length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
                    <h4 className="font-semibold text-slate-900">Agent Assessments (Sumber Chat):</h4>
                    <div className="space-y-3">
                      {messages
                        .filter((m) => m.role === 'agent')
                        .map((msg, idx) => (
                          <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm text-slate-700">{msg.message}</p>
                            {msg.timestamp && (
                              <p className="mt-2 text-xs text-slate-500">
                                {new Date(msg.timestamp).toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
