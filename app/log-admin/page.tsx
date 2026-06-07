import { LogAdminLogoutButton } from "@/components/log-admin/log-admin-logout-button";
import { LogAdminDashboard } from "@/components/log-admin/log-admin-dashboard";
import { getCurrentLogAdmin } from "@/lib/auth/admin-log-auth";
import { listAgentInteractionLogs } from "@/lib/logging/agent-interaction-logs";
import { hospitalQuery } from "@/lib/db/hospital-db";

type RegisteredNurseOption = {
  id: number;
  username: string;
};

async function listRegisteredNurses(): Promise<RegisteredNurseOption[]> {
  const result = await hospitalQuery(
    `SELECT id, username
     FROM indirect_staff_nurses
     WHERE username IS NOT NULL AND TRIM(username) <> ''
     ORDER BY username ASC`
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    username: String(row.username),
  }));
}

export default async function LogAdminPage() {
  const [admin, logs, registeredNurses] = await Promise.all([
    getCurrentLogAdmin(),
    listAgentInteractionLogs(80),
    listRegisteredNurses(),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Log Admin
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Observability Agent DARSI Nurse
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  Dashboard ini menampilkan aktivitas agent dari sisi perawat. Fokusnya untuk audit siapa yang meminta,
                  data apa yang dibaca agent, dan seberapa cepat jawaban dihasilkan.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:min-w-[280px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Session Admin
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{admin?.username ?? "Admin"}</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Halaman ini hanya untuk audit. Tidak ada aksi klinis atau update data pasien dari panel ini.
              </p>
              <LogAdminLogoutButton />
            </div>
          </div>
        </section>

        <LogAdminDashboard logs={logs} registeredNurses={registeredNurses} />
      </div>
    </main>
  );
}
