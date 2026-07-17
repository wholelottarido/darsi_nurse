# Prerequisites

## Rekomendasi VM

Bagian ini adalah estimasi operasional berdasarkan stack aktual repo.

| Kebutuhan | Rekomendasi minimum |
| --- | --- |
| OS | Ubuntu 24.04 LTS atau Debian 12 |
| CPU | 2 vCPU |
| RAM | 4 GB jika model AI remote, 8 GB+ jika Ollama lokal |
| Storage | 20 GB untuk app/log/build, tambah ruang jika Ollama lokal |

## Node.js dan npm

- Node.js minimum: `20.9.0`
- Alasan:
  - `next@16.2.3` mensyaratkan `node >=20.9.0`
  - beberapa dependency Tailwind/Next juga mensyaratkan Node 20+
- npm:
  - gunakan npm bawaan Node.js 20
  - `package-lock.json` menggunakan lockfile modern

## Software Sistem yang Benar-Benar Relevan

| Software | Wajib | Alasan |
| --- | --- | --- |
| `git` | Ya | clone/pull repository |
| `curl` | Ya | tes HTTP app dan model |
| `build-essential` | Ya | native build dependency |
| `python3` | Ya | diperlukan saat build native module |
| `make` | Ya | diperlukan saat build native module |
| `g++` | Ya | diperlukan saat build native module |
| `postgresql-client` | Ya | tes koneksi database dan query |
| `rsync` | Opsional | memindahkan file/env antar VM |
| `nginx` | Opsional | reverse proxy production |
| `ollama` | Opsional | hanya jika model dijalankan lokal |

`jq` tidak ditemukan sebagai kebutuhan source code.

## Alasan Native Build

Repo memasang `better-sqlite3`. Walaupun tidak ditemukan pemakaian runtime aktif, paket ini tetap bisa membutuhkan toolchain native ketika `npm ci` dijalankan.

## Instalasi Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y git curl build-essential python3 make g++ postgresql-client rsync
```

Jika akan memakai Nginx:

```bash
sudo apt install -y nginx
```

Jika akan memakai Ollama lokal, instal sesuai distribusi:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## Port yang Perlu Diperhatikan

| Port | Fungsi |
| --- | --- |
| `3000` | `next dev` default |
| `3019` | `npm run start` dan default `APP_BASE_URL` di script evaluasi |
| `6767` | PM2/script dev lama |
| `5432` | PostgreSQL `hospital_cs` pada `.env` saat ini |
| `5500` | PostgreSQL legacy `darsi_nurse` pada `.env` saat ini |
| `11434` | Ollama default |
| `80` / `443` | Nginx |

## Service yang Perlu Aktif

- PostgreSQL server tujuan, atau minimal akses jaringan ke server database terpisah
- Ollama atau server model AI lain jika fitur AI dipakai
- PM2 untuk production process management
- Nginx jika reverse proxy digunakan

## Cara Cek Versi

```bash
git --version
curl --version
node --version
npm --version
python3 --version
make --version
g++ --version
psql --version
rsync --version
nginx -v
ollama --version
```

## Instalasi Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh

nvm install
nvm use

node --version
npm --version
```
