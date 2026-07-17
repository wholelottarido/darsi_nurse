# Troubleshooting

## 1. `npm ci` gagal

Gejala:
`npm ci` berhenti di dependency install.

Penyebab:
Node.js terlalu lama, toolchain native belum ada, atau lockfile tidak cocok.

Cara memeriksa:
`node --version`, `npm --version`.

Cara memperbaiki:
gunakan `nvm install && nvm use`, lalu pastikan `build-essential python3 make g++` terpasang.

## 2. `better-sqlite3` gagal di-build

Gejala:
error `node-gyp`, `make`, `g++`, atau Python saat install.

Penyebab:
dependency native butuh compiler toolchain.

Cara memeriksa:
lihat log `npm ci`.

Cara memperbaiki:
install `build-essential python3 make g++`, lalu ulangi `npm ci`.

## 3. Node.js tidak kompatibel

Gejala:
Next.js menolak start/build.

Penyebab:
Node < `20.9.0`.

Cara memeriksa:
`node --version`.

Cara memperbaiki:
pakai `.nvmrc` dan jalankan `nvm install && nvm use`.

## 4. Port sudah digunakan

Gejala:
`EADDRINUSE`.

Penyebab:
port `3000`, `3019`, atau `6767` sudah dipakai proses lain.

Cara memeriksa:
`ss -ltnp | grep -E '3000|3019|6767'`

Cara memperbaiki:
matikan proses lama atau ganti port dan sesuaikan PM2/Nginx.

## 5. `.env` tidak terbaca

Gejala:
error `HOSPITAL_CS_DATABASE_URL belum dikonfigurasi`.

Penyebab:
`.env` belum ada atau variabel salah nama.

Cara memeriksa:
`ls -la .env`

Cara memperbaiki:
salin dari `.env.example`, isi ulang nilainya, restart proses.

## 6. Database connection refused

Gejala:
error `ECONNREFUSED`.

Penyebab:
host/port salah, service PostgreSQL mati, firewall menolak.

Cara memeriksa:
`nc -zv <DB_HOST> <DB_PORT>`

Cara memperbaiki:
perbaiki host/port, hidupkan PostgreSQL, buka firewall.

## 7. Database authentication failed

Gejala:
error `password authentication failed`.

Penyebab:
username/password salah atau user belum diberi akses.

Cara memeriksa:
`psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT NOW();"`

Cara memperbaiki:
perbaiki credential dan permission user DB.

## 8. Tabel tidak ditemukan

Gejala:
error `relation does not exist`.

Penyebab:
schema belum dipulihkan lengkap atau salah database.

Cara memeriksa:
`psql "<HOSPITAL_CS_DATABASE_URL>" -c "\dt"`

Cara memperbaiki:
restore database yang benar atau jalankan langkah inisialisasi yang aman.

## 9. Ollama connection refused

Gejala:
chat AI gagal menghubungi Ollama.

Penyebab:
Ollama belum jalan atau `OLLAMA_HOST` salah.

Cara memeriksa:
`curl http://127.0.0.1:11434/api/tags`

Cara memperbaiki:
start Ollama atau arahkan `OLLAMA_HOST` ke server yang benar.

## 10. Model Ollama tidak tersedia

Gejala:
endpoint hidup tapi model tidak ditemukan.

Penyebab:
model belum di-pull.

Cara memeriksa:
`ollama list`

Cara memperbaiki:
`ollama pull darsi-llama3.1:8b` atau model yang dibutuhkan.

## 11. OpenAI-compatible endpoint gagal

Gejala:
response `401`, `404`, atau timeout dari `/v1`.

Penyebab:
base URL salah, API key salah, model tidak ada.

Cara memeriksa:
`curl http://<HOST>:<PORT>/v1/models`

Cara memperbaiki:
perbaiki `LLM_*_BASE_URL`, `LLM_*_API_KEY`, dan nama model.

## 12. Build Next.js gagal

Gejala:
`npm run build` gagal.

Penyebab:
Node tidak cocok, env wajib kosong, atau type error/lint issue.

Cara memeriksa:
jalankan `npm run build` dan baca stack trace.

Cara memperbaiki:
perbaiki env, Node version, atau error source yang dilaporkan build.

## 13. PM2 restart loop

Gejala:
status PM2 terus restart.

Penyebab:
env salah, port bentrok, build belum ada, atau path lama masih dipakai.

Cara memeriksa:
`pm2 logs darsi-nurse`

Cara memperbaiki:
cek `.env`, `ecosystem.config.js`, port, dan path absolut.

## 14. Nginx `502 Bad Gateway`

Gejala:
domain merespons `502`.

Penyebab:
backend Next.js tidak jalan atau Nginx mengarah ke port salah.

Cara memeriksa:
`curl -I http://127.0.0.1:3019` dan/atau `curl -I http://127.0.0.1:6767`

Cara memperbaiki:
nyalakan backend dan samakan port Nginx dengan backend aktif.

## 15. Nginx timeout

Gejala:
request lama lalu timeout.

Penyebab:
request AI lama, timeout proxy terlalu pendek.

Cara memeriksa:
`/var/log/nginx/error.log`

Cara memperbaiki:
naikkan `proxy_read_timeout` dan cek latency model server.

## 16. Permission denied pada folder log

Gejala:
PM2 gagal menulis `logs/err.log` atau `logs/out.log`.

Penyebab:
folder belum ada atau owner salah.

Cara memeriksa:
`ls -ld logs`

Cara memperbaiki:
`mkdir -p logs` lalu sesuaikan owner/permission.

## 17. Path PM2 masih mengarah ke VM lama

Gejala:
PM2 gagal start atau membaca path `/home/ridho/volt/darsi-nurse`.

Penyebab:
config masih hardcoded ke path lama.

Cara memeriksa:
lihat `ecosystem.config.js` dan `pm2-run.sh`.

Cara memperbaiki:
ubah `script`, `cwd`, `error_file`, `out_file`, dan `APP_DIR` ke path proyek di VM baru.
