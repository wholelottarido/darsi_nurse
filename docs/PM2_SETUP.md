# PM2 Setup

## Konfigurasi Aktual

File yang relevan:

- [ecosystem.config.js](/home/ridho/volt/darsi-nurse/ecosystem.config.js:1)
- [pm2-run.sh](/home/ridho/volt/darsi-nurse/pm2-run.sh:1)

## Nilai Penting

| Item | Nilai aktual |
| --- | --- |
| Nama proses | `darsi-nurse` |
| Script | `/home/ridho/volt/darsi-nurse/node_modules/next/dist/bin/next` |
| Argumen | `start --port 6767 --hostname 0.0.0.0` |
| Working directory | `/home/ridho/volt/darsi-nurse` |
| Log error | `/home/ridho/volt/darsi-nurse/logs/err.log` |
| Log output | `/home/ridho/volt/darsi-nurse/logs/out.log` |
| Restart | `autorestart: true`, `max_restarts: 10`, `min_uptime: 10s` |

## Path Absolut yang Harus Diubah di VM Baru

Sebelum menjalankan PM2 di VM baru, review semua path berikut:

- `/home/ridho/volt/darsi-nurse`
- `/home/ridho/volt/darsi-nurse/logs/err.log`
- `/home/ridho/volt/darsi-nurse/logs/out.log`

File yang mengandung path lama:

- [ecosystem.config.js](/home/ridho/volt/darsi-nurse/ecosystem.config.js:1)
- [pm2-run.sh](/home/ridho/volt/darsi-nurse/pm2-run.sh:1)
- `scripts/dev/start-pm2.sh`
- `scripts/dev/access.sh`

## Menjalankan PM2

```bash
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.js
pm2 status
pm2 logs darsi-nurse
```

Operasi umum:

```bash
pm2 restart darsi-nurse
pm2 stop darsi-nurse
pm2 delete darsi-nurse
pm2 save
pm2 startup
```

## Catatan Tentang `pm2-run.sh`

Script ini:

- build aplikasi
- menghapus proses PM2 lama
- start ulang process
- menyimpan state PM2

Namun script juga masih menampilkan URL lama `http://10.9.23.205:6767`, jadi output tersebut harus dianggap contoh lama dan bukan sumber kebenaran.

## Folder Log

Pastikan folder log ada:

```bash
mkdir -p logs
chmod 755 logs
```

Jika PM2 gagal menulis log, cek permission folder proyek dan user yang menjalankan PM2.
