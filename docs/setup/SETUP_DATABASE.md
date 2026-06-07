# Setup Database - Conversations Table

## Issue yang Terjadi

Error "This connection has been closed" di DBeaver kemungkinan terjadi karena:
1. Connection timeout (DBeaver default timeout terlalu pendek)
2. Network latency ke server 10.9.23.205:5435
3. Session timeout di tengah execution

## Solusi

### Opsi 1: Jalankan Langsung dari Terminal (Recommended)

```bash
# Jalankan psql langsung tanpa interactive mode
PGPASSWORD=labduafa psql -h 10.9.23.205 -p 5435 -U ridho -d darsi_nurse << EOF

-- Buat tabel conversations
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buat indexes
CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_name = 'conversations';

EOF
```

### Opsi 2: Melalui Node.js Script (dalam project)

Buat file `scripts/setup-db.ts`:

```typescript
import { Client } from 'pg';

async function setupDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connect_timeout: 15,
  });

  try {
    await client.connect();
    console.log('✅ Connected');
    
    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        patient_id INT NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table created!');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON conversations(patient_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
    `);
    console.log('✅ Indexes created!');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

setupDB();
```

### Opsi 3: DBeaver Settings Fix

Jika ingin tetap gunakan DBeaver:

1. **Connection Settings** → Edit Connection
2. **SSH** (jika punya) atau **Network** tab
3. **Connection timeout**: Ubah ke 30 detik (default sering terlalu pendek)
4. **Statement timeout**: Ubah ke 60 atau 120 detik
5. Test connection dulu sebelum jalankan query

Atau split query menjadi 2 statement terpisah:

**Statement 1:**
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Statement 2:**
```sql
CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
```

Jalankan terpisah dengan delay beberapa detik di antara.

## Recommended Action

Gunakan **Opsi 1** (terminal command) - ini paling reliable dan cepat. Cukup copy-paste command di atas di terminal Linux machine.

Setelah berhasil, verify dengan:
```sql
SELECT * FROM conversations LIMIT 1;
```

Kalau table berhasil dibuat, maka siap untuk integration dengan Voltagent!
