# Verification

## Instalasi

- [ ] Node.js tersedia
- [ ] npm tersedia
- [ ] `npm ci` berhasil
- [ ] `.env` tersedia
- [ ] `npm run lint` berhasil
- [ ] `npm run build` berhasil

## Aplikasi

- [ ] halaman login dapat dibuka
- [ ] login perawat berhasil
- [ ] dashboard dapat dibuka
- [ ] `/api/auth/me` merespons setelah login
- [ ] `/api/nurse-chat` atau `/api/general-chat` dapat dipakai
- [ ] tidak ada error fatal di log

## Database

- [ ] database utama `hospital_cs` terhubung
- [ ] database legacy terhubung jika masih dipakai
- [ ] query `SELECT NOW();` berhasil
- [ ] tabel `patients`, `perawat`, `registrations`, `clinical_notes` tersedia

## Model AI

- [ ] Ollama dapat diakses jika dipakai
- [ ] model general tersedia
- [ ] model clinical dapat diakses
- [ ] model operational dapat diakses
- [ ] agent dapat menghasilkan respons
- [ ] tool calling operasional dapat berjalan

## PM2 dan Nginx

- [ ] PM2 berstatus `online`
- [ ] tidak terjadi restart loop
- [ ] folder `logs/` tersedia dan dapat ditulis
- [ ] `sudo nginx -t` berhasil
- [ ] Nginx aktif jika dipakai
- [ ] domain atau IP dapat diakses

## Command Verifikasi

```bash
node --version
npm --version
npm run lint
npm run build

psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT NOW();"
curl http://127.0.0.1:11434/api/tags

pm2 status
pm2 logs darsi-nurse --lines 100

sudo nginx -t
sudo systemctl status nginx
```
