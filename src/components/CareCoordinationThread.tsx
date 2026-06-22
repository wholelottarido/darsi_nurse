"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TimelineItem = {
  id: string;
  kind: "message" | "nurse_note" | "doctor_soap";
  at: string;
  author_role: "nurse" | "doctor" | "system";
  author_name: string;
  title: string;
  body: string;
};

type Props = {
  registrationId: number | null;
  authorRole: "nurse" | "doctor";
  authorUsername: string;
  authorName: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function CareCoordinationThread({ registrationId, authorRole, authorUsername, authorName }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!registrationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/care-coordination?registrationId=${registrationId}`, { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.data) ? data.data : []);
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    void load();
    if (!registrationId) return;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load, registrationId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!registrationId || !messageText.trim()) return;
    setSending(true);
    try {
      await fetch("/api/care-coordination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          authorRole,
          authorUsername,
          authorName,
          messageText: messageText.trim(),
          messageType: "note",
        }),
      });
      setMessageText("");
      await load();
    } finally {
      setSending(false);
    }
  };

  if (!registrationId) {
    return <p className="text-xs text-slate-500">Registrasi belum tersedia untuk koordinasi.</p>;
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-700">Koordinasi Dokter & Perawat</p>
      <p className="mb-3 text-xs text-slate-600">Riwayat tektokan penanganan pasien (sinkron ke HRIS).</p>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat...</p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada riwayat.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{item.author_name}</span>
                  <span>•</span>
                  <span>{item.author_role === "nurse" ? "Perawat" : item.author_role === "doctor" ? "Dokter" : "Sistem"}</span>
                  <span>•</span>
                  <span>{formatTime(item.at)}</span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-600">{item.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.body}</p>
              </div>
            ))
          )}
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-3 flex gap-2">
        <Input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="Tulis koordinasi ke rekan..."
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !messageText.trim()}>
          Kirim
        </Button>
      </form>
    </div>
  );
}
