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
- PM2 dipakai untuk proses production, dan deployment yang sedang aktif saat ini berjalan di VM lama pada `10.9.23.205:6767` serta diakses publik melalui `https://darsi.nrs.hcm-lab.id/`. Nginx dipakai sebagai reverse proxy publik.

## Persyaratan Singkat

- Node.js minimal `20.9.0`
- npm modern yang mengikuti Node.js 20
- PostgreSQL yang dapat diakses aplikasi
- Server model AI:
  - Ollama lokal/remote, atau
  - endpoint OpenAI-compatible

## Langkah Instalasi di VM Baru Setelah `git pull`

Jika repository sudah berhasil Anda `pull` ke VM baru, urutan yang direkomendasikan adalah sebagai berikut.

### 1. Masuk ke folder proyek

```bash
cd <LOKASI_PROYEK>/darsi-nurse
```

### 2. Pasang dependency sistem yang dibutuhkan

```bash
sudo apt update
sudo apt install -y git curl build-essential python3 make g++ postgresql-client rsync
```

Jika VM baru juga akan menjadi reverse proxy publik:

```bash
sudo apt install -y nginx
```

Jika model dijalankan lokal di VM yang sama, instal Ollama juga.

### 3. Instal dan aktifkan Node.js sesuai versi proyek

```bash
source ~/.nvm/nvm.sh
nvm install
nvm use

node --version
npm --version
```

Target minimum proyek ini adalah `Node.js 20.9.0`.

### 4. Install dependency proyek

```bash
npm ci
```

### 5. Siapkan file environment

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Minimal isi dengan benar:

- `HOSPITAL_CS_DATABASE_URL`
- `DATABASE_URL` jika koneksi legacy masih dipakai
- `AUTH_SECRET`
- `LOG_ADMIN_USERNAME` dan `LOG_ADMIN_PASSWORD` bila panel log admin dipakai
- `OLLAMA_HOST` atau `LLM_*` sesuai server model Anda
- `DARSI_PORTAL_URL` dan `NURSE_APP_HOSTS` bila domain production berubah

### 6. Verifikasi koneksi database

```bash
psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT NOW();"
```

Jika legacy database masih dipakai:

```bash
psql "<DATABASE_URL>" -c "SELECT NOW();"
```

### 7. Verifikasi koneksi model AI

Jika pakai Ollama:

```bash
curl http://127.0.0.1:11434/api/tags
```

Jika pakai OpenAI-compatible server:

```bash
curl http://<MODEL_SERVER_HOST>:<PORT>/v1/models
```

### 8. Jalankan pengecekan proyek

```bash
npm run lint
npm run build
```

Catatan: saat dokumentasi ini dibuat pada Jumat, 17 Juli 2026, `npm run build` berhasil tetapi `npm run lint` masih gagal karena issue kode yang sudah ada di repo.

### 9. Sesuaikan konfigurasi PM2 untuk path VM baru

Sebelum start PM2, review file berikut karena masih berisi path VM lama:

- `ecosystem.config.js`
- `pm2-run.sh`

Bagian yang biasanya perlu diganti:

- `cwd`
- `script`
- `error_file`
- `out_file`
- `APP_DIR`

### 10. Jalankan aplikasi dengan PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 status
pm2 logs darsi-nurse
```

### 11. Aktifkan PM2 agar tetap jalan setelah reboot

```bash
pm2 save
pm2 startup
```

### 12. Jika memakai Nginx, arahkan domain ke backend

Pada deployment lama yang aktif saat ini, backend berjalan di `10.9.23.205:6767` dan dipublish ke `https://darsi.nrs.hcm-lab.id/`.

Di VM baru, sesuaikan `proxy_pass` ke port backend yang Anda pakai. Jika mengikuti PM2 saat ini, backend ada di `127.0.0.1:6767`.

### 13. Verifikasi akhir

```bash
curl -I http://127.0.0.1:6767
pm2 status
sudo nginx -t
```

Jika ingin menjalankan lokal untuk development saja, gunakan:

```bash
npm run dev
```

Development default berjalan di `http://localhost:3000`.

## Deployment Saat Ini

Deployment production yang saat ini aktif berada di VM lama dengan detail berikut:

- Backend Next.js aktif di `10.9.23.205:6767`
- URL publik: `https://darsi.nrs.hcm-lab.id/`
- Process manager: `PM2`

Dokumentasi di repo ini disusun agar deployment yang sama bisa dipasang ulang di VM baru tanpa menebak konfigurasi lama.

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
- Beberapa file lama masih berisi IP/host deployment saat ini, yaitu `10.9.23.205` dan `darsi.nrs.hcm-lab.id`. Nilai ini valid untuk VM lama yang sedang aktif, tetapi harus direview saat pindah ke VM baru.
- `next.config.ts` memakai `allowedDevOrigins` hardcoded, bukan env.
- `docs/setup/SETUP_DATABASE.md` lama berisi contoh credential aktual lama dan tidak boleh dijadikan acuan deploy baru.
- Beberapa script debug/database bersifat destruktif atau memakai kredensial hardcoded; jangan dijalankan di production tanpa review.

## Troubleshooting

Mulai dari:

- [Troubleshooting umum](docs/TROUBLESHOOTING.md)
- [Verifikasi instalasi](docs/VERIFICATION.md)
- [Port dan jaringan](docs/NETWORK_AND_PORTS.md)
