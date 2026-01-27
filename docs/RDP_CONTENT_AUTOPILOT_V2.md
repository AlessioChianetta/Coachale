# RDP - Content Autopilot V2

## Obiettivo
Sistema avanzato di generazione batch contenuti social integrato nella pagina Ideas.

## Funzionalità

### Core
1. **Integrazione in Ideas** - Autopilot dentro `/ideas` accanto a "Genera Idee", eredita configurazione corrente
2. **Frequenza salvata** - Persistere quanti post/giorno per piattaforma in brandAssets
3. **Blocco date passate** - Non permettere selezione date nel passato
4. **Blocco giorni già generati** - Verifica post esistenti prima di generare

### Modalità Generazione
5. **Automatica** - Genera tutto senza fermarsi
6. **Controllata** - Giorno per giorno con anteprima, possibilità di rigenerare singoli giorni

### Template e Scheduling
7. **Template frequenza** - Preset salvabili:
   - Lancio prodotto (3 post/giorno)
   - Mantenimento (1 post/giorno)
   - Campagna aggressiva (5+ post/giorno)
8. **Esclusione giorni** - Salta weekend, festività italiane, giorni specifici
9. **Orari smart** - Orari ottimali per engagement per piattaforma:
   - Instagram: 11:00, 14:00, 19:00
   - X/Twitter: 09:00, 12:00, 17:00
   - LinkedIn: 08:00, 12:00, 17:30

### Qualità Contenuti
10. **Varietà tematica** - Rotazione automatica tra tipi:
    - Educativo
    - Promozionale
    - Storytelling
    - Behind-the-scenes
11. **Score qualità AI** - Punteggio 1-10 per ogni post generato

### Cleanup
12. **Rimuovere pagina standalone** - Eliminare `/autopilot` e link sidebar

## Schema DB

### brandAssets.postingSchedule (jsonb esistente, esteso)
```json
{
  "instagram": {
    "postsPerDay": 2,
    "times": ["11:00", "19:00"],
    "writingStyle": "conversational"
  },
  "x": {
    "postsPerDay": 3,
    "times": ["09:00", "12:00", "17:00"],
    "writingStyle": "direct"
  },
  "linkedin": {
    "postsPerDay": 1,
    "times": ["08:00"],
    "writingStyle": "default"
  }
}
```

### Nuova tabella: autopilot_templates
- id, consultantId, name, description
- platforms (jsonb con frequenze)
- excludeWeekends, excludeHolidays, excludedDates (jsonb array)
- contentTypes (jsonb array per rotazione)
- isDefault, createdAt

### contentPosts (campo esistente da usare)
- aiScore: punteggio 1-10 qualità

## Festività Italiane 2024-2026
- 1 Gennaio (Capodanno)
- 6 Gennaio (Epifania)
- Pasqua e Lunedì dell'Angelo (variabile)
- 25 Aprile (Liberazione)
- 1 Maggio (Festa Lavoro)
- 2 Giugno (Repubblica)
- 15 Agosto (Ferragosto)
- 1 Novembre (Ognissanti)
- 8 Dicembre (Immacolata)
- 25-26 Dicembre (Natale/S.Stefano)

## Orari Ottimali Engagement (ricerca)
- **Instagram**: 11:00-13:00, 19:00-21:00
- **X/Twitter**: 08:00-10:00, 12:00-13:00, 17:00-18:00
- **LinkedIn**: 07:30-08:30, 12:00, 17:00-18:00
