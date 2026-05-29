"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Patient {
  id: string;
  user_id?: number;
  no_rm?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  ktp_number?: string | null;
  medical_record?: string | null;
  insurance_type?: string | null;
  verified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source?: string | null;
}

export default function PasienPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api");
      const data = await res.json();
      // API returns { patients: [...] }, so extract the array
      setPatients(data.patients && Array.isArray(data.patients) ? data.patients : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setLoading(false);
    }
  };

  // Fetch all patients
  useEffect(() => {
    fetchPatients();
  }, []);

  // Search filter (full_name, no_rm, email, phone)
  const filteredPatients = patients.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.no_rm || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  });

  const getInitials = (name?: string) => {
    if (!name) return "-";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sourceClassName = (source?: string | null) => {
    const normalized = (source || "").toLowerCase();
    if (normalized === "manual") {
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    }
    if (!normalized) {
      return "bg-slate-100 text-slate-600 ring-slate-200";
    }
    return "bg-blue-50 text-blue-700 ring-blue-200";
  };

  

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-center py-20">
          <p className="text-xl text-slate-600">Memuat data pasien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#f8fffb] to-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#064E3B]">Manajemen Pasien</h1>
            <p className="text-sm text-slate-600">Data pasien ditampilkan sesuai perawat login dari database hospital_cs.</p>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#047857]">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              {filteredPatients.length} pasien ditampilkan
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="text"
              placeholder="Cari nama, NRM, email, telepon"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-72 rounded-2xl border-slate-300 bg-white/80"
            />
            <Button asChild className="rounded-2xl shadow-sm">
              <Link href="/tambah-pasien">+ Tambah Pasien</Link>
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_40px_-24px_rgba(2,6,23,0.45)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10 text-white">
              <tr className="bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-left text-xs font-semibold uppercase tracking-wider">
                <th className="px-5 py-4">Pasien</th>
                <th className="px-5 py-4">No. RM</th>
                <th className="px-5 py-4">Kontak</th>
                <th className="px-5 py-4">Lahir</th>
                <th className="px-5 py-4">KTP</th>
                <th className="px-5 py-4">Sumber</th>
                <th className="px-5 py-4">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPatients.map((patient, index) => (
                <tr
                  key={patient.id}
                  className={`transition hover:bg-emerald-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/45"}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
                        {getInitials(patient.full_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{patient.full_name || "-"}</p>
                        <p className="text-xs text-slate-500">ID #{patient.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-emerald-700">{patient.no_rm || "-"}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <p className="text-slate-700">{patient.phone || "-"}</p>
                      <p className="text-xs text-slate-500">{patient.email || "-"}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{formatDate(patient.date_of_birth)}</td>
                  <td className="px-5 py-4 text-slate-700">{patient.ktp_number || "-"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${sourceClassName(patient.source)}`}>
                      {patient.source || "-"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(patient.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {filteredPatients.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-lg font-medium text-slate-600">
            {searchTerm ? "Pasien tidak ditemukan" : "Belum ada data pasien"}
          </p>
          <p className="mt-1 text-sm text-slate-500">Coba ubah kata kunci pencarian atau tambahkan pasien baru.</p>
        </div>
      )}

      {/* Back to home */}
      <div className="mt-8">
        <Link href="/dashboard" className="font-semibold text-[#059669] hover:text-[#047857]">
          ← Kembali ke Beranda
        </Link>
      </div>

      
    </div>
  );
}
