"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Login gagal. Coba lagi.");
        setLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Login terlalu lama. Coba lagi."
          : "Terjadi kesalahan. Coba lagi."
      );
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
        <div className="mb-4 flex w-full justify-end">
          <ThemeToggle />
        </div>
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.3)]">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            <div className="relative hidden items-center justify-center bg-gradient-to-br from-[#059669] to-[#10B981] p-10 text-white md:flex">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  DARSI Nurse
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Login Perawat
                </h1>
                <p className="text-sm text-emerald-50/90">
                  Akses data pasien dan triage secara aman menggunakan akun perawat.
                </p>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-xs leading-relaxed">
                  Pastikan username dan password sesuai dengan akun yang sudah disetujui administrator.
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-10">
              <div className="mb-8 space-y-2">
                <p className="text-xs font-bold tracking-widest text-slate-400">
                  SISTEM LOGIN
                </p>
                <h2 className="text-2xl font-extrabold text-slate-800">
                  Masuk ke Dashboard
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  Gunakan akun perawat yang sudah aktif.
                </p>
              </div>

              <Separator className="my-6" />

              <form className="space-y-6" onSubmit={handleSubmit}>
                {message && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl"
                >
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
              </form>

              <p className="mt-6 text-xs font-medium text-slate-500">
                Belum punya akun?{" "}
                <Link href="/register" className="font-bold text-[#059669] hover:text-[#047857]">
                  Daftar di sini
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
