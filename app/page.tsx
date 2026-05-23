import Link from "next/link";
import { getAllPatients } from "../src/lib/get-patient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Fetch data dari database untuk ditampilkan informasinya di dashboard
  const patients = await getAllPatients() || [];
  const totalPasien = patients.length;
  const recentPatients = patients.slice(0, 5); // Tampilkan maksimal 5 pasien terbaru

  return (
    <div className="p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Greeting */}
        <div>
          <h2 className="text-3xl font-extrabold text-[#064E3B] mb-2 tracking-tight">Selamat datang, Perawat!</h2>
          <p className="text-slate-500 text-sm font-medium">Berikut adalah ringkasan aktivitas klinik Anda hari ini.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">TOTAL PASIEN</p>
              <p className="text-4xl font-extrabold text-[#064E3B]">{totalPasien}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#E6F4F1] flex items-center justify-center text-[#239B81]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">PASIEN RAWAT INAP</p>
              <p className="text-4xl font-extrabold text-[#064E3B]">0</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FC] flex items-center justify-center text-[#4B73E1]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">ANTRIAN TRIAGE</p>
              <p className="text-4xl font-extrabold text-[#064E3B]">0</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#FEF0F2] flex items-center justify-center text-[#ED5A70]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Actions */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-[#059669] font-bold text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              Aksi Cepat
            </div>
            <div className="space-y-4">
              
              <Link href="/tambah-pasien" className="block p-5 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-2xl hover:border-[#059669]/30 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#059669] flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800">Pasien Baru</p>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">Buat rekam medis baru</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-[#059669] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
              </Link>

              <Link href="/pasien" className="block p-5 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-2xl hover:border-[#059669]/30 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#059669] flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800">Manajemen Pasien</p>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">Lihat, edit, hapus data pasien</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-[#059669] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
              </Link>

              <Link href="#" className="block p-5 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-2xl hover:border-[#059669]/30 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#239B81] shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800">Unggah Dokumen</p>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">Analisis AI rekam medis</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-[#059669] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
              </Link>

            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-[#059669] font-bold text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
              Aktivitas Klinis Terkini
            </div>
            
            <div className="bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-2xl flex flex-col overflow-hidden">
              {recentPatients.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm font-medium">Belum ada pasien terdaftar.</div>
              ) : (
                recentPatients.map((pasien, idx) => {
                  let timeString = 'Hari ini';
                  if (pasien.created_at) {
                     const diff = Date.now() - new Date(pasien.created_at).getTime();
                     const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                     if (days > 0) timeString = `${days} hari lalu`;
                  }

                  return (
                    <div key={pasien.id || idx} className="p-5 flex items-center justify-between border-b last:border-0 border-slate-100/80 hover:bg-slate-50/80 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase text-sm">
                          {pasien.nama?.slice(0, 2) || 'NA'}
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <p className="font-extrabold text-slate-800 capitalize leading-none">{pasien.nama}</p>
                            <span className="text-[0.7rem] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-sm font-medium">
                              {timeString}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold tracking-widest bg-[#FEF4E5] text-[#D88A1A]">OBSERVASI</span>
                            <span className="text-xs text-slate-400 font-semibold tracking-wide">RM: {pasien.nomor_rekam_medis || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-[#059669] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
