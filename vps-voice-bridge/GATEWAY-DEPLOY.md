# Guida Deploy - Gateway SIP Telnyx e Messagenet

> **Alessia AI Voice Platform** - Configurazione trunk SIP per chiamate reali
> Questa guida copre il setup completo per connettere FreeSWITCH ai provider
> Telnyx e Messagenet per gestire chiamate in entrata e uscita.

---

## 1. Prerequisiti

Prima di procedere, verifica di avere:

- **FreeSWITCH** in Docker già funzionante con `mod_audio_stream`
- **Voice Bridge** Node.js attivo su porta 9090 (vedi `DEPLOY.md`)
- **fail2ban** configurato e attivo (già presente sulla VPS)
- **UFW firewall** configurato (vedi `security/ufw-setup.sh`)
  - Porta 5060/UDP aperta (SIP)
  - Porta 5061/TCP aperta (SIP TLS)
  - Range 16384-32768/UDP aperto (RTP media)
- **IP pubblico statico** del VPS (necessario per IP authentication)

### Verifica rapida

```bash
# FreeSWITCH attivo?
docker exec -it freeswitch fs_cli -x "status"

# Voice Bridge attivo?
curl http://127.0.0.1:9090/health

# Firewall configurato?
sudo ufw status

# fail2ban attivo?
sudo systemctl status fail2ban
```

---

## 2. Setup Telnyx

### 2.1 Crea Account e SIP Connection

1. Vai su [https://portal.telnyx.com](https://portal.telnyx.com)
2. Crea un account (o accedi se ne hai già uno)
3. Vai in **Networking → SIP Connections**
4. Clicca **"Create SIP Connection"**

### 2.2 Scegli il tipo di autenticazione

**Opzione A: IP Authentication** (consigliata per VPS con IP statico)
- Seleziona "IP Authentication"
- Aggiungi l'IP pubblico del tuo VPS
- Non servono credenziali SIP
- Usa il file: `telnyx-ip.xml`

**Opzione B: Credential Authentication** (per IP dinamici)
- Seleziona "Credential Authentication"
- Telnyx genererà username e password SIP
- Copia le credenziali e inseriscile nel file `telnyx-credentials.xml`
- Sostituisci `TELNYX_SIP_USERNAME` e `TELNYX_SIP_PASSWORD`

### 2.3 Acquista numeri DID italiani

1. Vai in **Numbers → Search & Buy**
2. Cerca numeri italiani (+39)
3. Acquista i numeri necessari per i tuoi consulenti
4. Ogni consulente può avere un numero dedicato

### 2.4 Crea Outbound Voice Profile

1. Vai in **Voice → Outbound Voice Profiles**
2. Crea un nuovo profilo
3. Configura il Caller ID con i numeri acquistati
4. Associa il profilo alla SIP Connection creata

### 2.5 Associa numeri alla connessione

1. Vai in **Numbers → My Numbers**
2. Per ogni numero, assegna la SIP Connection creata
3. Le chiamate inbound a questi numeri arriveranno al tuo FreeSWITCH

---

## 3. Setup Messagenet

### 3.1 Crea Account

1. Vai su [https://www.messagenet.com](https://www.messagenet.com)
2. Crea un account
3. Accedi all'**Area Clienti**

### 3.2 Acquista numero geografico italiano

1. Vai in **Servizi VoIP → Numeri**
2. Scegli un numero geografico (es. 02-xxx per Milano, 06-xxx per Roma)
3. Completa l'acquisto

### 3.3 Ottieni credenziali SIP

1. Vai in **Servizi VoIP → Configurazione SIP**
2. Le credenziali sono:
   - **Username (URI SIP)**: codice a 10 cifre che inizia con `5` (es. `5012345678`)
   - **Password**: generata automaticamente dal sistema
3. Inserisci le credenziali nel file `messagenet-credentials.xml`:
   - Sostituisci `MSGNET_SIP_USERNAME` con l'URI a 10 cifre
   - Sostituisci `MSGNET_SIP_PASSWORD` con la password

### 3.4 Nota sulle porte

Messagenet usa come porta primaria la **5061** (non è TLS, è UDP su porta non standard).
Se la registrazione fallisce:
1. Prova prima con porta `5061` (default nel file)
2. Se non funziona, modifica il file e cambia a porta `5060`:
   ```xml
   <param name="register-proxy" value="sip.messagenet.it:5060"/>
   ```

---

## 4. Deploy dei file

Copia i file di configurazione dalla tua macchina locale al container FreeSWITCH.

### 4.1 Gateway SIP

```bash
# ============================================
# Gateway Telnyx (scegli UNO dei due)
# ============================================

# Opzione A: IP Authentication (consigliata)
docker cp telnyx-ip.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/sip_profiles/external/telnyx-ip.xml

# Opzione B: Credential Authentication
docker cp telnyx-credentials.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/sip_profiles/external/telnyx-credentials.xml

# ============================================
# Gateway Messagenet (scegli UNO dei due)
# ============================================

# Opzione A: Credential Authentication (standard)
docker cp messagenet-credentials.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/sip_profiles/external/messagenet-credentials.xml

# Opzione B: IP Authentication (solo enterprise)
docker cp messagenet-ip.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/sip_profiles/external/messagenet-ip.xml
```

### 4.2 ACL (Access Control List)

```bash
docker cp acl.conf.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/autoload_configs/acl.conf.xml
```

### 4.3 Dialplan

```bash
# Outbound: routing chiamate in uscita
docker cp 02_outbound_trunk.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/dialplan/default/02_outbound_trunk.xml

# Security: controllo ACL sulle chiamate inbound
docker cp 00_acl_check.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/dialplan/public/00_acl_check.xml
```

### 4.4 Configurazione core

```bash
# Performance: ottimizzazione per 100+ chiamate
docker cp switch.conf.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/autoload_configs/switch.conf.xml

# Event Socket: connessione Voice Bridge ↔ FreeSWITCH
docker cp event_socket.conf.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/autoload_configs/event_socket.conf.xml
```

### 4.5 Inbound dialplan (aggiornato)

```bash
# Dialplan inbound multi-tenant con anti-fraud e timeout
docker cp alessia-ai-multitenant.xml freeswitch:/usr/local/freeswitch/etc/freeswitch/dialplan/public/alessia-ai.xml
```

---

## 5. Applicare le modifiche

Dopo aver copiato tutti i file, ricarica la configurazione:

```bash
# Ricarica tutta la configurazione XML
docker exec -it freeswitch fs_cli -x "reloadxml"

# Ricarica le ACL
docker exec -it freeswitch fs_cli -x "reloadacl"

# Riavvia il profilo SIP external per caricare i nuovi gateway
docker exec -it freeswitch fs_cli -x "sofia profile external restart"
```

**ATTENZIONE**: `sofia profile external restart` interrompe momentaneamente tutte le chiamate
attive sul profilo external. Eseguire in orari di basso traffico.

---

## 6. Verifica

### 6.1 Stato generale Sofia

```bash
docker exec -it freeswitch fs_cli -x "sofia status"
```

Output atteso: dovresti vedere il profilo `external` con stato `RUNNING`.

### 6.2 Stato gateway

```bash
# Verifica gateway Telnyx
docker exec -it freeswitch fs_cli -x "sofia status gateway telnyx-ip"
# Oppure
docker exec -it freeswitch fs_cli -x "sofia status gateway telnyx-credentials"

# Verifica gateway Messagenet
docker exec -it freeswitch fs_cli -x "sofia status gateway messagenet-credentials"
# Oppure
docker exec -it freeswitch fs_cli -x "sofia status gateway messagenet-ip"
```

Per i gateway con registrazione (credentials), lo stato deve essere `REGED` (registrato).
Per i gateway IP auth, lo stato sarà `NOREG` (nessuna registrazione necessaria).

### 6.3 Verifica ACL

```bash
# Ricarica ACL
docker exec -it freeswitch fs_cli -x "reloadacl"

# Testa un IP Telnyx (deve restituire "true")
docker exec -it freeswitch fs_cli -x "acl telnyx 192.76.120.10"

# Testa un IP Messagenet (deve restituire "true")
docker exec -it freeswitch fs_cli -x "acl messagenet 109.233.130.1"

# Testa un IP non autorizzato (deve restituire "false")
docker exec -it freeswitch fs_cli -x "acl trusted_providers 1.2.3.4"
```

---

## 7. Test chiamate

### 7.1 Test outbound (chiamata in uscita)

```bash
# Test via Telnyx (sostituisci con un numero reale)
docker exec -it freeswitch fs_cli -x "originate sofia/gateway/telnyx-ip/+393331234567 &echo"

# Test via Messagenet
docker exec -it freeswitch fs_cli -x "originate sofia/gateway/messagenet-credentials/+393331234567 &echo"
```

Il comando `&echo` riproduce al chiamante ciò che dice (echo test).
Sostituisci `+393331234567` con un numero reale per il test.

### 7.2 Test inbound (chiamata in entrata)

1. Chiama uno dei numeri DID acquistati da un telefono esterno
2. La chiamata dovrebbe arrivare a FreeSWITCH → contesto public
3. Il dialplan risponde e connette al WebSocket bridge
4. Verifica nei log:

```bash
# Log FreeSWITCH in tempo reale
docker logs -f freeswitch 2>&1 | grep -i "alessia\|INBOUND\|OUTBOUND"

# Log Voice Bridge
journalctl -u alessia-voice -f
```

### 7.3 Test completo dal Voice Bridge

Il Voice Bridge origina chiamate via ESL con:

```javascript
originate {sip_gateway=telnyx-ip,effective_caller_id_number=+39021234567,effective_caller_id_name=NomeConsulente}sofia/gateway/telnyx-ip/+393331234567 &park
```

---

## 8. Troubleshooting

### Il gateway non si registra

```bash
# Controlla lo stato del gateway
docker exec -it freeswitch fs_cli -x "sofia status gateway messagenet-credentials"

# Se lo stato è FAIL_WAIT o UNREGED:
# 1. Verifica le credenziali nel file XML del gateway
# 2. Verifica che le porte 5060/5061 siano aperte nel firewall
# 3. Verifica che il DNS risolva correttamente:
docker exec -it freeswitch bash -c "nslookup sip.telnyx.com"
docker exec -it freeswitch bash -c "nslookup sip.messagenet.it"
```

### Audio unidirezionale (senti ma non ti sentono, o viceversa)

Problema quasi sempre legato a NAT/IP esterni. Verifica in `external.xml`:

```bash
docker exec -it freeswitch cat /usr/local/freeswitch/etc/freeswitch/sip_profiles/external.xml | grep ext-
```

Deve contenere:
```xml
<param name="ext-rtp-ip" value="IP_PUBBLICO_VPS"/>
<param name="ext-sip-ip" value="IP_PUBBLICO_VPS"/>
```

### Chiamate rifiutate (403 Forbidden)

```bash
# Verifica ACL
docker exec -it freeswitch fs_cli -x "acl trusted_providers IP_DEL_PROVIDER"

# Se restituisce "false", aggiungi l'IP alla ACL in acl.conf.xml
# Poi ricarica:
docker exec -it freeswitch fs_cli -x "reloadacl"
```

### Messagenet: porta 5061 non funziona

Modifica `messagenet-credentials.xml` e cambia la porta:

```xml
<!-- Da: -->
<param name="register-proxy" value="sip.messagenet.it:5061"/>
<!-- A: -->
<param name="register-proxy" value="sip.messagenet.it:5060"/>
```

Poi ricarica:
```bash
docker exec -it freeswitch fs_cli -x "reloadxml"
docker exec -it freeswitch fs_cli -x "sofia profile external restart"
```

### fail2ban

fail2ban è già attivo e configurato sulla VPS. Non serve riconfigurarlo.
Se noti troppi tentativi SIP bloccati, controlla:

```bash
sudo fail2ban-client status freeswitch
```

---

## 9. Scalabilità per 100+ consulenti

### 9.1 RAM disk per database core

Il file `switch.conf.xml` è già configurato per usare `/dev/shm/core.db`.
Verifica che tmpfs sia montato:

```bash
df -h /dev/shm
# Deve mostrare almeno 512MB disponibili
```

### 9.2 ulimits

Configura i limiti del sistema per gestire molte connessioni simultanee.

**In `/etc/security/limits.conf`:**
```
freeswitch  soft  nofile  999999
freeswitch  hard  nofile  999999
```

**Oppure nel Docker Compose:**
```yaml
services:
  freeswitch:
    ulimits:
      nofile:
        soft: 999999
        hard: 999999
```

### 9.3 Parametri ottimizzati

Il file `switch.conf.xml` include:
- `max-sessions=2000` → supporta fino a 2000 chiamate simultanee
- `sessions-per-second=100` → rate limiting per prevenire flood
- `rtp-start-port=16384`, `rtp-end-port=32768` → 16384 porte RTP disponibili

### 9.4 Monitoraggio

```bash
# Chiamate attive sul profilo external
docker exec -it freeswitch fs_cli -x "sofia status profile external"

# Numero totale di canali attivi
docker exec -it freeswitch fs_cli -x "show channels count"

# Utilizzo risorse
docker exec -it freeswitch fs_cli -x "status"
```

### 9.5 Banda necessaria

| Codec | Bitrate per chiamata | 100 chiamate | 200 chiamate |
|-------|---------------------|--------------|--------------|
| G.711 (PCMU/PCMA) | ~87 Kbps | ~8.7 Mbps | ~17.4 Mbps |
| G.722 (HD Voice) | ~87 Kbps | ~8.7 Mbps | ~17.4 Mbps |
| OPUS | ~32 Kbps | ~3.2 Mbps | ~6.4 Mbps |

Assicurati che la VPS abbia banda sufficiente (consigliato: almeno 100 Mbps).

---

## 10. Sicurezza

La sicurezza è implementata su tre livelli (defense in depth):

### Livello 1: ACL FreeSWITCH

Il file `acl.conf.xml` definisce quali IP possono inviare traffico SIP.
Il file `00_acl_check.xml` rifiuta automaticamente le chiamate da IP non autorizzati.

```bash
# Verifica ACL
docker exec -it freeswitch fs_cli -x "reloadacl"
docker exec -it freeswitch fs_cli -x "acl trusted_providers IP_DA_TESTARE"
```

### Livello 2: fail2ban

Già attivo sulla VPS. Blocca automaticamente gli IP che tentano attacchi SIP brute-force.

```bash
sudo fail2ban-client status freeswitch
```

### Livello 3: UFW Firewall

Già configurato con `security/ufw-setup.sh`. Solo le porte necessarie sono aperte.

```bash
sudo ufw status verbose
```

### Event Socket

L'Event Socket (porta 8021) è configurato su `127.0.0.1` in `event_socket.conf.xml`.

**NON esporre MAI la porta 8021 all'esterno.**
Chiunque abbia accesso all'Event Socket può:
- Originare chiamate a qualsiasi numero (a tue spese)
- Ascoltare le chiamate in corso
- Spegnere FreeSWITCH

### Aggiornamento IP dei provider

Controlla periodicamente che gli IP dei provider siano aggiornati:
- **Telnyx**: [https://support.telnyx.com/en/articles/ip-addresses](https://support.telnyx.com/en/articles/ip-addresses)
- **Messagenet**: [https://helpcenter.messagenet.com](https://helpcenter.messagenet.com)

Se gli IP cambiano, aggiorna `acl.conf.xml` e ricarica:
```bash
docker exec -it freeswitch fs_cli -x "reloadacl"
```

---

## Riepilogo file

| File | Percorso nel container | Descrizione |
|------|----------------------|-------------|
| `telnyx-ip.xml` | `sip_profiles/external/` | Gateway Telnyx IP auth |
| `telnyx-credentials.xml` | `sip_profiles/external/` | Gateway Telnyx credentials |
| `messagenet-credentials.xml` | `sip_profiles/external/` | Gateway Messagenet credentials |
| `messagenet-ip.xml` | `sip_profiles/external/` | Gateway Messagenet IP auth |
| `acl.conf.xml` | `autoload_configs/` | Access Control List |
| `02_outbound_trunk.xml` | `dialplan/default/` | Routing chiamate uscita |
| `00_acl_check.xml` | `dialplan/public/` | Controllo sicurezza inbound |
| `switch.conf.xml` | `autoload_configs/` | Config core ottimizzata |
| `event_socket.conf.xml` | `autoload_configs/` | Event Socket (localhost) |
| `alessia-ai-multitenant.xml` | `dialplan/public/` | Inbound multi-tenant |

Tutti i percorsi sono relativi a `/usr/local/freeswitch/etc/freeswitch/`.
