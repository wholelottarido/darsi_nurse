import type { PerawatSession } from "@/lib/nurse-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import MobileSidebarSheet from "@/components/MobileSidebarSheet";
import { ThemeToggle } from "@/components/theme-toggle";

type HeaderProps = {
  perawat: PerawatSession;
};

export default function Header({ perawat }: HeaderProps) {
  const displayName = perawat.namaLengkap || perawat.username;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => name[0]?.toUpperCase())
      .join("") || perawat.username.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-20 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 lg:px-10">
      <div className="flex items-center gap-3">
        <MobileSidebarSheet />
        <div className="relative hidden w-96 lg:block">
          <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <Input
            type="text"
            placeholder="Cari pasien..."
            className="w-full rounded-full pl-10 pr-4 text-sm font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <ThemeToggle />
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800 tracking-tight">
            {displayName}
          </p>
          <p className="text-[0.65rem] font-bold text-slate-400 tracking-widest">
            Perawat RSI · {perawat.status}
          </p>
        </div>
        <Avatar className="h-10 w-10 border border-[#059669]/20 bg-[#E6F4F1]">
          <AvatarFallback className="bg-[#E6F4F1] text-sm font-extrabold text-[#059669]">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
