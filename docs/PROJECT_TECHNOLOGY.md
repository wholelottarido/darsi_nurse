# Project Technology

## Ringkasan

DARSI Nurse adalah aplikasi full-stack Next.js dengan App Router. UI dan API berada dalam satu codebase, data utama disimpan di PostgreSQL, dan fitur AI memakai VoltAgent dengan backend model Ollama atau OpenAI-compatible API.

## Daftar Teknologi

| Teknologi | Versi | Fungsi | Wajib di VM | Otomatis via `npm ci` | Service terpisah | Cara cek |
| --- | --- | --- | --- | --- | --- | --- |
| Next.js | 16.2.3 | Framework frontend + route handler API | Ya | Ya | Tidak | `npm run dev` / `npm run build` |
| React | 19.2.4 | UI rendering | Ya | Ya | Tidak | halaman bisa dibuka |
| TypeScript | ^5 | Type checking | Ya | Ya | Tidak | `npm run build` |
| Tailwind CSS | ^4 | Styling | Ya | Ya | Tidak | UI ter-render normal |
| PostgreSQL client `pg` | ^8.20.0 | Koneksi ke database utama dan legacy | Ya | Ya | Ya, PostgreSQL server | `psql "<URL>" -c "SELECT NOW();"` |
| VoltAgent Core | ^2.7.0 | Framework agent/tool calling | Ya | Ya | Tidak | endpoint chat merespons |
| `ai` + `@ai-sdk/react` | 6.0.154 / 3.0.156 | Integrasi AI SDK | Ya | Ya | Tidak | chat AI merespons |
| `ollama-ai-provider-v2` | ^3.5.0 | Provider Ollama | Ya jika pakai Ollama | Ya | Ya jika Ollama terpisah | `curl http://<host>:11434/api/tags` |
| OpenAI-compatible provider | internal via `@ai-sdk/openai-compatible` | Provider endpoint `/v1` | Ya jika pakai endpoint `/v1` | Ya | Ya | `curl http://<host>:<port>/v1/models` |
| bcryptjs | ^3.0.3 | Hash/verify password perawat | Ya | Ya | Tidak | login/register perawat berhasil |
| PM2 | ^6.0.14 | Menjalankan app production | Ya untuk production | Ya sebagai package repo | Tidak | `npx pm2 status` atau `pm2 status` |
| Nginx | eksternal | Reverse proxy | Opsional tapi umum | Tidak | Ya | `sudo nginx -t` |
| `better-sqlite3` | ^12.8.0 | Dependency terpasang, tidak ditemukan dipakai di source runtime | Tidak untuk fitur saat ini | Ya | Tidak | `npm ci` berhasil |
| `@voltagent/libsql` | ^2.1.2 | Dependency terpasang, tidak ditemukan dipakai di source runtime | Tidak untuk fitur saat ini | Ya | Mungkin butuh libsql bila dipakai nanti | tidak ada pemakaian aktif di source |

## Verifikasi Teknologi yang Diperkirakan

| Teknologi | Status |
| --- | --- |
| Next.js | Dipakai aktif |
| React | Dipakai aktif |
| TypeScript | Dipakai aktif |
| PostgreSQL | Dipakai aktif |
| `pg` | Dipakai aktif |
| VoltAgent | Dipakai aktif |
| Ollama | Didukung aktif |
| OpenAI-compatible API | Didukung aktif |
| PM2 | Dipakai aktif |
| Nginx | Tidak ada config repo aktif, tapi relevan untuk deploy |
| Tailwind CSS | Dipakai aktif |
| `better-sqlite3` | Terpasang, tidak ditemukan pemakaian aktif |
| `@voltagent/libsql` | Terpasang, tidak ditemukan pemakaian aktif |

## Catatan Implementasi Aktual

- Entry point app adalah Next.js App Router di `app/`.
- API route utama ada di `app/api/`.
- Database utama baru mengarah ke `hospital_cs` melalui [src/lib/db/hospital-db.ts](/home/ridho/volt/darsi-nurse/src/lib/db/hospital-db.ts:1).
- Koneksi legacy masih ada di [src/lib/db/legacy-db.ts](/home/ridho/volt/darsi-nurse/src/lib/db/legacy-db.ts:1).
- Model AI dibagi tiga profil di [src/lib/agents/llm-router.ts](/home/ridho/volt/darsi-nurse/src/lib/agents/llm-router.ts:1).
- Tool calling aktif pada agent klinis dan operasional melalui `@voltagent/core`.
