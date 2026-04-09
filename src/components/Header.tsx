export default function Header() {
  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 flex-shrink-0">
      <div className="relative w-96">
        <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" placeholder="Cari pasien..." className="w-full bg-[#f1f5f9] border border-transparent rounded-full py-2 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]/20 transition-all font-medium" />
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800 tracking-tight">DR JOKO MULYO</p>
          <p className="text-[0.65rem] font-bold text-slate-400 tracking-widest">DOKTER DPJP</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
          {/* Avatar Placeholder */}
        </div>
      </div>
    </header>
  );
}