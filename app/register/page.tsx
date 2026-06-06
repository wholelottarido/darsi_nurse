"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        setIsError(true);
        setLoading(false);
        return;
      }

      setMessage("Registrasi berhasil. Menunggu persetujuan admin.");
      setIsError(false);
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      console.error("Register error:", error);
      setMessage("Terjadi kesalahan. Coba lagi.");
      setIsError(true);
      setLoading(false);
    }
  };

  return (
    <main className="app-auth-shell">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="app-auth-brand-badge">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="app-auth-brand-title">DARSI</p>
          <p className="app-auth-brand-subtitle">Daftar Akun Perawat</p>
        </div>

        <section className="app-auth-card">
          <h1 className="app-auth-heading">Daftar Akun</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lengkapi data di bawah untuk diajukan ke administrator.
          </p>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="fullName" className="app-form-label">
                Nama Lengkap
              </label>
              <div className="relative mt-1.5">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Masukkan nama lengkap"
                  required
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="app-form-label">
                Username
              </label>
              <div className="relative mt-1.5">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Masukkan username"
                  required
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="app-form-label">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                  required
                  className="h-11 pl-9 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="app-form-label">
                Telepon
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="app-soft-panel">
              Akun akan berstatus inactive sampai diaktifkan oleh administrator.
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base"
              disabled={loading}
            >
              <ArrowRight className="h-4 w-4" />
              {loading ? "Memproses..." : "Ajukan Registrasi"}
            </Button>
          </form>

          {message ? (
            <p className={`mt-3 text-sm ${isError ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </p>
          ) : null}

          <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/login" className="app-link-primary">
              Login
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
