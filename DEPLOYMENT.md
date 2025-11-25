# 🚀 Guida Deployment Completa

Questa guida ti mostra come esportare il progetto da Replit e deployarlo su qualsiasi ambiente esterno (VPS, Google Cloud, AWS, ecc.).

---

## 📋 Indice

1. [Prerequisiti](#prerequisiti)
2. [Esportazione da Replit](#esportazione-da-replit)
3. [Configurazione Variabili d'Ambiente](#configurazione-variabili-dambiente)
4. [Deployment su VPS (Ubuntu/Debian)](#deployment-su-vps-ubuntudebian)
5. [Deployment su Google Cloud Platform](#deployment-su-google-cloud-platform)
6. [Deployment su AWS](#deployment-su-aws)
7. [Deployment su Railway/Render](#deployment-su-railwayrender)
8. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisiti

Prima di iniziare, assicurati di avere:

- ✅ Node.js 18+ installato
- ✅ PostgreSQL database (Supabase consigliato, o PostgreSQL standard)
- ✅ Git installato (opzionale ma consigliato)
- ✅ Accesso SSH al server (per deployment VPS)

---

## 📤 Esportazione da Replit

### Opzione 1: Export ZIP (Rapido)

1. **Download del progetto**
   - Vai su Replit → Clicca sui tre puntini → "Download as ZIP"
   - Estrai il file ZIP sul tuo computer

2. **Pulizia file Replit-specifici** (opzionale)
   ```bash
   # Rimuovi file specifici di Replit se presenti
   rm -rf .replit .replit.nix replit.nix
   ```

### Opzione 2: Git Clone (Consigliato per GitHub)

1. **Push su GitHub**
   ```bash
   # Su Replit, usa la Git pane per:
   # 1. Connetti il repository a GitHub
   # 2. Commit delle modifiche
   # 3. Push su GitHub
   ```

2. **Clone sul server**
   ```bash
   git clone https://github.com/tuo-username/tuo-repo.git
   cd tuo-repo
   ```

---

## ⚙️ Configurazione Variabili d'Ambiente

**IMPORTANTISSIMO**: Prima di avviare l'applicazione, devi configurare le variabili d'ambiente.

### 1. Crea il file `.env`

Copia `.env.example` in `.env`:

```bash
cp .env.example .env
```

### 2. Compila le variabili richieste

Apri `.env` con un editor e configura questi valori:

```bash
# DATABASE CONFIGURATION (OBBLIGATORIO)
DATABASE_URL=postgresql://username:password@host:5432/database

# SECURITY (OBBLIGATORIO)
SESSION_SECRET=genera_una_stringa_random_di_almeno_32_caratteri
ENCRYPTION_KEY=genera_una_stringa_random_di_64_caratteri

# PERCORSO CAPITALE (OPZIONALE - solo se usi questa integrazione)
PERCORSO_CAPITALE_API_KEY=tua_api_key
PERCORSO_CAPITALE_BASE_URL=https://api.percorsocapitale.it

# EMAIL SCHEDULER (OPZIONALE)
EMAIL_SCHEDULER_CRON=*/5 * * * *
```

### 3. Genera secrets sicuri

Per generare `SESSION_SECRET` e `ENCRYPTION_KEY` sicuri:

```bash
# SESSION_SECRET (32 bytes = 64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (32 bytes = 64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia gli output e incollali nel `.env`.

### 4. Configura DATABASE_URL

Vedi [DATABASE_SETUP.md](./DATABASE_SETUP.md) per istruzioni dettagliate su come configurare il database.

---

## 🖥️ Deployment su VPS (Ubuntu/Debian)

### 1. Preparazione Server

```bash
# Update sistema
sudo apt update && sudo apt upgrade -y

# Installa Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifica installazione
node --version  # Dovrebbe mostrare v20.x.x
npm --version
```

### 2. Setup Progetto

```bash
# Naviga nella directory del progetto
cd /path/to/your/project

# Installa dipendenze
npm install

# Crea file .env (vedi sezione sopra)
nano .env

# Build progetto
npm run build
```

### 3. Setup Database

```bash
# Esegui migrations (se necessario)
npm run db:push
```

### 4. Avvio Applicazione

**Opzione A: Avvio manuale (per test)**
```bash
npm start
```

**Opzione B: PM2 (Consigliato per produzione)**
```bash
# Installa PM2
sudo npm install -g pm2

# Avvia app con PM2
pm2 start npm --name "fitness-app" -- start

# Auto-restart al reboot
pm2 startup
pm2 save

# Comandi utili
pm2 status          # Vedi stato
pm2 logs            # Vedi logs
pm2 restart fitness-app  # Restart
pm2 stop fitness-app     # Stop
```

### 5. Setup Reverse Proxy (Nginx)

```bash
# Installa Nginx
sudo apt install -y nginx

# Crea configurazione
sudo nano /etc/nginx/sites-available/fitness-app

# Incolla questa configurazione:
```

```nginx
server {
    listen 80;
    server_name tuo-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Abilita sito
sudo ln -s /etc/nginx/sites-available/fitness-app /etc/nginx/sites-enabled/
sudo nginx -t  # Test configurazione
sudo systemctl restart nginx

# Setup SSL con Let's Encrypt (HTTPS)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tuo-dominio.com
```

---

## ☁️ Deployment su Google Cloud Platform

### Opzione 1: Cloud Run (Serverless - Consigliato)

1. **Installa Google Cloud CLI**
   ```bash
   # Segui: https://cloud.google.com/sdk/docs/install
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Crea Dockerfile**
   ```dockerfile
   FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

3. **Deploy**
   ```bash
   # Build e deploy
   gcloud run deploy fitness-app \
     --source . \
     --platform managed \
     --region europe-west1 \
     --allow-unauthenticated \
     --set-env-vars DATABASE_URL="postgresql://..." \
     --set-env-vars SESSION_SECRET="..." \
     --set-env-vars ENCRYPTION_KEY="..."
   ```

### Opzione 2: Compute Engine (VM)

Segui le stesse istruzioni della sezione VPS, ma su una VM Google Cloud.

---

## 🌐 Deployment su AWS

### Opzione 1: AWS Elastic Beanstalk

1. **Installa EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Inizializza e deploy**
   ```bash
   eb init -p node.js fitness-app
   eb create fitness-app-env
   
   # Configura env vars
   eb setenv DATABASE_URL="postgresql://..." \
            SESSION_SECRET="..." \
            ENCRYPTION_KEY="..."
   
   eb deploy
   ```

### Opzione 2: EC2 (VM)

Segui le stesse istruzioni della sezione VPS, ma su un'istanza EC2.

---

## 🚂 Deployment su Railway/Render

### Railway

1. **Connetti repository GitHub**
   - Vai su [railway.app](https://railway.app)
   - "New Project" → "Deploy from GitHub repo"
   - Seleziona il tuo repository

2. **Configura variabili**
   - Settings → Variables
   - Aggiungi tutte le variabili da `.env.example`

3. **Deploy automatico**
   - Railway builderà e deployerà automaticamente

### Render

1. **Connetti repository GitHub**
   - Vai su [render.com](https://render.com)
   - "New Web Service" → Connetti repository

2. **Configura**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Aggiungi env vars nella sezione "Environment"

---

## 🔧 Troubleshooting

### ❌ "DATABASE_URL must be set"

**Problema**: Variabili d'ambiente non caricate.

**Soluzione**:
```bash
# Verifica che .env esista
ls -la .env

# Verifica contenuto
cat .env

# Se manca, copia da .env.example
cp .env.example .env
# Poi compila i valori
```

### ❌ "ECONNREFUSED" al database

**Problema**: Database non raggiungibile.

**Soluzione**:
```bash
# Verifica DATABASE_URL
echo $DATABASE_URL

# Test connessione database
psql "$DATABASE_URL" -c "SELECT 1"

# Controlla firewall/security groups
# Assicurati che il tuo IP sia whitelistato
```

### ❌ "Port 5000 already in use"

**Problema**: Porta già occupata.

**Soluzione**:
```bash
# Cambia porta in .env
echo "PORT=3000" >> .env

# Oppure termina processo sulla porta 5000
lsof -ti:5000 | xargs kill -9
```

### ❌ Build fallisce

**Problema**: Dipendenze mancanti o incompatibili.

**Soluzione**:
```bash
# Pulisci cache e reinstalla
rm -rf node_modules package-lock.json
npm install

# Usa versione Node corretta
node --version  # Dovrebbe essere >= 18

# Se diversa, installa Node 20
# Segui: https://nodejs.org/en/download
```

---

## 📚 Risorse Aggiuntive

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Spiegazione dettagliata di ogni variabile
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Setup database passo-passo
- [Node.js Documentation](https://nodejs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🆘 Supporto

Se incontri problemi non coperti in questa guida:

1. Controlla i logs dell'applicazione
2. Verifica che tutte le variabili d'ambiente siano configurate correttamente
3. Assicurati che il database sia accessibile dal server

---

**Buon deployment! 🚀**
