"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

type Patient = {
  id?: string;
  nama?: string;
  full_name?: string;
  created_at?: string;
  nomor_rekam_medis?: string;
  no_rm?: string;
};

type PerawatSession = {
  id: string;
  username: string;
  namaLengkap: string;
  status: string;
};

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [perawat, setPerawat] = useState<PerawatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [patientsRes, perawatRes] = await Promise.all([
          fetch("/api", { method: "GET", cache: "no-store" }),
          fetch("/api/auth/me", { method: "GET", cache: "no-store" }),
        ]);

        if (!patientsRes.ok) {
          throw new Error("Gagal memuat data pasien.");
        }

        const patientsData = await patientsRes.json().catch(() => ({ patients: [] }));
        const patientList = Array.isArray(patientsData.patients) ? patientsData.patients : [];

        if (isMounted) {
          setPatients(patientList);
        }

        if (perawatRes.ok) {
          const perawatData = await perawatRes.json().catch(() => ({}));
          if (isMounted) {
            setPerawat(perawatData.perawat ?? null);
          }
        } else if (perawatRes.status !== 401 && isMounted) {
          setError("Gagal memuat data perawat.");
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = perawat?.namaLengkap || perawat?.username || "Perawat";
  const totalPasien = patients.length;
  const recentPatients = patients.slice(0, 5);

  const getPatientName = (patient: Patient) => patient.nama || patient.full_name || "Pasien";
  const getPatientMrn = (patient: Patient) => patient.nomor_rekam_medis || patient.no_rm || "-";

  const formatRelativeTime = (value?: string) => {
    if (!value) return "Hari ini";
    const diff = Date.now() - new Date(value).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Hari ini";
    if (days === 1) return "1 hari lalu";
    return `${days} hari lalu`;
  };

  const getInitials = (name?: string) => {
    if (!name) return "PA";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#f8fffb] to-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#064E3B]">
              Selamat datang, {displayName}!
            </h2>
            <p className="text-sm text-slate-600">
              Ringkasan aktivitas klinik dan akses cepat yang mengikuti gaya manajemen pasien.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#047857]">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              Perawat aktif: {perawat?.status || "-"}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/pasien"
              className="inline-flex items-center justify-center rounded-2xl border border-[#bbf7d0] bg-white px-5 py-3 text-sm font-semibold text-[#047857] shadow-sm transition hover:border-[#86efac] hover:bg-[#f0fdf4]"
            >
              Lihat Pasien
            </Link>
            <Link
              href="/tambah-pasien"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95"
            >
              + Pasien Baru
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">TOTAL PASIEN</p>
            <p className="text-4xl font-extrabold text-[#064E3B]">{loading ? "..." : totalPasien}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4F1] text-[#239B81]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">PASIEN RAWAT INAP</p>
            <p className="text-4xl font-extrabold text-[#064E3B]">0</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2FC] text-[#4B73E1]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">ANTRIAN TRIAGE</p>
            <p className="text-4xl font-extrabold text-[#064E3B]">0</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF0F2] text-[#ED5A70]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#059669]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            Aksi Cepat
          </div>

          <div className="space-y-4">
            <Link
              href="/tambah-pasien"
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:border-[#059669]/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white shadow-sm">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">Pasien Baru</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Buat rekam medis baru</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              href="/pasien"
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:border-[#059669]/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white shadow-sm">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">Manajemen Pasien</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Lihat, edit, hapus data pasien</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              href="/asisten-perawat"
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:border-[#059669]/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#065f46] via-[#047857] to-[#10b981] text-white shadow-sm">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">Asisten Perawat</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Satu chat untuk operasional dan panduan umum</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              href="#"
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:border-[#059669]/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#239B81] shadow-sm">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">Unggah Dokumen</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Analisis AI rekam medis</p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#059669]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Aktivitas Klinis Terkini
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            {loading ? (
              <div className="p-8 text-center text-sm font-medium text-slate-500">Memuat data pasien...</div>
            ) : recentPatients.length === 0 ? (
              <div className="p-8 text-center text-sm font-medium text-slate-500">Belum ada pasien terdaftar.</div>
            ) : (
              recentPatients.map((pasien, idx) => (
                <div
                  key={pasien.id || idx}
                  className="group flex cursor-pointer items-center justify-between border-b border-slate-100/80 p-5 transition-colors last:border-0 hover:bg-emerald-50/35"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-bold uppercase text-slate-500">
                      {getInitials(getPatientName(pasien))}
                    </div>
                    <div>
                      <div className="mb-1 flex items-baseline gap-2">
                        <p className="font-extrabold leading-none text-slate-800 capitalize">{getPatientName(pasien)}</p>
                        <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium text-slate-500">
                          {formatRelativeTime(pasien.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#FEF4E5] px-2 py-0.5 text-[0.65rem] font-bold tracking-widest text-[#D88A1A]">
                          OBSERVASI
                        </span>
                        <span className="text-xs font-semibold tracking-wide text-slate-400">RM: {getPatientMrn(pasien)}</span>
                      </div>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-slate-300 transition-colors group-hover:text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
