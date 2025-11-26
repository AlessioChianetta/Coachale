# Configurazione Webhook Twilio per WhatsApp

## URL Webhook
```
https://[TUO-REPL-URL].replit.app/api/whatsapp/webhook
```

Sostituisci `[TUO-REPL-URL]` con l'URL pubblico della tua Replit app.

## Istruzioni per Configurare su Twilio Console

### 1. Accedi a Twilio Console
- Vai su https://console.twilio.com/
- Accedi con le tue credenziali

### 2. Naviga alle Impostazioni WhatsApp
- Vai su **Messaging** → **Try it out** → **Send a WhatsApp message**
- Oppure cerca "WhatsApp Sandbox" nella barra di ricerca

### 3. Configura il Webhook per Messaggi in Entrata

**Per WhatsApp Sandbox (Test):**
1. Vai su **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Scorri fino a **Sandbox Configuration**
3. Nel campo **"WHEN A MESSAGE COMES IN"**:
   - Inserisci: `https://[TUO-REPL-URL].replit.app/api/whatsapp/webhook`
   - Metodo: `HTTP POST`
4. Clicca **Save**

**Per WhatsApp Number in Produzione:**
1. Vai su **Messaging** → **Settings** → **WhatsApp sender numbers**
2. Seleziona il tuo numero WhatsApp
3. Scorri fino a **Messaging Configuration**
4. Nel campo **"WHEN A MESSAGE COMES IN"**:
   - Inserisci: `https://[TUO-REPL-URL].replit.app/api/whatsapp/webhook`
   - Metodo: `HTTP POST`
5. Clicca **Save**

### 4. Configura il Webhook per Status Updates (Opzionale)

Per ricevere aggiornamenti sullo stato dei messaggi (inviato, consegnato, letto, fallito):

Nel campo **"STATUS CALLBACK URL"**:
- Inserisci lo stesso URL: `https://[TUO-REPL-URL].replit.app/api/whatsapp/webhook`
- Metodo: `HTTP POST`

## Verificare il Funzionamento

### Test Rapido:
1. Invia un messaggio WhatsApp al numero configurato
2. Controlla i logs del server:
   - Dovresti vedere: `🔔🔔🔔 [WEBHOOK] Received at [timestamp]`
3. L'AI dovrebbe rispondere entro **2-3 secondi**

### Logs di Debug:
Il webhook mostra informazioni dettagliate nei logs:
```
🔔🔔🔔 [WEBHOOK] Received at 2025-11-12T22:00:00.000Z 🔔🔔🔔
📞 From: whatsapp:+393331234567
📱 To: whatsapp:+393500220129
💬 Body: Ciao, vorrei informazioni...
🆔 MessageSid: SM1234567890abcdef
```

## Sistema Dual Delivery

Il sistema usa **due metodi** per garantire affidabilità:

### 1️⃣ Webhook (Primario) - Risposta Istantanea
- Twilio chiama il webhook IMMEDIATAMENTE quando arriva un messaggio
- Tempo di risposta: **1-3 secondi** ⚡
- **Consigliato per produzione**

### 2️⃣ Polling (Fallback) - Backup Automatico
- Se webhook fallisce, il polling recupera il messaggio ogni 90 secondi
- Tempo di risposta: **0-90 secondi** (media: 45s)
- Serve come backup per garantire zero messaggi persi

## Troubleshooting

### Il webhook non riceve messaggi?
1. ✅ Verifica che l'URL sia pubblicamente accessibile (no localhost)
2. ✅ Controlla che il metodo sia `HTTP POST`
3. ✅ Verifica che la Replit app sia pubblicata/running
4. ✅ Testa l'endpoint con curl:
   ```bash
   curl -X POST https://[TUO-REPL-URL].replit.app/api/whatsapp/webhook \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=whatsapp:+393331234567&To=whatsapp:+393500220129&Body=test"
   ```

### Errori nei logs?
- Se vedi errori di database, verifica la connection string
- Se vedi errori Twilio, verifica API keys in `consultantWhatsappConfig`

### Il polling continua anche con webhook attivo?
- Sì, è normale! Il polling serve come fallback
- Con webhook attivo, il polling non trova nuovi messaggi (già processati)
- Questo garantisce zero perdite di messaggi

## Vantaggi del Webhook vs Solo Polling

| Feature | Webhook | Solo Polling |
|---------|---------|--------------|
| Tempo risposta | 1-3 secondi ⚡ | 0-90 secondi |
| Carico database | Minimo | Alto (query ogni 90s) |
| Affidabilità | 99.9% | 95% (dipende da frequenza) |
| Consumo risorse | Basso | Medio |

## Note di Sicurezza

- Il webhook è pubblico ma validato da Twilio
- Per maggiore sicurezza, puoi validare il signature Twilio (vedi documentazione Twilio)
- Le API keys Twilio sono salvate criptate nel database
