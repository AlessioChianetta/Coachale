# 🚀 Guida Deploy - Alessia Voice Bridge

> **Architettura semplificata**: Il bridge si connette al WebSocket Replit esistente (`/ws/ai-voice`),
> riusando esattamente lo stesso codice AI del browser. Nessuna logica Gemini duplicata.

## Prerequisiti

- VPS con Ubuntu 22.04+ o Debian 12+
- Node.js 20+ installato
- FreeSWITCH con mod_audio_stream
- Accesso root o sudo

---

## 1. Copia i file sul VPS

```bash
# Dal tuo PC locale
scp -r vps-voice-bridge/ root@TUO_VPS:/opt/alessia-voice/

# Oppure con rsync
rsync -avz vps-voice-bridge/ root@TUO_VPS:/opt/alessia-voice/
```

---

## 2. Configura il Bridge

```bash
# Connetti al VPS
ssh root@TUO_VPS

# Vai nella directory
cd /opt/alessia-voice

# Copia il file di configurazione
cp .env.example .env

# Modifica le variabili
nano .env
```

### Variabili obbligatorie:

```bash
# .env

# WebSocket Server (porta 9090 per FreeSWITCH)
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=il-tuo-token-segreto-qui  # Genera con: openssl rand -hex 32

# Replit WebSocket + API
REPLIT_API_URL=https://tuo-progetto.repl.co
REPLIT_WS_URL=https://tuo-progetto.repl.co
# Token di servizio: genera con POST /api/voice/service-token (vedi sotto)
REPLIT_API_TOKEN=eyJhbG...

# Voce AI (usata dal WebSocket Replit)
GEMINI_VOICE_ID=Puck

# Sessioni
SESSION_TIMEOUT_MS=30000
MAX_CONCURRENT_CALLS=10

# Logging
LOG_LEVEL=info
```

---

## 3. Installa dipendenze e compila

```bash
cd /opt/alessia-voice

# Installa dipendenze
npm install

# Compila TypeScript
npm run build

# Verifica che funzioni
node dist/index.js
# Premi Ctrl+C dopo aver visto "Voice Bridge Server started"
```

---

## 4. Configura systemd

```bash
# Copia il file service
cp systemd/alessia-voice.service /etc/systemd/system/

# Ricarica systemd
systemctl daemon-reload

# Abilita all'avvio
systemctl enable alessia-voice

# Avvia il servizio
systemctl start alessia-voice

# Verifica stato
systemctl status alessia-voice
```

---

## 5. Verifica mod_audio_stream (IMPORTANTE)

Prima di configurare il dialplan, verifica che mod_audio_stream sia installato e caricato:

```bash
# Verifica modulo caricato
docker exec -it freeswitch fs_cli -H 127.0.0.1 -P 8021 -p '1NoxIsTheBest1!' -x "show modules like audio_stream"

# Output atteso:
# mod_audio_stream
# 1 total.

# Se non vedi nulla, il modulo non è caricato!
```

### Se mod_audio_stream non è presente:

1. Verifica che sia compilato:
```bash
docker exec -it freeswitch ls -la /usr/local/freeswitch/mod/ | grep audio_stream
```

2. Carica manualmente:
```bash
docker exec -it freeswitch fs_cli -x "load mod_audio_stream"
```

3. Aggiungi al caricamento automatico in `modules.conf.xml`:
```xml
<load module="mod_audio_stream"/>
```

Per dettagli completi, vedi `freeswitch/modules-check.md`.

---

## 6. Configura FreeSWITCH Dialplan

```bash
# Copia il dialplan
cp freeswitch/dialplan-9999.xml /opt/freeswitch/conf/dialplan/default/

# Ricarica configurazione FreeSWITCH
docker exec -it freeswitch fs_cli -H 127.0.0.1 -P 8021 -p '1NoxIsTheBest1!' -x "reloadxml"

# Verifica dialplan caricato
docker exec -it freeswitch fs_cli -x "show dialplan" | grep alessia
```

---

## 7. Configura Firewall

### Opzione A: Apri porta solo per il tuo IP

```bash
# Permetti il tuo IP
sudo ufw allow from TUO_IP_PUBBLICO to any port 9090

# Verifica regole
sudo ufw status
```

### Opzione B: Usa token (nessuna regola firewall)

Se hai configurato `WS_AUTH_TOKEN`, la connessione richiede:
```
ws://IP_VPS:9090?token=il-tuo-token
```

FreeSWITCH usa `127.0.0.1` quindi non serve token.

---

## 8. Test End-to-End

### A. Verifica che il bridge sia attivo

```bash
# Health check
curl http://127.0.0.1:9090/health

# Output atteso:
# {"status":"ok","activeSessions":0,"maxSessions":10,"uptime":123.456}

# Statistiche
curl http://127.0.0.1:9090/stats
```

### B. Test WebSocket da remoto

```bash
# Installa wscat se non presente
npm install -g wscat

# Connetti (dal tuo PC)
wscat -c "ws://IP_VPS:9090?token=il-tuo-token"

# Invia messaggio di test
{"event":"start","call_id":"test123","caller_id":"+393331234567","called_number":"9999","codec":"PCMU","sample_rate":8000}
```

### C. Test chiamata FreeSWITCH

```bash
# Crea chiamata di test
docker exec -it freeswitch fs_cli -x "originate loopback/9999/default &park"

# Verifica log del bridge
journalctl -u alessia-voice -f

# Dovresti vedere:
# [INFO] [SESSION] Session created sessionId=abc12345 callId=... callerId=...
# [INFO] [GEMINI] Connecting to Gemini Live API...
# [INFO] [GEMINI] Gemini WebSocket connected
# [INFO] [SERVER] Call active - Gemini connected
```

### D. Test con softphone SIP

1. Configura softphone (Zoiper, Linphone)
2. Registra su FreeSWITCH
3. Chiama **9999**
4. Parla con Alessia!

---

## 9. Monitoraggio

### Log in tempo reale

```bash
# Log del bridge
journalctl -u alessia-voice -f

# Log FreeSWITCH
docker logs -f freeswitch
```

### Metriche

```bash
# Chiamate attive
curl -s http://127.0.0.1:9090/stats | jq

# Health check per monitoring
curl -s http://127.0.0.1:9090/health
```

---

## 10. Troubleshooting

### Il bridge non si avvia

```bash
# Controlla log
journalctl -u alessia-voice -n 50

# Problemi comuni:
# - REPLIT_API_TOKEN mancante o non valido
# - Porta 9090 già in uso
# - Permessi file .env
```

### FreeSWITCH non si connette

```bash
# Verifica che il bridge sia in ascolto
ss -tlnp | grep 9090

# Verifica connettività
curl http://127.0.0.1:9090/health
```

### Nessun audio

```bash
# Verifica codec
docker exec -it freeswitch fs_cli -x "show codec"

# Controlla log per errori conversione audio
journalctl -u alessia-voice | grep -i audio
```

### Replit WebSocket non risponde

```bash
# Verifica connettività a Replit
curl -s https://tuo-progetto.repl.co/health

# Controlla log per errori di connessione
journalctl -u alessia-voice | grep -i replit
journalctl -u alessia-voice | grep -i error
```

---

## 11. Comandi Utili

```bash
# Riavvia il bridge
systemctl restart alessia-voice

# Stop
systemctl stop alessia-voice

# Visualizza configurazione
cat /opt/alessia-voice/.env

# Ricompila dopo modifiche
cd /opt/alessia-voice && npm run build && systemctl restart alessia-voice

# Aggiorna da Replit
rsync -avz vps-voice-bridge/ root@VPS:/opt/alessia-voice/ && \
  ssh root@VPS "cd /opt/alessia-voice && npm install && npm run build && systemctl restart alessia-voice"
```

---

## 12. Generare Service Token

Il bridge VPS richiede un token di servizio per autenticarsi con Replit.

### Da browser (loggato come consultant):

```bash
# Usando curl con il tuo JWT utente
curl -X POST https://tuo-progetto.repl.co/api/voice/service-token \
  -H "Authorization: Bearer IL_TUO_JWT_UTENTE" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": "30d"}'
```

### Risposta:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "consultantId": "abc123",
  "expiresIn": "30d",
  "usage": {
    "wsUrl": "/ws/ai-voice",
    "params": "?token=<TOKEN>&mode=phone_service&callerId=<PHONE_NUMBER>&voice=Puck"
  }
}
```

### Configura sul VPS:

Copia il token nella variabile `REPLIT_API_TOKEN` nel file `.env` sul VPS.

### Validare il token:

```bash
curl "https://tuo-progetto.repl.co/api/voice/service-token/validate?token=IL_TOKEN"
```

---

## Note Finali

- **Sicurezza**: La porta 9090 dovrebbe essere protetta (firewall o token)
- **Backup**: Esegui backup di `.env` prima di aggiornare
- **Monitoraggio**: Configura alerting su `/health` endpoint
- **Scaling**: Per più chiamate, aumenta `MAX_CONCURRENT_CALLS` (dipende da CPU/RAM)
- **Token scaduto**: Rigenera il service token prima della scadenza (default 30 giorni)

Per supporto, controlla i log o contatta il team di sviluppo.
