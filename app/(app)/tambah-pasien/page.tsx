"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function TambahPasien() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // Refs untuk setiap input
  const namaRef = useRef<HTMLInputElement>(null);
  const usiaRef = useRef<HTMLInputElement>(null);
  const tanggalLahirRef = useRef<HTMLInputElement>(null);
  const jenisKelaminRef = useRef<HTMLSelectElement>(null);
  const nrmRef = useRef<HTMLInputElement>(null);
  const beratBadanRef = useRef<HTMLInputElement>(null);
  const tinggiBadanRef = useRef<HTMLInputElement>(null);
  const golDarahRef = useRef<HTMLSelectElement>(null);
  const alergiRef = useRef<HTMLInputElement>(null);
  const riwayatPenyakitRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmitClick = async () => {
    setLoading(true);
    setMessage("");

    // Validasi required fields
    if (!namaRef.current?.value || !usiaRef.current?.value || !tanggalLahirRef.current?.value || !jenisKelaminRef.current?.value) {
      setMessage("❌ Nama, Usia, Tanggal Lahir, dan Jenis Kelamin wajib diisi!");
      setLoading(false);
      return;
    }

    const payload = {
      nama: namaRef.current.value,
      usia: parseInt(usiaRef.current.value),
      tanggal_lahir: tanggalLahirRef.current.value,
      jenis_kelamin: jenisKelaminRef.current.value,
      nomor_rekam_medis: nrmRef.current?.value || `RM-${Date.now()}`,
      berat_badan: parseFloat(beratBadanRef.current?.value || "0") || 0,
      tinggi_badan: parseFloat(tinggiBadanRef.current?.value || "0") || 0,
      gol_darah: golDarahRef.current?.value || "-",
      alergi: alergiRef.current?.value || "-",
      riwayat_penyakit: riwayatPenyakitRef.current?.value || "-"
    };

    console.log('📤 Form submitted dengan data:', payload);

    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage("✅ Data pasien berhasil disimpan!");
        setTimeout(() => {
          router.refresh();
          router.push("/dashboard");
        }, 1500);
      } else {
        const errorData = await res.json().catch(() => ({ error: "Gagal menyimpan data" }));
        setMessage(`❌ ${errorData.error || 'Gagal menyimpan data'}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setMessage("❌ Terjadi kesalahan sistem.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white shadow-lg rounded-3xl mt-10">
      <h1 className="text-2xl font-bold mb-6 text-[#064E3B] border-b pb-4">🩺 Form Input Pasien Baru (DARSI)</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded font-bold ${message.includes("✅") ? "bg-[#ECFDF5] text-[#059669]" : "bg-red-100 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-black">
        {/* DATA PRIBADI */}
        <div className="col-span-2 text-sm font-semibold text-[#059669] mt-2">Data Pribadi</div>
        <Input ref={namaRef} placeholder="Nama Lengkap" required />
        <Input ref={usiaRef} type="number" placeholder="Usia" required />
        <Input ref={tanggalLahirRef} type="date" required />
        <select ref={jenisKelaminRef} className="p-3 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#059669] focus:border-[#059669] bg-white" required>
          <option value="">Pilih Jenis Kelamin</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>

        {/* DATA MEDIS */}
        <Separator className="col-span-2 my-2" />
        <div className="col-span-2 text-sm font-semibold text-[#059669] mt-2">Data Rekam Medis</div>
        <Input ref={nrmRef} placeholder="No. Rekam Medis (Contoh: RM-001)" required />
        <div className="flex gap-2">
          <Input ref={beratBadanRef} type="number" step="0.1" placeholder="BB (kg)" />
          <Input ref={tinggiBadanRef} type="number" step="0.1" placeholder="TB (cm)" />
        </div>
        <select ref={golDarahRef} className="p-3 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#059669] focus:border-[#059669] bg-white">
          <option value="">Gol. Darah</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="AB">AB</option>
          <option value="O">O</option>
        </select>
        <Input ref={alergiRef} placeholder="Alergi (jika ada)" />
        <textarea ref={riwayatPenyakitRef} placeholder="Riwayat Penyakit" className="p-3 border rounded-xl col-span-2 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:border-[#059669]" rows={3}></textarea>

        <Button
          onClick={handleSubmitClick}
          disabled={loading}
          className="col-span-2 mt-4 shadow-lg shadow-[#059669]/20"
        >
          {loading ? "Menyimpan..." : "Simpan Data Pasien"}
        </Button>
        <Button
          type="button" 
          onClick={() => router.push('/dashboard')}
          variant="secondary"
          className="col-span-2"
        >
          Batal Formulir
        </Button>
      </div>
    </div>
  );
}
