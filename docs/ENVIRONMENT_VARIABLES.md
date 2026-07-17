# Environment Variables

## Daftar Variabel

| Variabel | Wajib | Fungsi | Contoh | Digunakan pada |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Ya | mode runtime | `production` | Next.js, cookie `secure`, PM2 |
| `PORT` | Kondisional | port runtime saat tidak dipaksa argumen CLI | `6767` | PM2 env |
| `HOSTNAME` | Kondisional | bind host runtime | `0.0.0.0` | PM2 env |
| `HOSPITAL_CS_DATABASE_URL` | Ya | database utama aplikasi | `postgresql://user:pass@db:5432/hospital_cs` | auth perawat, pasien, triage, clinical notes, logging, operational tools |
| `DATABASE_URL` | Masih diperlukan | database legacy / script lama | `postgresql://user:pass@db:5500/darsi_nurse` | legacy db, script debug, fallback auth secret |
| `AUTH_SECRET` | Sangat direkomendasikan | secret HMAC session | `<random-secret>` | session perawat dan admin log |
| `LOG_ADMIN_USERNAME` | Opsional tapi perlu untuk panel audit | username admin log | `admin-log` | login `/log-admin` |
| `LOG_ADMIN_PASSWORD` | Opsional tapi perlu untuk panel audit | password admin log | `<strong-password>` | login `/log-admin` |
| `DARSI_PORTAL_URL` | Opsional | redirect root production ke portal | `https://portal.example.id` | proxy dan landing page |
| `NURSE_APP_HOSTS` | Opsional | daftar host nurse app production, comma-separated | `nurse.example.id,10.0.0.10` | proxy redirect/auth flow |
| `APP_BASE_URL` | Opsional | base URL untuk evaluation/script | `http://127.0.0.1:3019` | `evaluation/runners/*` |
| `EVAL_BASE_URL` | Opsional | override khusus evaluation | `http://127.0.0.1:3019` | `phase4_icd10_concurrent_eval.js` |
| `LLM_PROVIDER` | Ya jika tidak pakai per-profile | provider default | `ollama` atau `openai-compatible` | fallback clinical/base model |
| `LLM_BASE_URL` | Ya untuk provider openai-compatible default | base URL default model | `http://127.0.0.1:11434/v1` | base model fallback |
| `LLM_MODEL` | Ya | nama model default | `darsi-llama3.1:8b` | base/clinical fallback |
| `LLM_API_KEY` | Kondisional | API key provider openai-compatible | `EMPTY` | base model fallback |
| `LLM_CLINICAL_PROVIDER` | Opsional | override provider clinical | `ollama` | agent clinical |
| `LLM_CLINICAL_BASE_URL` | Opsional | override endpoint clinical | `http://model-host:11434/api` | agent clinical |
| `LLM_CLINICAL_MODEL` | Opsional | override model clinical | `darsi-llama3.1:8b` | agent clinical |
| `LLM_CLINICAL_API_KEY` | Kondisional | API key model clinical | `EMPTY` | agent clinical |
| `LLM_OPERATIONAL_PROVIDER` | Opsional | override provider operational | `ollama` | agent operational |
| `LLM_OPERATIONAL_BASE_URL` | Opsional | override endpoint operational | `http://model-host:11434/api` | agent operational |
| `LLM_OPERATIONAL_MODEL` | Opsional | override model operational | `darsi-llama3.1:8b` | agent operational |
| `LLM_OPERATIONAL_API_KEY` | Kondisional | API key model operational | `EMPTY` | agent operational |
| `LLM_GENERAL_PROVIDER` | Opsional | override provider general | `ollama` | agent general |
| `LLM_GENERAL_BASE_URL` | Opsional | override endpoint general | `http://model-host:11434/api` | agent general |
| `LLM_GENERAL_MODEL` | Opsional | override model general | `medgemma:4b` | agent general |
| `LLM_GENERAL_API_KEY` | Kondisional | API key model general | `EMPTY` | agent general |
| `OLLAMA_HOST` | Opsional | fallback endpoint Ollama | `http://127.0.0.1:11434/api` | base model, clinical fallback, general fallback |

## Variabel yang Tidak Ditemukan Sebagai Env Aktif

- `NEXT_ALLOWED_DEV_ORIGINS` tidak ditemukan dipakai di source.
- `next.config.ts` memakai `allowedDevOrigins` hardcoded:
  - `10.9.23.205`
  - `localhost`
  - `127.0.0.1`
  - `darsi.nrs.hcm-lab.id`

Saat pindah VM, nilai ini perlu direview manual di [next.config.ts](/home/ridho/volt/darsi-nurse/next.config.ts:1).

## Membuat File `.env`

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Nilai `.env` harus disesuaikan dengan:

- IP/hostname VM baru
- alamat database utama `hospital_cs`
- alamat database legacy jika masih dipakai
- alamat server Ollama
- alamat server model clinical
- alamat server model operational
- domain/hostname aplikasi nurse
- URL portal DARSI
- port aplikasi production

## Penjelasan Penyimpanan `.env`

### Pilihan 1: direkomendasikan

- `.env` tidak disimpan di Git
- `.env.example` disimpan di Git
- `.env` asli disimpan di NAS, secret manager, atau password manager
- setelah clone/pull, salin `.env` ke root proyek

Contoh:

```bash
cp /lokasi-backup/.env /lokasi/project/.env
chmod 600 /lokasi/project/.env
```

### Pilihan 2: repository private

Risiko jika `.env` disimpan di Git private:

- secret masuk ke history Git
- menghapus file tidak menghapus riwayat
- semua orang yang punya akses repo dapat membaca secret
- jika repo bocor atau jadi public, seluruh credential harus dirotasi

## Catatan Keamanan dari Repo Saat Ini

- `.gitignore` meng-ignore `.env*`, jadi `.env` seharusnya tidak ikut commit.
- File `.env` lokal yang ada saat analisis berisi credential nyata dan IP lama; jangan salin nilainya ke VM baru tanpa review.
- `AUTH_SECRET` belum diisi di `.env` saat ini, sehingga session dapat fallback ke URL database. Itu tidak ideal dan harus diperbaiki di VM baru.
