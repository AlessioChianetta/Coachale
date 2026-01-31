# Verifica mod_audio_stream per FreeSWITCH

## 1. Verifica se mod_audio_stream è caricato

```bash
# Connetti a FreeSWITCH CLI
docker exec -it freeswitch fs_cli -H 127.0.0.1 -P 8021 -p '1NoxIsTheBest1!'

# Oppure con comando diretto
docker exec -it freeswitch fs_cli -H 127.0.0.1 -P 8021 -p '1NoxIsTheBest1!' -x "show modules" | grep audio
```

**Output atteso:**
```
mod_audio_stream,/usr/lib/freeswitch/mod/mod_audio_stream.so,running
```

## 2. Se mod_audio_stream NON è presente

### Opzione A: Abilita in modules.conf.xml

```bash
# Entra nel container
docker exec -it freeswitch bash

# Modifica modules.conf.xml
nano /etc/freeswitch/autoload_configs/modules.conf.xml
```

Aggiungi o decommenta:
```xml
<load module="mod_audio_stream"/>
```

Riavvia FreeSWITCH:
```bash
docker restart freeswitch
```

### Opzione B: Compila mod_audio_stream

Se il modulo non è incluso nella tua immagine Docker, devi ricompilarlo:

```bash
# Clona il repo di FreeSWITCH
git clone https://github.com/signalwire/freeswitch.git
cd freeswitch

# Abilita mod_audio_stream in modules.conf
echo "applications/mod_audio_stream" >> modules.conf

# Compila
./bootstrap.sh -j
./configure
make mod_audio_stream-install

# Copia il modulo nel container
docker cp modules/applications/mod_audio_stream/.libs/mod_audio_stream.so freeswitch:/usr/lib/freeswitch/mod/
```

### Opzione C: Usa immagine Docker con mod_audio_stream

```dockerfile
# Dockerfile personalizzato
FROM signalwire/freeswitch:latest

# Installa mod_audio_stream
RUN apt-get update && apt-get install -y freeswitch-mod-audio-stream

# Abilita il modulo
RUN echo '<load module="mod_audio_stream"/>' >> /etc/freeswitch/autoload_configs/modules.conf.xml
```

## 3. Verifica il dialplan

```bash
# Ricarica configurazione
docker exec -it freeswitch fs_cli -x "reloadxml"

# Verifica che l'estensione 9999 sia caricata
docker exec -it freeswitch fs_cli -x "show dialplan" | grep alessia
```

## 4. Test chiamata

### Test con loopback (senza SIP esterno)

```bash
# Crea una chiamata di test
docker exec -it freeswitch fs_cli -x "originate loopback/9999/default &park"

# Verifica chiamate attive
docker exec -it freeswitch fs_cli -x "show calls"

# Termina tutte le chiamate
docker exec -it freeswitch fs_cli -x "hupall"
```

### Test con softphone SIP

1. Configura un softphone (Zoiper, Linphone, etc.)
2. Registra su FreeSWITCH (se hai utenti SIP configurati)
3. Chiama **9999**

## 5. Debugging

### Log FreeSWITCH

```bash
# Log in tempo reale
docker exec -it freeswitch fs_cli -x "console loglevel 7"
docker logs -f freeswitch

# Oppure dentro fs_cli
/log 7
```

### Verifica connessione WebSocket

```bash
# Controlla se il bridge è raggiungibile
curl -I http://127.0.0.1:9090/health
```

### Problemi comuni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `mod_audio_stream not found` | Modulo non installato | Vedi Opzione B o C sopra |
| `Connection refused 127.0.0.1:9090` | Bridge non avviato | `systemctl start alessia-voice` |
| `No audio` | Codec mismatch | Verifica `audio_stream_codec=PCMU` |
| `Call drops immediately` | WebSocket error | Controlla log bridge |

## 6. Formato messaggi mod_audio_stream

### Messaggio START (da FreeSWITCH)
```json
{
  "event": "start",
  "call_id": "abc123-def456",
  "caller_id": "+393331234567",
  "called_number": "9999",
  "codec": "PCMU",
  "sample_rate": 8000
}
```

### Frame AUDIO (bidirezionale)
```
Binary WebSocket frame: raw μ-law bytes (160 bytes = 20ms @ 8kHz)
```

### Messaggio STOP (da FreeSWITCH)
```json
{
  "event": "stop",
  "call_id": "abc123-def456",
  "reason": "hangup"
}
```
