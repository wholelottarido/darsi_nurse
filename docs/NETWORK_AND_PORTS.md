# Network And Ports

## Tabel Port

| Port | Service | Lokasi | Harus dibuka | Keterangan |
| --- | --- | --- | --- | --- |
| `3000` | Next.js dev | VM aplikasi | Lokal/dev saja | default `npm run dev` |
| `3019` | Next.js production manual | VM aplikasi | Lokal atau via Nginx | hardcoded di `npm run start` |
| `6767` | Next.js via PM2 | VM aplikasi | Lokal atau via Nginx | dipakai `ecosystem.config.js` dan script lama |
| `5432` | PostgreSQL `hospital_cs` | server database | Ya jika DB remote | terlihat di `.env` saat ini |
| `5500` | PostgreSQL legacy `darsi_nurse` | server database | Ya jika DB remote | terlihat di `.env` saat ini |
| `11434` | Ollama | VM aplikasi atau server model | Ya jika remote | default Ollama |
| `80` | Nginx HTTP | VM aplikasi | Ya bila public | optional |
| `443` | Nginx HTTPS | VM aplikasi | Ya bila public | optional |

## Temuan Port Aktual

| Sumber | Temuan |
| --- | --- |
| `package.json` | `npm run start` memakai `3019` |
| `ecosystem.config.js` | PM2 memakai `6767` |
| `pm2-run.sh` | menampilkan URL `6767` |
| `scripts/dev/access.sh` | memakai `3019` |
| `evaluation/runners/*` | `APP_BASE_URL` fallback ke `3019`, satu file fallback ke `3000` |
| `next.config.ts` | tidak menentukan port |
| `.env` saat ini | tidak ada `PORT`, jadi PM2/env/script yang menentukan |

## Implikasi

- port production belum konsisten di seluruh repo
- dokumentasi deployment harus memilih satu standar
- jika memakai PM2 saat ini, Nginx harus diarahkan ke `6767`
- jika menjalankan manual `npm run start`, backend aktif di `3019`

## IP/Hostname Hardcoded yang Ditemukan

- `10.9.23.205`
- `darsi.nrs.hcm-lab.id`
- `darsi.ph.hcm-lab.id`
- path absolut `/home/ridho/volt/darsi-nurse`

## Rekomendasi Operasional

- buka `80/443` hanya untuk Nginx
- simpan port backend Next.js lokal saja jika reverse proxy dipakai
- buka `5432`/`5500` hanya antar server yang perlu
- buka `11434` hanya jika server model memang remote dan perlu diakses lintas host
