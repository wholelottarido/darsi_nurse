"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Patient {
  id: string;
  nama: string;
  usia: number;
  tanggal_lahir: string;
  jenis_kelamin: string;
  nomor_rekam_medis: string;
  berat_badan: number;
  tinggi_badan: number;
  gol_darah: string;
  alergi: string;
  riwayat_penyakit: string;
  created_at: string;
}

export default function PasienPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    berat_badan: "",
    tinggi_badan: "",
    gol_darah: "",
    alergi: "",
    riwayat_penyakit: ""
  });
  const [message, setMessage] = useState("");

  // Fetch all patients
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api");
      const data = await res.json();
      setPatients(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setLoading(false);
    }
  };

  // Search filter
  const filteredPatients = patients.filter(p =>
    p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nomor_rekam_medis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Delete patient
  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus pasien ini?")) return;

    try {
      const res = await fetch(`/api?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("✅ Pasien berhasil dihapus!");
        fetchPatients();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("❌ Gagal menghapus pasien");
    }
  };

  // Edit medical data
  const startEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setEditData({
      berat_badan: patient.berat_badan.toString(),
      tinggi_badan: patient.tinggi_badan.toString(),
      gol_darah: patient.gol_darah,
      alergi: patient.alergi,
      riwayat_penyakit: patient.riwayat_penyakit
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          berat_badan: parseFloat(editData.berat_badan),
          tinggi_badan: parseFloat(editData.tinggi_badan),
          gol_darah: editData.gol_darah,
          alergi: editData.alergi,
          riwayat_penyakit: editData.riwayat_penyakit
        })
      });

      if (res.ok) {
        setMessage("✅ Data medis berhasil diperbarui!");
        setEditingId(null);
        fetchPatients();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("❌ Gagal update data");
      }
    } catch (error) {
      setMessage("❌ Terjadi kesalahan");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
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
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#064E3B] mb-2">📋 Manajemen Pasien</h1>
          <p className="text-slate-600">Total: <span className="font-bold text-[#059669]">{patients.length}</span> pasien</p>
        </div>
        <Link href="/tambah-pasien" className="bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 px-6 rounded-xl shadow-lg">
          + Tambah Pasien Baru
        </Link>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 mb-6 rounded-lg font-bold ${message.includes("✅") ? "bg-[#ECFDF5] text-[#059669]" : "bg-red-100 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Cari pasien (nama atau NRM)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-lg">
        <table className="w-full">
          <thead className="bg-[#064E3B] text-white">
            <tr className="text-sm uppercase">
              <th className="px-6 py-4 text-left">No. Rekam Medis</th>
              <th className="px-6 py-4 text-left">Nama Pasien</th>
              <th className="px-6 py-4 text-left">Usia</th>
              <th className="px-6 py-4 text-left">BB/TB</th>
              <th className="px-6 py-4 text-left">Gol. Darah</th>
              <th className="px-6 py-4 text-left">Alergi</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPatients.map((patient) => (
              <tr key={patient.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-bold text-[#059669]">{patient.nomor_rekam_medis}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{patient.nama}</td>
                <td className="px-6 py-4">{patient.usia} tahun</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === patient.id ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={editData.berat_badan}
                        onChange={(e) => setEditData({ ...editData, berat_badan: e.target.value })}
                        className="w-12 p-1 border rounded"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editData.tinggi_badan}
                        onChange={(e) => setEditData({ ...editData, tinggi_badan: e.target.value })}
                        className="w-12 p-1 border rounded"
                      />
                      <span>cm</span>
                    </div>
                  ) : (
                    <span>{patient.berat_badan}kg / {patient.tinggi_badan}cm</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === patient.id ? (
                    <input
                      type="text"
                      value={editData.gol_darah}
                      onChange={(e) => setEditData({ ...editData, gol_darah: e.target.value })}
                      className="w-12 p-1 border rounded"
                    />
                  ) : (
                    <span className="bg-[#ECFDF5] text-[#059669] px-3 py-1 rounded font-bold">{patient.gol_darah}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === patient.id ? (
                    <input
                      type="text"
                      value={editData.alergi}
                      onChange={(e) => setEditData({ ...editData, alergi: e.target.value })}
                      className="w-24 p-1 border rounded text-xs"
                    />
                  ) : (
                    <span className="text-slate-600">{patient.alergi}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingId === patient.id ? (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleSaveEdit(patient.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="bg-slate-400 hover:bg-slate-500 text-white px-3 py-1 rounded text-sm font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => startEdit(patient)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(patient.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-bold"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filteredPatients.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl mt-4">
          <p className="text-slate-600 text-lg">
            {searchTerm ? "Pasien tidak ditemukan" : "Belum ada data pasien"}
          </p>
        </div>
      )}

      {/* Back to home */}
      <div className="mt-8">
        <Link href="/" className="text-[#059669] hover:text-[#047857] font-bold underline">
          ← Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
