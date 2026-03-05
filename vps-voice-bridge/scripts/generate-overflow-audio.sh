#!/bin/bash
# ================================================================
# Genera file audio WAV per la coda overflow di FreeSWITCH
# Usa espeak-ng (TTS offline) per generare messaggi in italiano
# Output: 8kHz mono 16-bit PCM WAV (compatibile FreeSWITCH)
# ================================================================
#
# Prerequisiti sul VPS:
#   sudo apt-get install espeak-ng sox
#
# Uso:
#   chmod +x generate-overflow-audio.sh
#   ./generate-overflow-audio.sh
#
# I file vengono generati in /opt/sounds/overflow/

OUTPUT_DIR="/opt/sounds/overflow"
SAMPLE_RATE=8000

echo "=== Generazione audio overflow per FreeSWITCH ==="
echo "Output: ${OUTPUT_DIR}"
echo ""

sudo mkdir -p "${OUTPUT_DIR}"

generate_tts() {
    local text="$1"
    local output_file="$2"
    local temp_file="/tmp/overflow_tts_temp.wav"
    
    echo "  Generando: ${output_file}"
    echo "  Testo: ${text}"
    
    espeak-ng -v it -s 140 -p 50 -w "${temp_file}" "${text}" 2>/dev/null
    
    sox "${temp_file}" -r ${SAMPLE_RATE} -c 1 -b 16 "${OUTPUT_DIR}/${output_file}" 2>/dev/null
    
    rm -f "${temp_file}"
    
    if [ -f "${OUTPUT_DIR}/${output_file}" ]; then
        local duration=$(soxi -D "${OUTPUT_DIR}/${output_file}" 2>/dev/null)
        echo "  OK (${duration}s)"
    else
        echo "  ERRORE nella generazione!"
    fi
    echo ""
}

echo "[1/5] Messaggio annuncio (con DTMF)..."
generate_tts \
    "Tutti i nostri operatori sono al momento occupati. Rimani in linea per parlare con il nostro assistente, oppure premi 1 per essere trasferito a un consulente." \
    "announcement.wav"

echo "[2/5] Messaggio annuncio (senza DTMF)..."
generate_tts \
    "Tutti i nostri operatori sono al momento occupati. Rimani in linea, sarai collegato al primo operatore disponibile." \
    "announcement_no_dtmf.wav"

echo "[3/5] Messaggio trasferimento..."
generate_tts \
    "Ti stiamo trasferendo a un consulente. Attendi un momento." \
    "transferring.wav"

echo "[4/5] Messaggio trasferimento fallito..."
generate_tts \
    "Il trasferimento non è riuscito. Riprova più tardi. Arrivederci." \
    "transfer_failed.wav"

echo "[5/5] Musica d'attesa (30 secondi)..."
sox -n -r ${SAMPLE_RATE} -c 1 -b 16 "${OUTPUT_DIR}/hold_music.wav" \
    synth 30 sine 440:880 sine 330:660 \
    remix - \
    gain -20 \
    tremolo 0.5 40 \
    reverb 50 \
    fade h 1 30 1 \
    2>/dev/null

if [ -f "${OUTPUT_DIR}/hold_music.wav" ]; then
    duration=$(soxi -D "${OUTPUT_DIR}/hold_music.wav" 2>/dev/null)
    echo "  OK (${duration}s)"
else
    echo "  Fallback: generazione tono semplice..."
    sox -n -r ${SAMPLE_RATE} -c 1 -b 16 "${OUTPUT_DIR}/hold_music.wav" \
        synth 30 sine 440 gain -25 fade h 2 30 2 2>/dev/null
fi

echo ""
echo "=== Generazione completata ==="
echo "File generati:"
ls -la "${OUTPUT_DIR}/"*.wav 2>/dev/null
echo ""
echo "Ricorda di ricaricare il dialplan FreeSWITCH:"
echo "  fs_cli -x 'reloadxml'"
