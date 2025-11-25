# 🕐 Come Cambiare Google Calendar da AM/PM a Formato 24 Ore (13:00)

## Il Problema
Vedi "6 AM, 7 AM, 12 PM, 1 PM" invece di "06:00, 07:00, 12:00, 13:00" nell'iframe del calendario.

## La Causa
Google Calendar usa le impostazioni del TUO account Google, non i parametri dell'iframe.

## ✅ SOLUZIONE (2 minuti)

### PASSO 1: Apri Google Calendar
1. Vai su https://calendar.google.com
2. Accedi con il tuo account (orbitaleale@gmail.com)

### PASSO 2: Vai nelle Impostazioni
1. Clicca sull'icona **⚙️ Impostazioni** (in alto a destra)
2. Seleziona **"Impostazioni"** dal menu

### PASSO 3: Cambia Formato Orario
1. Nel menu a sinistra, clicca su **"Generali"**
2. Scorri fino a trovare **"Formato ora"** o **"Time format"**
3. Seleziona **"24h (13:00)"** invece di "12h (1:00 PM)"
4. Clicca **"Salva"** o attendi il salvataggio automatico

### PASSO 4: Ricarica la Pagina
1. Torna sulla tua app (http://localhost:5000/consultant-calendar)
2. Premi **F5** o **CTRL+R** per ricaricare
3. Ora dovrebbe mostrare: 06:00, 07:00, 13:00, 14:00, ecc.

---

## 📍 Impostazioni Consigliate per l'Italia

Mentre sei nelle impostazioni, verifica anche:
- **Lingua**: Italiano
- **Fuso orario**: (GMT+01:00) Europe/Rome
- **Formato ora**: 24h
- **Prima settimana**: Lunedì

---

## ✅ Risultato Finale

PRIMA:
```
6 AM
7 AM
12 PM
1 PM
2 PM
```

DOPO:
```
06:00
07:00
12:00
13:00
14:00
```

---

## 🤖 Nota Tecnica
L'AI del sistema WhatsApp **è già configurata correttamente** e propone gli slot nel formato 24 ore:
- "Lunedì 3 novembre alle 13:00" ✅
- "Martedì 4 novembre alle 15:30" ✅

Solo l'iframe visualizza AM/PM perché legge le tue impostazioni Google personali.
