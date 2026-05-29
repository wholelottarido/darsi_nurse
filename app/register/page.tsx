"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          namaLengkap: fullName,
          telepon: phone,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Registrasi gagal. Coba lagi.");
        setLoading(false);
        return;
      }

      setMessage("Registrasi berhasil. Menunggu persetujuan admin.");
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      console.error("❌ Register error:", error);
      setMessage("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center">
        <div className="mb-4 flex w-full justify-end">
          <ThemeToggle />
        </div>
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.3)]">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            <div className="relative hidden items-center justify-center bg-gradient-to-br from-[#0F766E] to-[#14B8A6] p-10 text-white md:flex">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  DARSI Nurse
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Register Perawat
                </h1>
                <p className="text-sm text-teal-50/90">
                  Daftarkan akun perawat baru untuk akses sistem klinis.
                </p>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-xs leading-relaxed">
                  Akun akan berstatus inactive sampai diaktifkan oleh administrator.
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-10">
              <div className="mb-8 space-y-2">
                <p className="text-xs font-bold tracking-widest text-slate-400">
                  FORM REGISTRASI
                </p>
                <h2 className="text-2xl font-extrabold text-slate-800">
                  Buat Akun Perawat
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  Lengkapi data di bawah untuk diajukan ke administrator.
                </p>
              </div>

              <Separator className="my-6" />

              <form className="space-y-6" onSubmit={handleSubmit}>
                {message && (
                  <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${message.includes("berhasil") ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-600"}`}>
                    {message}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Masukkan username"
                    className="w-full rounded-2xl text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    className="w-full rounded-2xl text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Nama Lengkap
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full rounded-2xl text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Telepon
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-2xl text-sm font-semibold"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#0F766E] shadow-[0_12px_24px_-12px_rgba(15,118,110,0.7)] hover:bg-[#0B5F59] focus-visible:ring-[#0F766E]/25"
                >
                  {loading ? "Memproses..." : "Ajukan Registrasi"}
                </Button>
              </form>

              <p className="mt-6 text-xs font-medium text-slate-500">
                Sudah punya akun?{" "}
                <Link href="/login" className="font-bold text-[#0F766E] hover:text-[#0B5F59]">
                  Masuk di sini
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
