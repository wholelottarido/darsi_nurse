# DARSI Nurse

DARSI Nurse adalah aplikasi Next.js untuk workflow perawat: login/register perawat, dashboard pasien, triage IGD, asisten perawat berbasis AI, chat perawat, ringkasan klinis, dan audit log interaksi agent.

## Teknologi Utama

- Next.js 16.2.3
- React 19.2.4
- TypeScript 5
- PostgreSQL via `pg`
- VoltAgent
- Ollama atau OpenAI-compatible API
- PM2
- Nginx
- Tailwind CSS 4

## Arsitektur Singkat

- Frontend dan API berjalan dalam satu aplikasi Next.js App Router.
- Database utama aplikasi saat ini adalah `hospital_cs` melalui `HOSPITAL_CS_DATABASE_URL`.
- Masih ada koneksi legacy `DATABASE_URL` untuk fitur/data lama dan script debug.
- Layer AI dibagi menjadi:
  - `clinical` untuk triage/clinical notes
  - `operational` untuk stok obat dan daftar pasien
  - `general` untuk panduan umum perawat
- PM2 dipakai untuk proses production, Nginx opsional sebagai reverse proxy.

## Persyaratan Singkat

- Node.js minimal `20.9.0`
- npm modern yang mengikuti Node.js 20
- PostgreSQL yang dapat diakses aplikasi
- Server model AI:
  - Ollama lokal/remote, atau
  - endpoint OpenAI-compatible

## Quick Start

```bash
git clone <PRIVATE_REPOSITORY_URL>
cd darsi-nurse

nvm install
nvm use

npm ci
cp .env.example .env
nano .env

npm run dev
```

Development default berjalan di `http://localhost:3000`.

## Production Singkat

```bash
npm ci
npm run lint
npm run build
npm run start
```

Catatan: saat ini ada perbedaan port antara `npm run start` (`3019`) dan konfigurasi PM2 (`6767`). Lihat dokumentasi port sebelum deploy.

## Dokumentasi Lengkap

- [Teknologi proyek](docs/PROJECT_TECHNOLOGY.md)
- [Prasyarat VM baru](docs/PREREQUISITES.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Setup database](docs/DATABASE_SETUP.md)
- [Setup model AI](docs/AI_MODEL_SETUP.md)
- [Instalasi development](docs/DEVELOPMENT_INSTALLATION.md)
- [Instalasi production](docs/PRODUCTION_INSTALLATION.md)
- [Setup PM2](docs/PM2_SETUP.md)
- [Setup Nginx](docs/NGINX_SETUP.md)
- [Port dan jaringan](docs/NETWORK_AND_PORTS.md)
- [Checklist verifikasi](docs/VERIFICATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Hal yang Perlu Diperhatikan Saat Pindah VM

- `ecosystem.config.js`, `pm2-run.sh`, dan `scripts/dev/*` masih berisi path absolut `/home/ridho/volt/darsi-nurse`.
- Beberapa file lama masih berisi IP/host lama seperti `10.9.23.205` dan `darsi.nrs.hcm-lab.id`.
- `next.config.ts` memakai `allowedDevOrigins` hardcoded, bukan env.
- `docs/setup/SETUP_DATABASE.md` lama berisi contoh credential aktual lama dan tidak boleh dijadikan acuan deploy baru.
- Beberapa script debug/database bersifat destruktif atau memakai kredensial hardcoded; jangan dijalankan di production tanpa review.

## Troubleshooting

Mulai dari:

- [Troubleshooting umum](docs/TROUBLESHOOTING.md)
- [Verifikasi instalasi](docs/VERIFICATION.md)
- [Port dan jaringan](docs/NETWORK_AND_PORTS.md)
