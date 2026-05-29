'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Separator } from '@/components/ui/separator';

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
}

export default function TriageIGDPage() {
  const router = useRouter();
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

        {/* Error Message */}
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

        {/* Loading State */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]"
              />
            ))}
          </div>
        )}

        {/* Patient Cards */}
        {!loading && filteredPatients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                href={`/triage-igd/${patient.id}`}
              >
                <div className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-[#059669]/30 hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                          {getInitials(getPatientName(patient))}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-[#059669]">
                        {getPatientName(patient)}
                          </h3>
                          {getPatientMrn(patient) && (
                            <p className="mt-1 text-sm text-slate-500">NRM: {getPatientMrn(patient)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-3 py-1 text-xs font-medium text-white shadow-sm">
                      {getGenderLabel(patient)}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Usia</span>
                      <span className="font-medium text-slate-900">{getPatientAge(patient)}</span>
                    </div>
                    {patient.berat_badan && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">BB</span>
                        <span className="font-medium text-slate-900">{patient.berat_badan} kg</span>
                      </div>
                    )}
                    {patient.tinggi_badan && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">TB</span>
                        <span className="font-medium text-slate-900">{patient.tinggi_badan} cm</span>
                      </div>
                    )}
                    {patient.gol_darah && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Gol Darah</span>
                        <span className="font-medium text-slate-900">{patient.gol_darah}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center text-[#059669] transition-all group-hover:gap-2">
                    <span className="text-sm font-medium">Buka Triage</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredPatients.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <p className="text-slate-500">
              {searchQuery
                ? 'Tidak ada pasien yang sesuai dengan pencarian'
                : 'Tidak ada pasien terdaftar'}
            </p>
          </div>
        )}

        {/* Footer Stats */}
        {!loading && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-600 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            Menampilkan {filteredPatients.length} dari {patients.length} pasien
          </div>
        )}
    </div>
  );
}