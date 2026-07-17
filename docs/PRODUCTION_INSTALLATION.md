# Production Installation

## Langkah Lengkap

```bash
git clone <PRIVATE_REPOSITORY_URL>
cd darsi-nurse

git checkout <BRANCH_OR_TAG>

nvm install
nvm use

npm ci

cp .env.example .env
nano .env

npm run lint
npm run build
```

## Menjalankan Aplikasi Tanpa PM2

Command aktual repo:

```bash
npm run start
```

Command ini menjalankan:

```bash
next start -p 3019
```

Jadi production manual default ada di `http://127.0.0.1:3019`.

## Deployment Production yang Sedang Aktif

Per Jumat, 17 Juli 2026, deployment yang sedang aktif berjalan sebagai berikut:

- backend aktif di `10.9.23.205:6767`
- domain publik aktif di `https://darsi.nrs.hcm-lab.id/`
- process manager yang dipakai: `PM2`

Ini berarti jalur production yang benar-benar dipakai saat ini adalah konfigurasi PM2 pada port `6767`, bukan `npm run start` di port `3019`.

## Menjalankan Aplikasi Sesuai Konfigurasi PM2

`ecosystem.config.js` tidak memakai `npm run start`, tetapi menjalankan binary Next langsung:

```bash
node node_modules/next/dist/bin/next start --port 6767 --hostname 0.0.0.0
```

Artinya saat ini ada dua mode production yang berbeda:

- `npm run start` -> port `3019`
- PM2 -> port `6767`

Pilih satu standar port sebelum deploy, lalu sesuaikan Nginx dan dokumentasi internal.

## PM2

Install PM2 global bila diperlukan:

```bash
npm install -g pm2
```

Start:

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs darsi-nurse
```

Simpan startup:

```bash
pm2 save
pm2 startup
```

## Nginx

Jika memakai Nginx, arahkan ke port backend yang dipilih:

- `3019` jika memakai `npm run start`
- `6767` jika memakai PM2 saat ini

Lihat [NGINX_SETUP.md](NGINX_SETUP.md).

## Uji Aplikasi

```bash
curl -I http://127.0.0.1:3019
curl -I http://127.0.0.1:6767
```

Gunakan hanya port yang benar-benar aktif pada mode deploy Anda. Untuk kondisi saat ini di VM lama, port aktif production adalah `6767` dan dipublikasikan lewat `https://darsi.nrs.hcm-lab.id/`.
