"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  ClipboardList,
  MessageSquare,
  PanelLeft,
  Pill,
  Plus,
  Send,
  Stethoscope,
} from "lucide-react";

import MarkdownMessage from "@/components/MarkdownMessage";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PerawatSession = {
  username: string;
  namaLengkap: string;
};

type NurseChatIntent = "operational" | "general_guidance" | "hybrid";

type NurseChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  intent?: NurseChatIntent;
  delegatedAgents?: string[];
};

type NurseChatHistoryItem = {
  id: number;
  role: "user" | "assistant";
  message: string;
  intent?: NurseChatIntent | null;
  delegatedAgents?: string[];
  createdAt: string;
};

type NurseChatSession = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type NurseChatStatus = {
  status: string;
  activeSessionId?: number | null;
  history?: NurseChatHistoryItem[];
  sessions?: NurseChatSession[];
  modes?: {
    operational?: {
      model?: string;
      provider?: string;
    };
    general?: {
      model?: string;
      provider?: string;
    };
  };
};

const SUGGESTION_GROUPS = [
  {
    title: "Operasional",
    helper: "Gunakan untuk data sistem rumah sakit.",
    prompts: [
      "Apakah parasetamol tersedia?",
      "Siapa saja pasien yang sedang saya tangani?",
      "Ringkasan singkat pasien RM002",
      "Stok amoksisilin ada berapa?",
    ],
  },
  {
    title: "Panduan Umum",
    helper: "Gunakan untuk observasi, edukasi, dan penanganan umum.",
    prompts: [
      "Apa penanganan umum untuk pasien demam dan batuk?",
      "Observasi awal apa yang perlu dipantau pada pasien sesak?",
      "Edukasi singkat untuk pasien nyeri kaki apa saja?",
      "Langkah awal untuk pasien mual muntah apa?",
    ],
  },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getIntentLabel(intent?: NurseChatIntent) {
  switch (intent) {
    case "operational":
      return "Operasional";
    case "hybrid":
      return "Hybrid";
    case "general_guidance":
    default:
      return "Panduan Umum";
  }
}

function mapHistoryToMessages(history: NurseChatHistoryItem[]): NurseChatMessage[] {
  return history.map((item) => ({
    id: `history-${item.id}`,
    role: item.role,
    content: item.message,
    timestamp: item.createdAt,
    intent: item.intent ?? undefined,
    delegatedAgents: Array.isArray(item.delegatedAgents) ? item.delegatedAgents : [],
  }));
}

function buildIntroMessage(): NurseChatMessage {
  return {
    id: "intro",
    role: "assistant",
    content:
      "Gunakan satu kolom chat ini untuk dua kebutuhan: data operasional perawat dan panduan penanganan umum. Sistem akan memilih agent otomatis sesuai isi pertanyaan.",
    timestamp: new Date().toISOString(),
    intent: "hybrid",
    delegatedAgents: ["operational", "general_guidance"],
  };
}

export default function NurseAssistantPage() {
  const [perawat, setPerawat] = useState<PerawatSession | null>(null);
  const [status, setStatus] = useState<NurseChatStatus | null>(null);
  const [messages, setMessages] = useState<NurseChatMessage[]>([]);
  const [sessions, setSessions] = useState<NurseChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const capabilitySummary = useMemo(
    () => [
      {
        title: "Operasional",
        icon: Pill,
        description: "Stok obat, daftar pasien yang ditangani, ringkasan singkat pasien.",
        model: status?.modes?.operational?.model || "-",
      },
      {
        title: "Panduan Umum",
        icon: Stethoscope,
        description: "Penanganan umum pasien, observasi awal, edukasi, rekomendasi tindakan.",
        model: status?.modes?.general?.model || "-",
      },
    ],
    [status]
  );

  async function loadPage(sessionId?: number | null) {
    try {
      setLoading(true);
      const query = typeof sessionId === "number" ? `?sessionId=${sessionId}` : "";
      const [perawatRes, statusRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/nurse-chat${query}`, { cache: "no-store" }),
      ]);

      if (!perawatRes.ok) {
        throw new Error("Gagal memuat sesi perawat.");
      }
      if (!statusRes.ok) {
        const payload = await statusRes.json().catch(() => ({}));
        throw new Error(payload.error || "Gagal memuat data chat.");
      }

      const perawatData = await perawatRes.json();
      const statusData = (await statusRes.json()) as NurseChatStatus;

      setPerawat(perawatData.perawat ?? null);
      setStatus(statusData);
      setSessions(Array.isArray(statusData.sessions) ? statusData.sessions : []);
      setActiveSessionId(typeof statusData.activeSessionId === "number" ? statusData.activeSessionId : null);

      const history = Array.isArray(statusData.history) ? statusData.history : [];
      setMessages(history.length > 0 ? mapHistoryToMessages(history) : [buildIntroMessage()]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  async function openSession(sessionId: number) {
    if (sending || sessionId === activeSessionId) return;
    await loadPage(sessionId);
  }

  async function startNewChat() {
    if (sending) return;

    try {
      setSending(true);
      setError(null);

      const response = await fetch("/api/nurse-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "createSession" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Gagal membuat chat baru.");
      }

      const data = await response.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setActiveSessionId(typeof data.activeSessionId === "number" ? data.activeSessionId : null);
      setMessages([buildIntroMessage()]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(prompt?: string) {
    const message = (prompt ?? input).trim();
    if (!message || sending) return;

    const userMessage: NurseChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => {
      const next = prev.length === 1 && prev[0]?.id === "intro" ? [] : prev;
      return [...next, userMessage];
    });
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/nurse-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          sessionId: activeSessionId,
          createNewSession: activeSessionId == null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Gagal mengirim pesan.");
      }

      const data = await response.json();
      const nextActiveSessionId = typeof data.sessionId === "number" ? data.sessionId : activeSessionId;
      const nextSessions = Array.isArray(data.sessions) ? data.sessions : sessions;
      const history = Array.isArray(data.history) ? data.history : [];

      setSessions(nextSessions);
      setActiveSessionId(nextActiveSessionId ?? null);
      setMessages(history.length > 0 ? mapHistoryToMessages(history) : [buildIntroMessage()]);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(messageText);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${messageText}`,
          timestamp: new Date().toISOString(),
          intent: "hybrid",
          delegatedAgents: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const activeSessionTitle =
    sessions.find((item) => item.id === activeSessionId)?.title || (activeSessionId ? "Chat" : "Chat baru");

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full max-w-7xl items-center justify-center p-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-sm font-medium text-slate-600 shadow-sm">
          Memuat asisten perawat...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {showSidebar ? (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-200 p-4">
              <Button
                type="button"
                onClick={() => void startNewChat()}
                className="w-full rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white"
              >
                <Plus className="h-4 w-4" />
                Chat Baru
              </Button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Belum ada chat sebelumnya.
                </div>
              ) : (
                sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => void openSession(session.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-xl p-2 ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{session.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatSessionTime(session.updatedAt)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        ) : null}

        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => setShowSidebar((value) => !value)}>
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{activeSessionTitle}</p>
                    <p className="text-sm text-slate-500">
                      {perawat?.namaLengkap || perawat?.username || "Perawat"}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Bot className="h-3.5 w-3.5" />
                  Delegasi otomatis aktif
                </div>
              </div>

              <Collapsible open={infoOpen} onOpenChange={setInfoOpen} className="rounded-2xl border border-slate-200 bg-slate-50">
                <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Info Asisten Perawat</p>
                    <p className="text-xs text-slate-500">
                      Operasional dan panduan umum dalam satu chat.
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${infoOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-slate-200 px-4 py-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {capabilitySummary.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-2 flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <p className="text-xs text-slate-500">{item.model}</p>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ClipboardList className="h-4 w-4 text-emerald-700" />
                      Suggestion pertanyaan
                    </div>
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                      Hindari mencampur stok obat, daftar pasien, dan panduan klinis umum dalam satu kalimat bila tidak perlu.
                      Lebih aman kirim satu intent per pesan agar agent memilih jalur yang tepat.
                    </div>
                    <div className="space-y-4">
                      {SUGGESTION_GROUPS.map((group) => (
                        <div key={group.title}>
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                            <p className="text-xs text-slate-500">{group.helper}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.prompts.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                onClick={() => void sendMessage(prompt)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-4xl rounded-3xl px-4 py-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        {getIntentLabel(message.intent)}
                      </span>
                      {Array.isArray(message.delegatedAgents) && message.delegatedAgents.length > 0 ? (
                        <span className="text-slate-500">{message.delegatedAgents.join(" + ")}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <MarkdownMessage className="space-y-3 text-sm leading-6" content={message.content} />
                  <p className={`mt-2 text-[11px] ${message.role === "user" ? "text-emerald-50/90" : "text-slate-400"}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            {error ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={3}
                placeholder="Contoh: Apakah parasetamol tersedia? atau Apa observasi awal untuk pasien sesak?"
                className="min-h-[92px] flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
              <Button
                type="button"
                className="h-12 rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] px-5 text-white"
                onClick={() => void sendMessage()}
                disabled={sending || !input.trim()}
              >
                <Send className="h-4 w-4" />
                {sending ? "Mengirim..." : "Kirim"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
