# Configurazione Sottofondo Audio Ufficio - VPS Bridge

## Panoramica
Questa guida spiega come aggiungere il sottofondo audio "ufficio/call center" alle chiamate telefoniche gestite dal VPS bridge (FreeSWITCH + Gemini).

## File Audio
Il file audio è disponibile su Replit:
- **URL**: `https://[TUO_DOMINIO_REPLIT]/audio/office-background.mp3`
- **Durata**: ~3 minuti (in loop)
- **Formato**: MP3

Puoi anche scaricare il file direttamente sul VPS per evitare latenze di rete.

## Implementazione nel Bridge

### Opzione 1: Python (pydub + numpy)

```python
from pydub import AudioSegment
import numpy as np
import asyncio

class BackgroundAudioMixer:
    def __init__(self, background_file_path: str, volume: float = 0.15):
        """
        volume: 0.0 - 1.0 (consigliato 0.15 per sottofondo discreto)
        """
        self.volume = volume
        
        # Carica audio di sottofondo
        bg = AudioSegment.from_mp3(background_file_path)
        bg = bg.set_frame_rate(24000).set_channels(1)  # Match Gemini output
        
        # Converti in numpy array normalizzato
        self.bg_samples = np.array(bg.get_array_of_samples(), dtype=np.float32)
        self.bg_samples = self.bg_samples / 32768.0  # Normalizza int16 -> float
        self.bg_samples = self.bg_samples * volume  # Applica volume
        
        self.position = 0
    
    def mix(self, ai_audio: np.ndarray) -> np.ndarray:
        """
        Mixa l'audio AI con il sottofondo.
        ai_audio: numpy array float32, range [-1, 1]
        """
        length = len(ai_audio)
        
        # Loop del sottofondo se necessario
        if self.position + length > len(self.bg_samples):
            # Wrap around
            first_part = self.bg_samples[self.position:]
            remaining = length - len(first_part)
            loops_needed = remaining // len(self.bg_samples) + 1
            bg_chunk = np.concatenate([first_part] + [self.bg_samples] * loops_needed)[:length]
            self.position = remaining % len(self.bg_samples)
        else:
            bg_chunk = self.bg_samples[self.position:self.position + length]
            self.position += length
        
        # Mixa
        mixed = ai_audio + bg_chunk
        
        # Clamp per evitare clipping
        mixed = np.clip(mixed, -1.0, 1.0)
        
        return mixed

# Uso nel bridge:
mixer = BackgroundAudioMixer('/path/to/office-background.mp3', volume=0.15)

async def process_gemini_audio(audio_chunk: bytes) -> bytes:
    # Converti bytes (PCM16) in numpy
    ai_samples = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
    
    # Mixa con sottofondo
    mixed_samples = mixer.mix(ai_samples)
    
    # Converti back a PCM16
    output = (mixed_samples * 32768).astype(np.int16).tobytes()
    
    return output
```

### Opzione 2: Node.js (fluent-ffmpeg)

```javascript
const ffmpeg = require('fluent-ffmpeg');
const { Readable, Writable } = require('stream');

class BackgroundAudioMixer {
  constructor(backgroundFilePath, volume = 0.15) {
    this.backgroundFilePath = backgroundFilePath;
    this.volume = volume;
  }

  async mixAudio(aiAudioBuffer) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      ffmpeg()
        .input(Readable.from(aiAudioBuffer))
        .inputFormat('s16le')
        .inputOptions(['-ar 24000', '-ac 1'])
        .input(this.backgroundFilePath)
        .complexFilter([
          `[1:a]aloop=loop=-1:size=2e9,volume=${this.volume}[bg]`,
          `[0:a][bg]amix=inputs=2:duration=first[out]`
        ])
        .outputOptions(['-map [out]', '-f s16le', '-ar 24000', '-ac 1'])
        .on('error', reject)
        .pipe()
        .on('data', chunk => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
```

## Integrazione nel Flusso di Chiamata

### Chiamate In Entrata (Inbound)
1. FreeSWITCH riceve la chiamata
2. Il bridge riceve l'audio dal caller
3. Gemini genera la risposta vocale
4. **Il mixer aggiunge il sottofondo all'audio Gemini**
5. L'audio mixato viene inviato a FreeSWITCH

### Chiamate In Uscita (Outbound)
1. Il bridge avvia la chiamata tramite FreeSWITCH
2. Gemini genera l'audio di saluto
3. **Il mixer aggiunge il sottofondo**
4. L'audio mixato viene inviato

## Note Importanti

1. **Volume**: Mantieni il volume del sottofondo tra 0.10 e 0.20 per non coprire la voce AI
2. **Sample Rate**: Assicurati che il sottofondo sia a 24000 Hz (come Gemini)
3. **Mono**: Il sottofondo deve essere mono
4. **Loop**: Il sottofondo deve essere in loop continuo per tutta la durata della chiamata
5. **Latenza**: Caricare il file in memoria all'avvio del bridge per evitare latenze durante la chiamata

## File da Scaricare

```bash
# Sul VPS
wget "https://[TUO_DOMINIO_REPLIT]/audio/office-background.mp3" -O /opt/voice-bridge/assets/office-background.mp3
```

Oppure copia manualmente il file `attached_assets/Office_1770092478939.mp3` sul VPS.
