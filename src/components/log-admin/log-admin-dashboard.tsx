"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { AgentInteractionLog } from "@/lib/agent-interaction-logs";
import type {
  AgentDataSourceLog,
  AgentPerformanceLog,
} from "@/lib/agent-observability-details";

type RegisteredNurseOption = {
  id: number;
  username: string;
};

type LogAdminDashboardProps = {
  logs: AgentInteractionLog[];
  registeredNurses: RegisteredNurseOption[];
};

type InteractionDetailResponse = {
  interactionLog: AgentInteractionLog;
  dataSourceLogs: AgentDataSourceLog[];
  performanceLogs: AgentPerformanceLog[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDurationSeconds(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const seconds = value / 1000;
  if (seconds >= 10) {
    return `${seconds.toFixed(1)} detik`;
  }

  return `${seconds.toFixed(2)} detik`;
}

function readModelsUsed(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") {
    return [] as string[];
  }

  const raw = metadata.modelsUsed;
  if (!Array.isArray(raw)) {
    return [] as string[];
  }

  return raw.map((item) => String(item).trim()).filter(Boolean);
}

function readPrimaryModel(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const raw = metadata.primaryModel;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function summarizeText(value?: string | null, maxLength = 180) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function LogAdminDashboard({ logs, registeredNurses }: LogAdminDashboardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<InteractionDetailResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [nurseFilter, setNurseFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const successCount = logs.filter((item) => item.success).length;
    const errorCount = logs.length - successCount;
    const clinicalCount = logs.filter((item) => item.agent_type === "clinical").length;
    return { successCount, errorCount, clinicalCount };
  }, [logs]);

  const availableRoutes = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.route_name))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (statusFilter === "success" && !log.success) {
        return false;
      }
      if (statusFilter === "error" && log.success) {
        return false;
      }
      if (routeFilter !== "all" && log.route_name !== routeFilter) {
        return false;
      }
      if (nurseFilter !== "all") {
        const nurseUsername = (log.nurse_username || "").toLowerCase();
        if (nurseUsername !== nurseFilter.toLowerCase()) {
          return false;
        }
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        log.nurse_name,
        log.nurse_username,
        log.patient_name,
        log.patient_no_rm,
        log.route_name,
        log.intent,
        log.request_message,
        log.response_message,
        log.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [logs, nurseFilter, routeFilter, searchQuery, statusFilter]);

  async function openDetail(id: number) {
    setSelectedId(id);
    setIsOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/log-admin/interactions/${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load interaction detail");
      }
      setDetail(data as InteractionDetailResponse);
    } catch (detailError) {
      setDetail(null);
      setError(detailError instanceof Error ? detailError.message : "Failed to load interaction detail");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Interaction Logs</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{logs.length}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Sukses</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{counts.successCount}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Gagal</p>
          <p className="mt-3 text-3xl font-semibold text-rose-700">{counts.errorCount}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Clinical Route</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{counts.clinicalCount}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Activity Feed</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Daftar Aktivitas Agent</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Klik salah satu aktivitas untuk membuka detail tiga section: request log, source log, dan performance log.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px_240px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari perawat, pasien, route, request, atau response..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "success" | "error")}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="all">Semua Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="all">Semua Route</option>
            {availableRoutes.map((route) => (
              <option key={route} value={route}>{route}</option>
            ))}
          </select>
          <select
            value={nurseFilter}
            onChange={(event) => setNurseFilter(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="all">Semua Perawat</option>
            {registeredNurses.map((nurse) => (
              <option key={nurse.id} value={nurse.username}>{nurse.username}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 text-sm text-slate-500">
          Menampilkan {filteredLogs.length} dari {logs.length} interaction log.
        </div>

        <div className="mt-6 space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600">
              Tidak ada interaction log yang cocok dengan filter saat ini.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => openDetail(log.id)}
                className={`block w-full rounded-[24px] border p-5 text-left transition hover:border-slate-300 hover:bg-slate-50 ${selectedId === log.id ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-slate-50/60"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {log.agent_type}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${log.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {log.success ? "success" : "error"}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{formatDateTime(log.created_at)}</span>
                      {readPrimaryModel(log.metadata) ? (
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                          {readPrimaryModel(log.metadata)}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{log.route_name}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Perawat: <span className="font-medium text-slate-900">{log.nurse_name || log.nurse_username || "-"}</span>
                        {" · "}
                        Pasien: <span className="font-medium text-slate-900">{log.patient_name || log.patient_no_rm || "-"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:min-w-[320px]">
                    <p><span className="font-semibold text-slate-900">Intent:</span> {log.intent || "-"}</p>
                    <p><span className="font-semibold text-slate-900">Latency:</span> {formatDurationSeconds(log.latency_ms)}</p>
                    <p><span className="font-semibold text-slate-900">Triage Visit:</span> {log.triage_visit_id ?? "-"}</p>
                    <p><span className="font-semibold text-slate-900">Registration:</span> {log.registration_id ?? "-"}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{summarizeText(log.request_message)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Response</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {log.success ? summarizeText(log.response_message) : summarizeText(log.error_message)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                    Tools: {log.tools_used.length > 0 ? log.tools_used.join(", ") : "-"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                    Delegasi: {log.delegated_agents.length > 0 ? log.delegated_agents.join(", ") : "-"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-y-4 right-4 z-50 w-[min(960px,calc(100vw-2rem))] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-2xl font-semibold text-slate-950">
                  Detail Interaction Log
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                  Tiga section audit: request log, source provenance, dan performance metrics.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-6 space-y-6">
              {isLoading ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600">
                  Memuat detail interaction log...
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-8 text-sm text-rose-700">
                  {error}
                </div>
              ) : detail ? (
                <>
                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Agent Request Log</p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Metadata</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><span className="font-semibold text-slate-900">Route:</span> {detail.interactionLog.route_name}</p>
                          <p><span className="font-semibold text-slate-900">Agent:</span> {detail.interactionLog.agent_type}</p>
                          <p><span className="font-semibold text-slate-900">Intent:</span> {detail.interactionLog.intent || "-"}</p>
                          <p><span className="font-semibold text-slate-900">Perawat:</span> {detail.interactionLog.nurse_name || detail.interactionLog.nurse_username || "-"}</p>
                          <p><span className="font-semibold text-slate-900">Pasien:</span> {detail.interactionLog.patient_name || detail.interactionLog.patient_no_rm || "-"}</p>
                          <p><span className="font-semibold text-slate-900">Model:</span> {readModelsUsed(detail.interactionLog.metadata).length > 0 ? readModelsUsed(detail.interactionLog.metadata).join(", ") : "-"}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request & Response</p>
                        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-900">Request</p>
                            <p>{detail.interactionLog.request_message || "-"}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Response</p>
                            <p>{detail.interactionLog.success ? detail.interactionLog.response_message || "-" : detail.interactionLog.error_message || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                      Model: {readModelsUsed(detail.interactionLog.metadata).length > 0 ? readModelsUsed(detail.interactionLog.metadata).join(", ") : "-"}
                    </span>
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                        Tools: {detail.interactionLog.tools_used.length > 0 ? detail.interactionLog.tools_used.join(", ") : "-"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                        Delegasi: {detail.interactionLog.delegated_agents.length > 0 ? detail.interactionLog.delegated_agents.join(", ") : "-"}
                      </span>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source Log</p>
                    <div className="mt-4 space-y-3">
                      {detail.dataSourceLogs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                          Belum ada data source log untuk interaction ini.
                        </div>
                      ) : (
                        detail.dataSourceLogs.map((entry) => (
                          <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                                {entry.source_category}
                              </span>
                              <span className="font-semibold text-slate-900">{entry.table_name}</span>
                            </div>
                            <p className="mt-3"><span className="font-semibold text-slate-900">Reason:</span> {entry.reason || "-"}</p>
                            <p className="mt-2"><span className="font-semibold text-slate-900">Fields:</span> {entry.field_names.length > 0 ? entry.field_names.join(", ") : "-"}</p>
                            <p className="mt-2"><span className="font-semibold text-slate-900">Identifier:</span> {entry.record_identifier || "-"}</p>
                            <p className="mt-2"><span className="font-semibold text-slate-900">Summary:</span> {entry.source_summary || "-"}</p>
                          </article>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Performance Log</p>
                    <div className="mt-4 space-y-3">
                      {detail.performanceLogs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                          Belum ada performance log untuk interaction ini.
                        </div>
                      ) : (
                        detail.performanceLogs.map((entry) => (
                          <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <p><span className="font-semibold text-slate-900">Route:</span> {entry.route_name}</p>
                              <p><span className="font-semibold text-slate-900">Agent:</span> {entry.agent_type}</p>
                              <p><span className="font-semibold text-slate-900">Status:</span> {entry.success ? "success" : "error"}</p>
                              <p><span className="font-semibold text-slate-900">Total Latency:</span> {formatDurationSeconds(entry.total_latency_ms)}</p>
                              <p><span className="font-semibold text-slate-900">LLM Latency:</span> {formatDurationSeconds(entry.llm_latency_ms)}</p>
                              <p><span className="font-semibold text-slate-900">Tool Latency:</span> {formatDurationSeconds(entry.tool_latency_ms)}</p>
                              <p><span className="font-semibold text-slate-900">CPU Load 1m:</span> {entry.cpu_load_1m ?? "-"}</p>
                              <p><span className="font-semibold text-slate-900">RSS Memory:</span> {entry.memory_rss_mb ? `${entry.memory_rss_mb} MB` : "-"}</p>
                              <p><span className="font-semibold text-slate-900">Heap Used:</span> {entry.heap_used_mb ? `${entry.heap_used_mb} MB` : "-"}</p>
                            </div>
                            {entry.error_message ? (
                              <p className="mt-3"><span className="font-semibold text-slate-900">Error:</span> {entry.error_message}</p>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600">
                  Pilih salah satu interaction log untuk melihat detail.
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
