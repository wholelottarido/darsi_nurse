# Development Installation

## Langkah dari Nol

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

## URL Development

- default `next dev` dari `package.json` berjalan di `http://localhost:3000`
- host jaringan bisa diubah manual jika perlu, misalnya:

```bash
npx next dev -H 0.0.0.0 -p 3000
```

Catatan:

- repo tidak menyediakan script `dev` dengan port custom
- beberapa script/dev log lama memakai `6767`, tetapi itu bukan default `npm run dev`

## Menghentikan Aplikasi

Tekan `Ctrl+C` di terminal tempat `npm run dev` berjalan.

## Melihat Error

- lihat output terminal `npm run dev`
- untuk error login/db/AI, cek response network browser dan log terminal server

## Koneksi Database

Sebelum `npm run dev`, minimal pastikan:

```bash
psql "<HOSPITAL_CS_DATABASE_URL>" -c "SELECT NOW();"
```

Jika legacy DB masih dibutuhkan:

```bash
psql "<DATABASE_URL>" -c "SELECT NOW();"
```

## Koneksi Model AI

Jika pakai Ollama:

```bash
curl http://127.0.0.1:11434/api/tags
```

Jika pakai OpenAI-compatible API:

```bash
curl http://<MODEL_SERVER_HOST>:<PORT>/v1/models
```

## Checklist Dev

- `.env` terisi
- `HOSPITAL_CS_DATABASE_URL` valid
- `AUTH_SECRET` terisi
- model AI yang dibutuhkan dapat diakses
- port `3000` kosong
