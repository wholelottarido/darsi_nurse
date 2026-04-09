"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
      <div className="h-20 flex items-center px-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#059669] flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
          </div>
          <div>
            <h1 className="font-bold text-[#059669] leading-tight tracking-wider">JUMEDIC</h1>
            <p className="text-[0.6rem] text-slate-400 font-medium tracking-widest uppercase">Junaidi Medical Claim</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 overflow-y-auto w-full">
        <div className="px-6 mb-4">
          <p className="text-xs font-bold text-slate-400 tracking-widest mb-4">MENU UTAMA</p>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 tracking-widest mb-2 mt-6">OPERASIONAL</p>
            <Link href="/" className={`flex items-center gap-3 px-4 py-2.5 rounded-r-full -ml-6 pl-10 mr-4 font-medium text-sm transition-colors ${isActive('/') ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              Overview
            </Link>
            <Link href="/pasien" className={`flex items-center gap-3 px-4 py-2.5 rounded-r-full -ml-6 pl-10 mr-4 font-medium text-sm transition-colors ${isActive('/pasien') ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Manajemen Pasien
            </Link>
          </div>

          <div className="space-y-1 mt-8">
            <p className="text-xs font-bold text-slate-400 tracking-widest mb-2">KLINIS</p>
            <Link href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-r-full -ml-6 pl-10 mr-4 font-medium text-sm transition-colors">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Triage IGD
            </Link>
            <Link href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-r-full -ml-6 pl-10 mr-4 font-medium text-sm transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Catatan Pasien
            </Link>
            <Link href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-r-full -ml-6 pl-10 mr-4 font-medium text-sm transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Klaim & Resume
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}