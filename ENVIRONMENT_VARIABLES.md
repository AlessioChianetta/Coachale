# 🔐 Variabili d'Ambiente - Documentazione Completa

Questo documento spiega in dettaglio tutte le variabili d'ambiente utilizzate dall'applicazione.

---

## 📋 Indice

1. [Variabili Obbligatorie](#variabili-obbligatorie)
2. [Variabili Opzionali](#variabili-opzionali)
3. [Feature Flags](#feature-flags)
4. [Come Generare Valori Sicuri](#come-generare-valori-sicuri)

---

## ✅ Variabili Obbligatorie

Queste variabili **devono** essere configurate, altrimenti l'applicazione non si avvierà.

### `DATABASE_URL`

**Tipo**: String (Connection String PostgreSQL)  
**Obbligatorio**: ✅ Sì  
**Esempio**: `postgresql://username:password@host:5432/database`

**Descrizione**:  
Connection string per il database PostgreSQL. L'applicazione supporta sia Supabase che PostgreSQL standard.

**Formato**:
```
postgresql://[username]:[password]@[host]:[port]/[database]?[parametri]
```

**Esempi**:

**Supabase** (consigliato):
```bash
# Transaction pooling (consigliato per produzione)
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Session pooling
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?pgbouncer=true

# Connessione diretta (NON consigliato per produzione)
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**PostgreSQL Standard**:
```bash
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/fitness_app
```

**Dove trovarla**:
- **Supabase**: Settings → Database → Connection String → Transaction pooling
- **PostgreSQL locale**: Configurala manualmente in base al tuo setup

**Note**:
- L'app rileva automaticamente se stai usando Supabase e abilita pgBouncer
- Per Supabase Free Tier, usa sempre Transaction pooling (porta 6543)
- La connection string contiene password sensibili: **non commitarla mai su Git!**

---

### `SESSION_SECRET`

**Tipo**: String (minimo 32 caratteri)  
**Obbligatorio**: ✅ Sì  
**Esempio**: `Rf1vdA5cVp25+GrQhoyjrOgrF0lWAZnW4hUR3/4OIpVz0UvEnbGdS4byiu4V+tixlKt/w54jXM7zhT6lhQvjMQ==`

**Descrizione**:  
Chiave segreta utilizzata per firmare e criptare le sessioni Express.js. Questa chiave garantisce che i cookie di sessione non possano essere manomessi.

**Come generarla**:
```bash
# Genera una chiave sicura (64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Oppure (base64)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**Note**:
- Usa una chiave **diversa** per development e production
- Se cambi questa chiave, tutte le sessioni utente esistenti saranno invalidate
- **Conserva questa chiave in modo sicuro** - perderla significa dover far riloggare tutti gli utenti

---

### `ENCRYPTION_KEY`

**Tipo**: String (64 caratteri hex = 32 bytes)  
**Obbligatorio**: ✅ Sì  
**Esempio**: `59d02c8c9e401628b0f658bb59a1ca4aa5378b07cf51b3e0a84dd7f99e5427ec`

**Descrizione**:  
Chiave di crittografia AES-256 utilizzata per criptare dati sensibili nel database (es. password SMTP dei consultant).

**Come generarla**:
```bash
# Genera una chiave AES-256 (32 bytes = 64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Note**:
- **FONDAMENTALE**: Conserva questa chiave in modo **estremamente sicuro**
- Se perdi questa chiave, **tutti i dati criptati saranno irrecuperabili**
- Se cambi questa chiave, i dati criptati esistenti non saranno più decriptabili
- Fai un backup sicuro di questa chiave (password manager, vault, ecc.)

---

## 🔧 Variabili Opzionali

Queste variabili sono opzionali. Se non configurate, le funzionalità correlate saranno disabilitate.

### `PERCORSO_CAPITALE_API_KEY`

**Tipo**: String  
**Obbligatorio**: ❌ No  
**Default**: Non configurato (funzionalità disabilitata)  
**Esempio**: `pc_master_2025_XyZ9aB7cD3eF1gH2iJ4kL5mN6oP8qR0`

**Descrizione**:  
Chiave API per l'integrazione con Percorso Capitale, un sistema di gestione finanziaria personale. Permette all'assistente AI di accedere a dati finanziari reali (budget, transazioni, investimenti, obiettivi) per fornire consigli personalizzati.

**Dove trovarla**:  
Contatta il team di Percorso Capitale per ottenere una API key.

**Note**:
- Se non configurata, l'assistente AI funzionerà comunque ma senza accesso ai dati finanziari
- Questa chiave è specifica per l'integrazione Percorso Capitale e non è necessaria per le funzionalità core dell'app

---

### `PERCORSO_CAPITALE_BASE_URL`

**Tipo**: String (URL)  
**Obbligatorio**: ❌ No  
**Default**: Non configurato  
**Esempio**: `https://api.percorsocapitale.it`

**Descrizione**:  
URL base dell'API Percorso Capitale. Deve essere configurato insieme a `PERCORSO_CAPITALE_API_KEY`.

**Note**:
- Deve essere un URL HTTPS valido
- Non includere trailing slash (es. usa `https://api.example.com`, non `https://api.example.com/`)

---

### `EMAIL_SCHEDULER_CRON`

**Tipo**: String (Cron expression)  
**Obbligatorio**: ❌ No  
**Default**: `*/5 * * * *` (ogni 5 minuti)  
**Esempio**: `0 * * * *` (ogni ora)

**Descrizione**:  
Espressione cron che definisce la frequenza di esecuzione del job di invio email automatiche.

**Esempi di cron expressions**:
```bash
# Ogni 5 minuti
*/5 * * * *

# Ogni ora
0 * * * *

# Ogni giorno alle 9:00
0 9 * * *

# Ogni lunedì alle 10:00
0 10 * * 1

# Ogni 30 minuti
*/30 * * * *
```

**Note**:
- Segui il formato cron standard: `minuto ora giorno mese giorno_settimana`
- Usa [crontab.guru](https://crontab.guru/) per testare le tue espressioni
- Se `EMAIL_SCHEDULER_ENABLED=false`, questa variabile viene ignorata

---

## 🎛️ Feature Flags

Queste variabili controllano l'abilitazione/disabilitazione di funzionalità specifiche.

### `EMAIL_SCHEDULER_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`  
**Esempio**: `EMAIL_SCHEDULER_ENABLED=false`

Abilita/disabilita il sistema di invio email automatiche.

---

### `EMAIL_SCHEDULER_RUN_ON_STARTUP`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `false`  
**Esempio**: `EMAIL_SCHEDULER_RUN_ON_STARTUP=true`

Se `true`, esegue immediatamente il job di invio email all'avvio dell'applicazione (utile per test).

---

### `WHATSAPP_POLLING_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`

Abilita/disabilita il polling dei messaggi WhatsApp (fallback se webhook non funziona).

---

### `CALENDAR_SYNC_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`

Abilita/disabilita la sincronizzazione automatica con Google Calendar.

---

### `PROACTIVE_OUTREACH_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`

Abilita/disabilita il sistema di outreach proattivo WhatsApp per lead freddi.

---

### `LEAD_POLLING_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`

Abilita/disabilita il polling dei lead da fonti esterne.

---

### `TRAINING_AGGREGATOR_ENABLED`

**Tipo**: Boolean (`true`/`false`)  
**Default**: `true`

Abilita/disabilita l'aggregatore di riepiloghi training settimanali.

---

## 🔑 Come Generare Valori Sicuri

### Generare `SESSION_SECRET`

```bash
# Metodo 1: Hex (64 caratteri)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Metodo 2: Base64 (più compatto)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Generare `ENCRYPTION_KEY`

```bash
# AES-256 richiede esattamente 32 bytes (64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verificare Lunghezza

```bash
# Verifica che SESSION_SECRET sia almeno 32 caratteri
echo -n "tua_chiave_qui" | wc -c

# Verifica che ENCRYPTION_KEY sia esattamente 64 caratteri hex
echo -n "tua_chiave_qui" | wc -c
# Deve stampare: 64
```

---

## 📝 Template Completo .env

Copia questo template e sostituisci i valori:

```bash
# DATABASE (OBBLIGATORIO)
DATABASE_URL=postgresql://username:password@host:5432/database

# SECURITY (OBBLIGATORIO)
SESSION_SECRET=genera_con_comando_sopra
ENCRYPTION_KEY=genera_con_comando_sopra

# PERCORSO CAPITALE (OPZIONALE)
PERCORSO_CAPITALE_API_KEY=tua_api_key
PERCORSO_CAPITALE_BASE_URL=https://api.percorsocapitale.it

# EMAIL SCHEDULER (OPZIONALE)
EMAIL_SCHEDULER_CRON=*/5 * * * *

# FEATURE FLAGS (OPZIONALI)
EMAIL_SCHEDULER_ENABLED=true
WHATSAPP_POLLING_ENABLED=true
CALENDAR_SYNC_ENABLED=true
```

---

## 🛡️ Best Practices Sicurezza

1. **Mai commitare `.env` su Git**
   - Aggiungi `.env` al `.gitignore`
   - Usa `.env.example` per template pubblico

2. **Usa chiavi diverse per ogni ambiente**
   - Development: chiavi diverse
   - Production: chiavi diverse e più sicure

3. **Backup delle chiavi di crittografia**
   - Conserva `ENCRYPTION_KEY` in un password manager
   - Fai backup sicuri (non in plain text)

4. **Rotazione periodica**
   - Cambia `SESSION_SECRET` periodicamente
   - **NON cambiare** `ENCRYPTION_KEY` (perderesti i dati criptati)

5. **Permessi file**
   ```bash
   # Su Linux/Mac, proteggi il file .env
   chmod 600 .env
   ```

---

## 🆘 Troubleshooting

### ❌ "DATABASE_URL must be set"

**Problema**: Variabile mancante o non caricata.

**Soluzione**:
```bash
# Verifica che .env esista
ls -la .env

# Verifica contenuto
cat .env | grep DATABASE_URL

# Verifica che dotenv sia installato
npm list dotenv
```

### ❌ "Encryption configuration failed"

**Problema**: `ENCRYPTION_KEY` mancante o formato errato.

**Soluzione**:
```bash
# Genera nuova chiave corretta
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Aggiungi a .env
echo "ENCRYPTION_KEY=chiave_generata_sopra" >> .env
```

### ❌ Database connection failed

**Problema**: `DATABASE_URL` errato o database non accessibile.

**Soluzione**:
```bash
# Test connessione database
psql "$DATABASE_URL" -c "SELECT 1"

# Verifica firewall/IP whitelisting (Supabase)
# Vai su Supabase → Settings → Database → Connection → Allowed IPs
```

---

**Per ulteriori informazioni, vedi**:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guida deployment completa
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Setup database
