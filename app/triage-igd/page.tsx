'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Patient {
  id: string;
  nama: string;
  usia: number;
  jenis_kelamin: string;
  nomor_rekam_medis?: string;
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

  const filteredPatients = patients.filter((patient) =>
    patient.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.nomor_rekam_medis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-3xl font-bold text-slate-900">Triage IGD</h1>
          <p className="mt-1 text-slate-600">Emergency Department Patient Monitoring</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Cari pasien berdasarkan nama atau NRM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={fetchPatients}
              className="mt-2 text-red-600 hover:text-red-700 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-slate-200"
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
                <div className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#059669] hover:shadow-md">
                  {/* Patient Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-[#059669]">
                        {patient.nama}
                      </h3>
                      {patient.nomor_rekam_medis && (
                        <p className="mt-1 text-sm text-slate-500">
                          NRM: {patient.nomor_rekam_medis}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#059669]/10 px-3 py-1 text-xs font-medium text-[#059669]">
                      {patient.jenis_kelamin === 'M' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                  </div>

                  {/* Patient Info */}
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Usia</span>
                      <span className="font-medium text-slate-900">{patient.usia} tahun</span>
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

                  {/* CTA */}
                  <div className="mt-4 flex items-center text-[#059669] group-hover:gap-2">
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
          <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
            <p className="text-slate-500">
              {searchQuery
                ? 'Tidak ada pasien yang sesuai dengan pencarian'
                : 'Tidak ada pasien terdaftar'}
            </p>
          </div>
        )}

        {/* Footer Stats */}
        {!loading && (
          <div className="mt-8 rounded-lg bg-slate-100 p-4 text-center text-sm text-slate-600">
            Menampilkan {filteredPatients.length} dari {patients.length} pasien
          </div>
        )}
      </div>
    </div>
  );
}