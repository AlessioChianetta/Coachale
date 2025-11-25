# 🗄️ Setup Database - Guida Completa

Questa guida ti mostra come configurare il database per l'applicazione, sia su Supabase (consigliato) che su PostgreSQL standard.

---

## 📋 Indice

1. [Opzione 1: Supabase (Consigliato)](#opzione-1-supabase-consigliato)
2. [Opzione 2: PostgreSQL Standard](#opzione-2-postgresql-standard)
3. [Eseguire le Migrations](#eseguire-le-migrations)
4. [Verifica Setup](#verifica-setup)
5. [Backup e Restore](#backup-e-restore)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Opzione 1: Supabase (Consigliato)

Supabase offre PostgreSQL managed con piano gratuito generoso. **È la scelta consigliata** per questo progetto perché l'applicazione è già ottimizzata per Supabase.

### Vantaggi Supabase

- ✅ Free tier generoso (500 MB storage, 2 GB bandwidth)
- ✅ pgBouncer integrato (connection pooling)
- ✅ Backup automatici
- ✅ Dashboard web per gestione database
- ✅ Auto-pause quando non in uso (free tier)
- ✅ SSL/TLS di default
- ✅ Hosted su AWS (alta disponibilità)

### Step 1: Crea Progetto Supabase

1. **Vai su** [supabase.com](https://supabase.com)
2. **Registrati/Login** con GitHub o email
3. **Crea nuovo progetto**:
   - Clicca "New Project"
   - Nome progetto: `fitness-app` (o nome a scelta)
   - Database Password: Genera una password sicura (**salvala!**)
   - Region: Scegli la più vicina (es. `Europe West (Frankfurt)`)
   - Plan: Free (o Pro se necessario)

4. **Attendi provisioning** (2-3 minuti)

### Step 2: Ottieni Connection String

1. **Vai su** Settings → Database
2. **Copia** la connection string:
   - Sezione: "Connection string"
   - Type: **"Transaction" mode** (porta 6543) ← **Importante!**
   - Clicca su "Connection string"
   - Format: URI
   
3. **Esempio**:
```bash
postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

4. **Sostituisci `[YOUR_PASSWORD]`** con la password che hai creato al punto 1

### Step 3: Configura `.env`

Apri il file `.env` e aggiungi:

```bash
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### Step 4: Whitelist IP (se necessario)

Se ricevi errori di connessione:

1. **Vai su** Settings → Database → Connection
2. **Sezione "Restrict access by IP Address"**
3. **Aggiungi il tuo IP** oppure:
   - Per development: Abilita "Allow all IP addresses" (temporaneo)
   - Per production: Aggiungi solo IP del tuo server

### Note Supabase

**Connection Modes**:
- ✅ **Transaction mode** (porta 6543) - **Usa questo** per l'app
- ❌ Session mode (porta 5432) - Solo per migrazioni/admin
- ❌ Direct connection (porta 5432) - NON usare in produzione

**Limiti Free Tier**:
- Database: 500 MB
- Connessioni simultanee: 60 (con pgBouncer)
- Auto-pause: Dopo 1 settimana di inattività
- Bandwidth: 2 GB/mese

---

## 🐘 Opzione 2: PostgreSQL Standard

Se preferisci self-hosting o hai già un server PostgreSQL.

### Requisiti

- PostgreSQL 14+ installato
- Accesso admin al database

### Step 1: Installa PostgreSQL

**Ubuntu/Debian**:
```bash
# Aggiungi repository ufficiale PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Installa PostgreSQL 16
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
```

**macOS** (Homebrew):
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows**:
- Download installer da [postgresql.org](https://www.postgresql.org/download/windows/)
- Esegui installer e segui wizard

### Step 2: Crea Database e User

```bash
# Login come postgres
sudo -u postgres psql

# Crea user
CREATE USER fitness_user WITH PASSWORD 'your_secure_password';

# Crea database
CREATE DATABASE fitness_app OWNER fitness_user;

# Garantisci permessi
GRANT ALL PRIVILEGES ON DATABASE fitness_app TO fitness_user;

# Abilita estensioni (se necessario)
\c fitness_app
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Esci
\q
```

### Step 3: Configura Connessioni Remote (se necessario)

**Modifica `postgresql.conf`**:
```bash
# Trova il file
sudo find /etc/postgresql -name postgresql.conf

# Modifica (Ubuntu)
sudo nano /etc/postgresql/16/main/postgresql.conf

# Abilita connessioni remote
listen_addresses = '*'  # oppure '0.0.0.0' o IP specifico
```

**Modifica `pg_hba.conf`**:
```bash
# Modifica
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Aggiungi alla fine (sostituisci con IP specifico in produzione)
host    all             all             0.0.0.0/0               md5
```

**Riavvia PostgreSQL**:
```bash
sudo systemctl restart postgresql
```

### Step 4: Configura `.env`

```bash
# Locale
DATABASE_URL=postgresql://fitness_user:your_password@localhost:5432/fitness_app

# Remoto
DATABASE_URL=postgresql://fitness_user:your_password@your-server-ip:5432/fitness_app
```

### Note PostgreSQL Standard

**Sicurezza**:
- Usa firewall per limitare accesso porta 5432
- NON esporre PostgreSQL direttamente su internet
- Usa SSL/TLS in produzione
- Cambia password di default

**Performance**:
- Considera setup pgBouncer per connection pooling
- Tuning `postgresql.conf` per workload

---

## 🔄 Eseguire le Migrations

Dopo aver configurato il database, devi creare le tabelle.

### Metodo 1: Drizzle Kit Push (Consigliato)

```bash
# Verifica che DATABASE_URL sia configurato
echo $DATABASE_URL

# Esegui push delle migrations
npm run db:push
```

Questo comando:
1. Legge lo schema da `shared/schema.ts`
2. Compara con il database esistente
3. Applica le modifiche necessarie

### Metodo 2: Migrations SQL Manuali

Se `db:push` non funziona, puoi eseguire le migrations SQL manualmente:

```bash
# Elenca migrations disponibili
ls migrations/*.sql

# Esegui ogni migration in ordine
psql "$DATABASE_URL" < migrations/0001_tough_hardball.sql
psql "$DATABASE_URL" < migrations/0002_*.sql
# ... continua con tutte le migrations
```

### Verifica Migrations

```bash
# Connettiti al database
psql "$DATABASE_URL"

# Lista tabelle
\dt

# Dovresti vedere tabelle come:
# - users
# - exercises
# - assignments
# - consultations
# - whatsapp_conversations
# - ecc.

# Esci
\q
```

---

## ✅ Verifica Setup

Dopo aver configurato database e migrations, verifica che tutto funzioni:

### Test 1: Connessione Database

```bash
# Test connessione
psql "$DATABASE_URL" -c "SELECT 1"

# Output atteso: 1 riga con valore 1
```

### Test 2: Avvio Applicazione

```bash
# Avvia app
npm run dev

# Cerca nei logs:
# ✅ All required environment variables are set
# ✅ Database health check passed
```

### Test 3: Query Test

```bash
# Conta utenti (dovrebbe essere 0 inizialmente)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## 💾 Backup e Restore

### Backup Database

**Supabase**:
- Backup automatici giornalieri (plan Free: 7 giorni retention)
- Vai su Database → Backups per restore manuale

**PostgreSQL Standard**:
```bash
# Backup completo
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup compresso
pg_dump "$DATABASE_URL" | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup solo schema (senza dati)
pg_dump --schema-only "$DATABASE_URL" > schema_backup.sql

# Backup solo dati
pg_dump --data-only "$DATABASE_URL" > data_backup.sql
```

### Restore Database

**Da backup SQL**:
```bash
# Ripristina da backup
psql "$DATABASE_URL" < backup_20250125_100000.sql

# Da backup compresso
gunzip -c backup_20250125_100000.sql.gz | psql "$DATABASE_URL"
```

**Supabase**:
1. Vai su Database → Backups
2. Seleziona backup da ripristinare
3. Clicca "Restore"

### Backup Automatico (Cron)

```bash
# Crea script backup
nano /home/user/backup_db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/user/db_backups"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="postgresql://user:pass@host:5432/db"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Elimina backup più vecchi di 30 giorni
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
```

```bash
# Rendi eseguibile
chmod +x /home/user/backup_db.sh

# Aggiungi a crontab (backup giornaliero alle 2:00 AM)
crontab -e

# Aggiungi:
0 2 * * * /home/user/backup_db.sh
```

---

## 🔧 Troubleshooting

### ❌ "connection refused"

**Problema**: PostgreSQL non raggiungibile.

**Soluzioni**:
```bash
# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Avvia se non running
sudo systemctl start postgresql

# Verifica porta aperta
sudo netstat -tlnp | grep 5432

# Verifica firewall (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 5432/tcp  # Se necessario
```

### ❌ "password authentication failed"

**Problema**: Credenziali errate.

**Soluzioni**:
```bash
# Verifica DATABASE_URL
echo $DATABASE_URL

# Reset password utente
sudo -u postgres psql
ALTER USER fitness_user WITH PASSWORD 'new_password';
\q

# Aggiorna .env con nuova password
```

### ❌ "database does not exist"

**Problema**: Database non creato.

**Soluzione**:
```bash
# Crea database
sudo -u postgres psql -c "CREATE DATABASE fitness_app;"

# Oppure con psql
sudo -u postgres psql
CREATE DATABASE fitness_app;
\q
```

### ❌ "too many connections" (Supabase)

**Problema**: Limite connessioni superato.

**Soluzioni**:
1. Verifica di usare **Transaction mode** (porta 6543)
2. L'app ha già connection pooling ottimizzato
3. Se persiste, aumenta piano Supabase

### ❌ "SSL connection required"

**Problema**: Supabase richiede SSL.

**Soluzione**:
```bash
# Aggiungi parametro SSL a DATABASE_URL
DATABASE_URL=postgresql://...?sslmode=require

# Oppure
DATABASE_URL=postgresql://...?ssl=true
```

### ❌ Migrations falliscono

**Problema**: Errori durante `npm run db:push`.

**Soluzioni**:
```bash
# Verifica DATABASE_URL
npm run db:push

# Se fallisce, prova migrations manuali
ls migrations/*.sql
psql "$DATABASE_URL" < migrations/0001_tough_hardball.sql

# Verifica errori specifici
psql "$DATABASE_URL"
\dt  # Lista tabelle
\d users  # Descrive tabella users
```

---

## 📚 Risorse Aggiuntive

**Supabase**:
- [Docs ufficiali](https://supabase.com/docs)
- [Connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Performance tuning](https://supabase.com/docs/guides/platform/performance)

**PostgreSQL**:
- [Docs ufficiali](https://www.postgresql.org/docs/)
- [pgBouncer setup](https://www.pgbouncer.org/)
- [Performance tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)

**Drizzle ORM**:
- [Docs ufficiali](https://orm.drizzle.team/docs/overview)
- [Migrations](https://orm.drizzle.team/docs/migrations)

---

**Setup completato! 🎉**
