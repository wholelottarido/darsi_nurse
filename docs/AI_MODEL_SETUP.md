# AI Model Setup

## Ringkasan

Repo mendukung dua jenis provider:

- `ollama`
- `openai-compatible`

Konfigurasi model dipusatkan di:

- [src/lib/agents/llm.ts](/home/ridho/volt/darsi-nurse/src/lib/agents/llm.ts:1)
- [src/lib/agents/llm-router.ts](/home/ridho/volt/darsi-nurse/src/lib/agents/llm-router.ts:1)

## Profil Model

| Profil | Sumber konfigurasi | Fallback model | Keterangan |
| --- | --- | --- | --- |
| Clinical | `LLM_CLINICAL_*` lalu fallback ke `LLM_*` | `darsi-llama3.1:8b` | dipakai agent triage/clinical notes |
| Operational | `LLM_OPERATIONAL_*` lalu fallback ke clinical | `darsi-llama3.1:8b` | dipakai cek stok obat dan daftar pasien |
| General | `LLM_GENERAL_*` | `medgemma:4b` via Ollama | dipakai panduan umum perawat |

## Provider dan Endpoint

### Ollama

Default internal:

- base URL fallback: `http://localhost:11434/api`
- model default base/clinical/operational: `darsi-llama3.1:8b`
- model default general: `medgemma:4b`

Contoh `.env`:

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434/api
LLM_MODEL=darsi-llama3.1:8b

LLM_OPERATIONAL_PROVIDER=ollama
LLM_OPERATIONAL_BASE_URL=http://127.0.0.1:11434/api
LLM_OPERATIONAL_MODEL=darsi-llama3.1:8b

LLM_GENERAL_PROVIDER=ollama
LLM_GENERAL_BASE_URL=http://127.0.0.1:11434/api
LLM_GENERAL_MODEL=medgemma:4b
```

### OpenAI-compatible server

Default internal base model fallback:

- base URL fallback: `http://localhost:11434/v1`
- model fallback: `darsi-llama3.1:8b`
- API key fallback: `EMPTY`

Contoh `.env`:

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://<MODEL_SERVER_HOST>:<PORT>/v1
LLM_MODEL=<MODEL_NAME>
LLM_API_KEY=<API_KEY>
```

Per profile:

```env
LLM_CLINICAL_PROVIDER=openai-compatible
LLM_CLINICAL_BASE_URL=http://<MODEL_SERVER_HOST>:<PORT>/v1
LLM_CLINICAL_MODEL=<MODEL_NAME>
LLM_CLINICAL_API_KEY=<API_KEY>
```

## Ollama Lokal atau Server Terpisah

Repo tidak mewajibkan Ollama berada di VM aplikasi. Bisa:

- lokal pada VM app
- remote pada server model terpisah

Instalasi Ollama lokal:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable ollama
sudo systemctl start ollama
```

Cek service:

```bash
ollama --version
ollama list
ollama ps
curl http://127.0.0.1:11434/api/tags
```

Pull model:

```bash
ollama pull darsi-llama3.1:8b
ollama pull medgemma:4b
```

## Tes Endpoint OpenAI-compatible

```bash
curl http://<MODEL_SERVER_HOST>:<PORT>/v1/models
```

Jika butuh auth:

```bash
curl \
  -H "Authorization: Bearer <API_KEY>" \
  http://<MODEL_SERVER_HOST>:<PORT>/v1/models
```

## Tool Calling

- agent klinis memakai `agentTools`
- agent operasional memakai `operationalTools`
- agent general tidak memakai tool, hanya text generation/fallback

Tool calling diimplementasikan dengan `@voltagent/core`.

## Timeout dan Fallback

- agent general punya timeout sekitar `20000ms` dan fallback jawaban aman
- agent general default ke `medgemma:4b` jika override general tidak diisi
- operational bisa menjawab langsung tanpa LLM untuk beberapa intent sederhana
- clinical dan operational dapat diwariskan dari konfigurasi base model

## Cara Cek dari VM Baru

Tes endpoint model:

```bash
curl http://<OLLAMA_HOST>:11434/api/tags
curl http://<MODEL_SERVER_HOST>:<PORT>/v1/models
```

Tes aplikasi setelah `.env` terisi:

```bash
curl http://127.0.0.1:3019/api/general-chat
curl http://127.0.0.1:3019/api/nurse-chat
```

Jika endpoint POST, uji via browser/app setelah login.
