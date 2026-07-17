# Database Setup

## Ringkasan

Repo ini memakai dua koneksi PostgreSQL:

| Variabel | Peran |
| --- | --- |
| `HOSPITAL_CS_DATABASE_URL` | database utama aplikasi saat ini |
| `DATABASE_URL` | database legacy dan beberapa script/debug lama |

## Database Utama

- Variabel: `HOSPITAL_CS_DATABASE_URL`
- Client: `pg`
- Dipakai oleh:
  - login/register perawat
  - dashboard pasien
  - triage visit
  - clinical notes
  - chat perawat
  - agent observability logs
  - stok obat operasional

Contoh file:

- [src/lib/db/hospital-db.ts](/home/ridho/volt/darsi-nurse/src/lib/db/hospital-db.ts:1)
- [src/lib/patients/get-hospital-patients.ts](/home/ridho/volt/darsi-nurse/src/lib/patients/get-hospital-patients.ts:1)

## Database Legacy

- Variabel: `DATABASE_URL`
- Client: `pg`
- Dipakai oleh:
  - [src/lib/db/legacy-db.ts](/home/ridho/volt/darsi-nurse/src/lib/db/legacy-db.ts:1)
  - beberapa script debug lama
  - fallback secret auth jika `AUTH_SECRET` kosong

## Tabel yang Terlihat Dipakai Aktif

Database utama `hospital_cs`:

- `patients`
- `registrations`
- `indirect_staff_nurses`
- `indirect_staff_doctors`
- `external_examinations`
- `clinical_notes`
- `triage_visits`
- `conversations`
- `nurse_chat_sessions`
- `nurse_chat_conversations`
- `care_coordination_messages`
- `darsi_ph_stok_obat`
- `perawat`
- `agent_interaction_logs`
- `agent_data_source_logs`
- `agent_performance_logs`
- `public.soap_keyword_icd`
- `public.icd10_diagnoses`

Database legacy yang masih muncul di kode/debug:

- `pasien`
- `medis_pasien`
- `icds`

## Script Database di Repo

Ada script yang relevan:

- `scripts/database/setup-conversations-table.js`
- `src/lib/conversations/conversations.ts`
- `src/lib/logging/agent-interaction-logs.ts`
- `src/lib/logging/agent-observability-details.ts`

Catatan:

- beberapa tabel observability dibuat otomatis oleh kode via `CREATE TABLE IF NOT EXISTS`
- `scripts/database/create-conversations-table.mjs` mengandung `DROP TABLE IF EXISTS conversations CASCADE;` dan bersifat destruktif

## Skenario 1: Database tetap di server lama atau server terpisah

Isi `.env`:

```env
HOSPITAL_CS_DATABASE_URL=postgresql://<USER>:<PASSWORD>@<HOST>:5432/hospital_cs
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/darsi_nurse
```

Tes jaringan:

```bash
nc -zv <DATABASE_HOST> 5432
nc -zv <LEGACY_DATABASE_HOST> <LEGACY_DATABASE_PORT>
```

Tes login:

```bash
psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT NOW();"
psql "<DATABASE_URL>" -c "SELECT NOW();"
```

Tes tabel penting:

```bash
psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT COUNT(*) FROM patients;"
psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT COUNT(*) FROM perawat;"
```

Checklist tambahan:

- pastikan firewall database mengizinkan IP VM baru
- pastikan `pg_hba.conf` di server database mengizinkan koneksi user/app baru
- pastikan DNS/hostname bisa di-resolve dari VM baru

## Skenario 2: Database dipindahkan ke VM baru

Instal PostgreSQL server bila memang migrasi database dilakukan di VM baru:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-client
```

Buat user dan database:

```bash
sudo -u postgres createuser --pwprompt <APP_USER>
sudo -u postgres createdb -O <APP_USER> hospital_cs
sudo -u postgres createdb -O <APP_USER> darsi_nurse
```

Backup dari server lama:

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=hospital_cs.dump \
  "<HOSPITAL_CS_DATABASE_URL>"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=darsi_nurse.dump \
  "<DATABASE_URL>"
```

Restore ke server baru:

```bash
pg_restore \
  --no-owner \
  --no-privileges \
  --dbname=hospital_cs \
  hospital_cs.dump

pg_restore \
  --no-owner \
  --no-privileges \
  --dbname=darsi_nurse \
  darsi_nurse.dump
```

Sesuaikan `.env` setelah restore:

```env
HOSPITAL_CS_DATABASE_URL=postgresql://<APP_USER>:<PASSWORD>@127.0.0.1:5432/hospital_cs
DATABASE_URL=postgresql://<APP_USER>:<PASSWORD>@127.0.0.1:5432/darsi_nurse
```

## Script/Bagian yang Perlu Extra Hati-Hati

Mengandung operasi destruktif:

- [scripts/database/create-conversations-table.mjs](/home/ridho/volt/darsi-nurse/scripts/database/create-conversations-table.mjs:1)
  - `DROP TABLE IF EXISTS conversations CASCADE`
- [src/lib/conversations/conversations.ts](/home/ridho/volt/darsi-nurse/src/lib/conversations/conversations.ts:1)
  - memakai `DELETE FROM conversations ...` pada fungsi clear

Jangan jalankan script destruktif di production tanpa backup.

## Temuan Penting Saat Ini

- `.env` lokal saat analisis menunjuk:
  - `hospital_cs` di port `5432`
  - `darsi_nurse` di port `5500`
- dokumentasi lama [docs/setup/SETUP_DATABASE.md](/home/ridho/volt/darsi-nurse/docs/setup/SETUP_DATABASE.md:1) berisi credential/IP nyata lama dan tidak aman dijadikan referensi langsung.
