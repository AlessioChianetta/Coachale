# Manuale Completo: Sistema di Monetizzazione

**Data:** Gennaio 2026  
**Versione:** 1.0  
**Stato:** Attivo

---

## Indice

1. [Introduzione al Sistema di Monetizzazione](#1-introduzione-al-sistema-di-monetizzazione)
2. [I Tre Tier di Abbonamento](#2-i-tre-tier-di-abbonamento)
3. [Configurazione Stripe Connect](#3-configurazione-stripe-connect)
4. [Pricing Page Pubblica](#4-pricing-page-pubblica)
5. [Gestione Licenze e Preferenze](#5-gestione-licenze-e-preferenze)
6. [Flusso Upgrade Utenti](#6-flusso-upgrade-utenti)
7. [Revenue Sharing](#7-revenue-sharing)
8. [FAQ e Troubleshooting](#8-faq-e-troubleshooting)

---

## 1. Introduzione al Sistema di Monetizzazione

### 1.1 Panoramica del Modello SaaS Multi-Tenant

La piattaforma opera secondo un modello **SaaS multi-tenant** dove:

- **Piattaforma centrale**: Fornisce l'infrastruttura tecnologica, gli agenti AI, e il sistema di pagamento
- **Consulenti**: Operano come entità indipendenti con il proprio brand, clienti e pricing
- **Clienti finali**: Si iscrivono attraverso il consulente e interagiscono con gli agenti AI WhatsApp

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIATTAFORMA CENTRALE                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Infrastruttura│  │ Agenti AI    │  │ Stripe       │          │
│  │ Tecnologica   │  │ WhatsApp     │  │ Connect      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ CONSULENTE A │      │ CONSULENTE B │      │ CONSULENTE C │
│  (Franchisee)│      │  (Franchisee)│      │  (Franchisee)│
├──────────────┤      ├──────────────┤      ├──────────────┤
│ - Brand      │      │ - Brand      │      │ - Brand      │
│ - Pricing    │      │ - Pricing    │      │ - Pricing    │
│ - Clienti    │      │ - Clienti    │      │ - Clienti    │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 1.2 Il Consulente come "Franchisee"

Ogni consulente opera come un **franchisee digitale** della piattaforma:

- **Autonomia commerciale**: Definisce i propri prezzi entro i range stabiliti
- **Brand personale**: Personalizza la pricing page con logo, colori e contenuti
- **Gestione clienti**: Amministra i propri utenti e le relative licenze
- **Revenue diretta**: Riceve pagamenti direttamente sul proprio conto Stripe

### 1.3 Obiettivo: Monetizzare gli Agenti AI WhatsApp

L'obiettivo principale del sistema di monetizzazione è permettere ai consulenti di:

1. **Offrire un servizio di valore** tramite agenti AI conversazionali su WhatsApp
2. **Generare revenue ricorrente** attraverso abbonamenti mensili
3. **Scalare il business** senza limiti sul numero di clienti gestibili
4. **Differenziarsi** offrendo personalizzazioni AI uniche

---

## 2. I Tre Tier di Abbonamento

Il sistema prevede tre livelli di abbonamento, progettati per soddisfare diverse esigenze e budget:

### 2.1 Bronze (Gratuito)

| Caratteristica | Dettaglio |
|----------------|-----------|
| **Prezzo** | €0/mese |
| **Messaggi AI** | 15 al giorno |
| **Agenti AI** | Accesso a 1 agente |
| **Registrazione** | Semplice (solo nome e telefono) |
| **Target** | Trial / Test del servizio |

**Funzionalità Bronze:**
- Accesso limitato a 1 agente AI WhatsApp
- Contatore messaggi con reset giornaliero a mezzanotte
- Nessun onboarding wizard personalizzato
- Risposte AI con template standard
- Ideale per provare il servizio prima dell'upgrade

**Limitazioni:**
- Al raggiungimento del limite giornaliero, l'utente riceve un messaggio di invito upgrade
- Non può accedere ad agenti premium o funzionalità avanzate

### 2.2 Silver (€29-49/mese)

| Caratteristica | Dettaglio |
|----------------|-----------|
| **Prezzo** | €29-49/mese (configurabile dal consulente) |
| **Messaggi AI** | Illimitati |
| **Agenti AI** | Tutti gli agenti abilitati |
| **Onboarding** | Wizard con preferenze personalizzate |
| **Supporto** | Prioritario |

**Funzionalità Silver:**
- Messaggi AI illimitati senza contatore
- Accesso a tutti gli agenti AI abilitati dal consulente
- Onboarding wizard personalizzato:
  - Scelta stile di comunicazione
  - Preferenze lunghezza risposte
  - Istruzioni custom opzionali
- Risposte AI personalizzate in base alle preferenze
- Priorità nelle code di elaborazione

**Vantaggi rispetto a Bronze:**
- Nessuna interruzione per limiti messaggi
- Esperienza AI completamente personalizzata
- Accesso a tutti gli agenti del consulente

### 2.3 Gold (€59-99/mese)

| Caratteristica | Dettaglio |
|----------------|-----------|
| **Prezzo** | €59-99/mese (configurabile dal consulente) |
| **Base** | Tutto incluso in Silver |
| **Premium** | Funzionalità esclusive future |
| **Analytics** | Dashboard avanzate |
| **Early Access** | Nuove feature in anteprima |

**Funzionalità Gold (attuali e future):**
- Tutto ciò che è incluso nel tier Silver
- Analytics avanzate sulle conversazioni AI
- Report personalizzati sull'utilizzo
- Accesso anticipato a nuove funzionalità
- Canale di supporto dedicato
- Possibilità di richieste feature prioritarie

**Roadmap funzionalità Gold:**
- [ ] Dashboard analytics conversazioni
- [ ] Export dati conversazioni
- [ ] Agenti AI esclusivi Gold
- [ ] Integrazioni premium (CRM, calendari)

### 2.4 Tabella Comparativa Tier

| Funzionalità | Bronze | Silver | Gold |
|--------------|:------:|:------:|:----:|
| Messaggi AI/giorno | 15 | ∞ | ∞ |
| Numero agenti | 1 | Tutti | Tutti |
| Onboarding wizard | ❌ | ✅ | ✅ |
| Preferenze AI | ❌ | ✅ | ✅ |
| Supporto prioritario | ❌ | ✅ | ✅ |
| Analytics avanzate | ❌ | ❌ | ✅ |
| Early access | ❌ | ❌ | ✅ |
| Prezzo | Gratis | €29-49 | €59-99 |

---

## 3. Configurazione Stripe Connect

Stripe Connect permette ai consulenti di ricevere pagamenti direttamente sul proprio conto, con la piattaforma che trattiene automaticamente la sua percentuale.

### 3.1 Come Creare un Account Stripe Connect

**Passo 1: Accedi al Tab Licenze**
1. Vai a "I tuoi dipendenti" nella sidebar
2. Seleziona il tab "Licenze"
3. Clicca su "Collega Stripe Connect"

**Passo 2: Completa l'Onboarding Stripe**
1. Stripe aprirà una finestra di onboarding
2. Inserisci i tuoi dati aziendali
3. Completa la verifica dell'identità

**Passo 3: Attendi Approvazione**
1. Stripe verificherà i documenti (1-3 giorni lavorativi)
2. Riceverai una notifica email
3. Lo stato account si aggiornerà automaticamente

### 3.2 Verifica Identità Italiana

Per account italiani, Stripe richiede:

**Documenti Personali:**
- Carta d'identità o passaporto valido
- Selfie per verifica biometrica

**Dati Bancari:**
- IBAN italiano (IT + 25 caratteri)
- Intestatario conto corrispondente ai dati account

**Dati Fiscali:**
- Codice Fiscale o Partita IVA
- Indirizzo di fatturazione italiano

```
Formato IBAN Italiano:
IT + 2 cifre controllo + 1 lettera CIN + 5 cifre ABI + 5 cifre CAB + 12 caratteri conto
Esempio: IT60X0542811101000000123456
```

### 3.3 Stati dell'Account Stripe Connect

| Stato | Descrizione | Azioni Possibili |
|-------|-------------|------------------|
| **Non collegato** | Nessun account Stripe associato | Solo "Collega Stripe" |
| **Pending** | Onboarding iniziato ma non completato | Completare onboarding |
| **Restricted** | Documenti mancanti o in verifica | Fornire documenti richiesti |
| **Active** | Account completamente operativo | Ricevere pagamenti |

**Indicatori visuali:**
- 🔴 Non collegato → Pulsante "Collega Stripe Connect"
- 🟡 Pending/Restricted → Badge giallo con messaggio
- 🟢 Active → Badge verde "Stripe Attivo"

### 3.4 Collegamento dal Tab Licenze

Nel tab Licenze trovi:

```
┌─────────────────────────────────────────────────────────────┐
│ 💳 Stripe Connect                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stato: 🟢 Attivo                                          │
│  Account ID: acct_1234567890                               │
│  Email: consulente@email.com                               │
│                                                             │
│  [Vai a Dashboard Stripe]  [Scollega Account]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Pricing Page Pubblica

Ogni consulente ha una **pricing page pubblica** personalizzabile, accessibile dai potenziali clienti.

### 4.1 URL della Pricing Page

```
https://[dominio-piattaforma]/c/{slug}/pricing
```

Dove `{slug}` è l'identificativo univoco del consulente (es. `mario-rossi`, `studio-consulting`).

**Esempi:**
- `/c/mario-rossi/pricing`
- `/c/wellness-coach/pricing`
- `/c/business-mentor/pricing`

### 4.2 I 4 Tab di Configurazione

La pricing page si configura tramite 4 tab nel pannello consulente:

#### Tab 1: Generale

Impostazioni base della pagina:

| Campo | Descrizione |
|-------|-------------|
| Titolo pagina | Headline principale (es. "Scegli il tuo piano") |
| Sottotitolo | Descrizione breve dell'offerta |
| CTA principale | Testo del pulsante di acquisto |
| Pagina attiva | Toggle per pubblicare/nascondere |

#### Tab 2: Piani

Configurazione prezzi e feature dei tier:

```javascript
// Esempio configurazione piani
{
  "bronze": {
    "enabled": true,
    "price": 0,
    "features": ["15 messaggi AI/giorno", "1 agente AI", "Trial gratuito"]
  },
  "silver": {
    "enabled": true,
    "price": 39,
    "features": ["Messaggi illimitati", "Tutti gli agenti", "Supporto prioritario"]
  },
  "gold": {
    "enabled": true,
    "price": 79,
    "features": ["Tutto Silver", "Analytics avanzate", "Early access"]
  }
}
```

#### Tab 3: Contenuto

Personalizzazione testi e messaggi:

- **Sezione Hero**: Titolo, sottotitolo, immagine background
- **Sezione Piani**: Descrizioni personalizzate per ogni tier
- **Sezione FAQ**: Domande frequenti personalizzabili
- **Footer**: Informazioni legali e contatti

#### Tab 4: Stile

Personalizzazione grafica:

| Elemento | Opzioni |
|----------|---------|
| Colore primario | Picker colore HEX |
| Colore secondario | Picker colore HEX |
| Font titoli | Google Fonts selector |
| Font corpo | Google Fonts selector |
| Logo | Upload immagine |
| Background | Colore/Gradiente/Immagine |

### 4.3 Preview in Tempo Reale

Durante la configurazione, una preview live mostra le modifiche:

```
┌─────────────────────────────────────────────────────────────┐
│ CONFIGURAZIONE          │          PREVIEW                 │
├─────────────────────────┼───────────────────────────────────┤
│                         │                                   │
│ [Tab: Generale]         │  ┌─────────────────────────────┐ │
│ [Tab: Piani]            │  │     Pricing Preview         │ │
│ [Tab: Contenuto]        │  │                             │ │
│ [Tab: Stile]            │  │  Scegli il tuo piano        │ │
│                         │  │                             │ │
│ Titolo: _________       │  │  [Bronze] [Silver] [Gold]   │ │
│ Sottotitolo: ____       │  │                             │ │
│                         │  │  [Inizia Gratis]            │ │
│ [Salva] [Anteprima]     │  └─────────────────────────────┘ │
│                         │                                   │
└─────────────────────────┴───────────────────────────────────┘
```

### 4.4 Lead Capture Form

La pricing page include un form per catturare lead Bronze:

**Campi del form:**
- Nome completo (obbligatorio)
- Numero telefono (obbligatorio, con validazione)
- Email (opzionale)
- Consenso privacy (obbligatorio)

**Flusso post-registrazione:**
1. Utente compila il form Bronze
2. Sistema crea account con tier Bronze
3. Redirect a pagina di conferma
4. Invio messaggio WhatsApp di benvenuto

---

## 5. Gestione Licenze e Preferenze

### 5.1 Tab Licenze in "I tuoi dipendenti"

Il tab Licenze è il centro di controllo per la monetizzazione:

```
┌─────────────────────────────────────────────────────────────────┐
│ I TUOI DIPENDENTI                                               │
├─────────┬─────────┬──────────┬─────────────────────────────────┤
│ Elenco  │ Licenze │ Analytics│                                 │
└─────────┴────┬────┴──────────┘                                 │
               │                                                  │
               ▼                                                  │
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  📊 Riepilogo Tier                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ Bronze   │ │ Silver   │ │ Gold     │                        │
│  │   127    │ │    45    │ │    12    │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│                                                                 │
│  💳 Stripe Connect: 🟢 Attivo                                  │
│  📈 Revenue questo mese: €2,340                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  🎨 Preferenze Default Onboarding                              │
│  [Configura Preferenze]                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  👥 Lista Utenti per Tier                                      │
│  [Ricerca: ___________] [Filtro Tier: Tutti ▼]                 │
│                                                                 │
│  │ Nome           │ Tier   │ Data Iscrizione │ Azioni │        │
│  │ Mario Rossi    │ Silver │ 15/01/2026      │ [···]  │        │
│  │ Anna Bianchi   │ Bronze │ 14/01/2026      │ [···]  │        │
│  │ ...            │ ...    │ ...             │ ...    │        │
│                                                                 │
│  [← Prev] Pagina 1 di 12 [Next →]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Preferenze Default Onboarding

Le preferenze default si applicano automaticamente ai nuovi utenti Silver/Gold:

#### Stile di Scrittura

| Opzione | Descrizione |
|---------|-------------|
| Formale | Linguaggio professionale, uso del "Lei" |
| Informale | Linguaggio amichevole, uso del "tu" |
| Tecnico | Terminologia specialistica, dettagli precisi |
| Semplice | Linguaggio accessibile, spiegazioni chiare |

#### Lunghezza Risposte

| Opzione | Caratteristiche |
|---------|-----------------|
| Breve | 1-2 frasi, risposte concise |
| Media | 3-4 frasi, bilanciato |
| Dettagliata | 5+ frasi, approfondita |

#### Istruzioni Custom

Campo di testo libero per istruzioni specifiche:

```
Esempio istruzioni custom:
"Ricorda sempre di salutare il cliente per nome.
Proponi sempre un appuntamento alla fine della conversazione.
Usa emoji moderate per rendere il tono più friendly."
```

### 5.3 Pulsante "Applica a Tutti i Clienti"

Questa funzione propaga le preferenze default a tutti i clienti esistenti:

**Comportamento:**
1. Mostra dialog di conferma con conteggio clienti
2. Chiede se sovrascrivere preferenze personalizzate
3. Applica in batch a tutti i clienti selezionati
4. Mostra toast di conferma con risultato

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Conferma Applicazione                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Stai per applicare le preferenze default a:                 │
│                                                             │
│   • 45 utenti Silver                                        │
│   • 12 utenti Gold                                          │
│   ───────────────                                           │
│   = 57 utenti totali                                        │
│                                                             │
│ ☐ Sovrascrivi anche preferenze personalizzate               │
│                                                             │
│          [Annulla]        [Applica a Tutti]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Lista Utenti per Tier

La lista utenti offre:

**Funzionalità di ricerca:**
- Ricerca per nome, email o telefono
- Filtro per tier (Bronze, Silver, Gold)
- Ordinamento per data iscrizione, nome, tier

**Azioni per utente:**
- 👁️ Visualizza dettagli
- ✏️ Modifica tier manualmente
- 🔄 Reset password
- 🗑️ Disattiva account

**Paginazione:**
- 20 utenti per pagina (configurabile)
- Navigazione numerata
- Vai a pagina specifica

---

## 6. Flusso Upgrade Utenti

### 6.1 Da Bronze a Silver

Il flusso di upgrade è progettato per essere fluido e senza frizioni:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUSSO UPGRADE BRONZE → SILVER               │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────┐     ┌──────────────┐     ┌─────────────────┐
     │  Bronze  │────▶│ Click        │────▶│ Stripe Checkout │
     │  User    │     │ "Upgrade"    │     │    Session      │
     └──────────┘     └──────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
     │ Onboarding   │◀────│  Webhook     │◀────│ Pagamento │
     │   Wizard     │     │  Success     │     │ Completato│
     └──────┬───────┘     └──────────────┘     └───────────┘
            │
            ▼
     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
     │ JWT Token    │────▶│   Dialog     │────▶│ Messaggio │
     │  Refresh     │     │ Celebrativo  │     │ Benvenuto │
     └──────────────┘     └──────────────┘     └───────────┘
```

**Step 1: Trigger Upgrade**
- Pulsante "Upgrade" nella UI
- Banner limite messaggi raggiunto
- Link diretto dalla pricing page

**Step 2: Stripe Checkout**
```javascript
// Creazione sessione checkout
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  payment_method_types: ['card'],
  line_items: [{
    price: 'price_silver_monthly',
    quantity: 1
  }],
  success_url: '/pricing-success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: '/pricing'
});
```

**Step 3: Webhook Processing**
Il server riceve il webhook `checkout.session.completed` e:
1. Aggiorna il tier utente a Silver
2. Attiva le funzionalità premium
3. Triggera l'onboarding wizard

### 6.2 Token JWT Refresh Automatico

Dopo l'upgrade, il sistema refresha automaticamente il token JWT:

```javascript
// Flusso refresh token post-upgrade
1. Webhook aggiorna tier nel DB
2. Server invalida vecchio token
3. Client riceve evento "tier_upgraded"
4. Client richiede nuovo token via /api/auth/refresh
5. Nuovo token contiene tier aggiornato
6. UI si aggiorna senza logout
```

**Vantaggi:**
- L'utente non deve rifare login
- Le funzionalità premium sono immediate
- Esperienza seamless

### 6.3 Dialog Celebrativo Post-Upgrade

Dopo il pagamento, l'utente vede un dialog celebrativo:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🎉 Congratulazioni! 🎉                    │
│                                                             │
│              Benvenuto nel piano Silver!                    │
│                                                             │
│     Ora hai accesso a:                                      │
│     ✅ Messaggi AI illimitati                               │
│     ✅ Tutti gli agenti AI                                  │
│     ✅ Supporto prioritario                                 │
│                                                             │
│     Prima di iniziare, personalizziamo la tua               │
│     esperienza AI con alcune semplici preferenze.           │
│                                                             │
│                 [Personalizza Ora →]                        │
│                                                             │
│        oppure [Inizia Subito] (configurerò dopo)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Messaggio Benvenuto AI Personalizzato

Dopo l'onboarding, l'agente AI invia un messaggio di benvenuto:

```
📱 WhatsApp - Agente AI

🎉 Benvenuto nel piano Silver, [Nome]!

Grazie per aver scelto di fare upgrade. Ora puoi:

• Scrivermi quando vuoi, senza limiti
• Accedere a tutti gli agenti disponibili  
• Ricevere risposte personalizzate per te

Ho già configurato le tue preferenze:
📝 Stile: [informale/formale]
📏 Risposte: [brevi/medie/dettagliate]

Come posso aiutarti oggi?
```

---

## 7. Revenue Sharing

### 7.1 Percentuale Piattaforma Configurabile

Il sistema supporta revenue sharing flessibile:

| Parametro | Valore Default | Range |
|-----------|---------------|-------|
| Fee piattaforma | 20% | 10-30% |
| Fee Stripe | ~2.9% + €0.25 | Variabile |
| Revenue consulente | ~77% | 70-88% |

**Esempio calcolo:**
```
Abbonamento Silver: €39/mese

Stripe fee:        -€1.38 (2.9% + €0.25)
                   ───────
Netto Stripe:      €37.62

Fee piattaforma:   -€7.52 (20% di €37.62)
                   ───────
Revenue consulente: €30.10
```

### 7.2 Destination Charges Model di Stripe

La piattaforma utilizza il modello **Destination Charges**:

```javascript
// Esempio creazione pagamento con destination charges
const paymentIntent = await stripe.paymentIntents.create({
  amount: 3900, // €39.00 in centesimi
  currency: 'eur',
  payment_method_types: ['card'],
  transfer_data: {
    destination: 'acct_consulente123', // Account Connect del consulente
  },
  application_fee_amount: 780, // €7.80 fee piattaforma (20%)
});
```

**Vantaggi del modello Destination:**
- Pagamento va direttamente al consulente
- Fee piattaforma trattenuta automaticamente
- Singola transazione per il cliente
- Gestione dispute centralizzata

### 7.3 Fatturazione Mensile Automatica

Stripe gestisce automaticamente le subscription:

```
┌─────────────────────────────────────────────────────────────┐
│                 CICLO FATTURAZIONE MENSILE                  │
└─────────────────────────────────────────────────────────────┘

Giorno 1: Creazione subscription
     │
     ▼ (30 giorni)
Giorno 30: Tentativo addebito automatico
     │
     ├─── ✅ Successo → Rinnovo confermato
     │
     └─── ❌ Fallimento → Retry automatici
              │
              ├─── Retry 1: dopo 3 giorni
              ├─── Retry 2: dopo 5 giorni
              └─── Retry 3: dopo 7 giorni → Sospensione
```

**Gestione pagamenti falliti:**
1. Email automatica all'utente
2. Periodo di grazia (7 giorni default)
3. Downgrade automatico a Bronze dopo periodo grazia

### 7.4 Report Guadagni nel Pannello

Il pannello consulente include un dashboard revenue:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 REPORT GUADAGNI                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Questo Mese              │    Questo Anno                 │
│  ┌────────────────────┐   │   ┌────────────────────┐      │
│  │     €2,340.00      │   │   │    €18,920.00      │      │
│  │  ▲ +12% vs mese    │   │   │   ▲ +45% vs anno   │      │
│  │    precedente      │   │   │     precedente     │      │
│  └────────────────────┘   │   └────────────────────┘      │
│                           │                                │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  📈 Trend Mensile                                          │
│  [Grafico a barre ultimi 12 mesi]                          │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  💳 Ultime Transazioni                                     │
│  │ Data       │ Cliente      │ Tipo    │ Importo │        │
│  │ 15/01/2026 │ Mario Rossi  │ Silver  │ €30.10  │        │
│  │ 14/01/2026 │ Anna Bianchi │ Gold    │ €63.20  │        │
│  │ ...        │ ...          │ ...     │ ...     │        │
│                                                             │
│  [Esporta CSV]  [Vai a Stripe Dashboard]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. FAQ e Troubleshooting

### 8.1 Come Resettare la Password di un Utente?

**Metodo 1: Self-service (utente)**
1. L'utente clicca "Password dimenticata" nel login
2. Inserisce email o telefono
3. Riceve link reset via email/SMS
4. Imposta nuova password

**Metodo 2: Manuale (consulente)**
1. Vai a "I tuoi dipendenti" → Tab Licenze
2. Cerca l'utente nella lista
3. Clicca azioni (⋯) → "Reset Password"
4. Sistema invia email con link reset
5. Conferma all'utente che riceverà istruzioni

```
⚠️ Nota: Il consulente NON può vedere o impostare 
direttamente la password per motivi di sicurezza.
```

### 8.2 Cosa Succede se Stripe è Sospeso?

**Scenari di sospensione:**

| Motivo | Effetto | Soluzione |
|--------|---------|-----------|
| Documenti mancanti | Pagamenti bloccati | Fornire documenti richiesti |
| Attività sospetta | Account frozen | Contattare supporto Stripe |
| Chargeback eccessivi | Limitazioni | Migliorare processo vendita |
| Inattività prolungata | Verifica richiesta | Completare ri-verifica |

**Comportamento sistema durante sospensione:**
- I nuovi upgrade vengono bloccati
- Gli abbonamenti esistenti continuano (se possibile)
- Il consulente vede un banner di warning
- Gli utenti vedono messaggio "Pagamento temporaneamente non disponibile"

**Risoluzione:**
1. Accedi alla Stripe Dashboard
2. Segui le istruzioni specifiche nel banner
3. Fornisci documentazione richiesta
4. Attendi verifica (1-5 giorni lavorativi)

### 8.3 Come Cambiare i Prezzi dei Piani?

**Procedura:**
1. Vai a "Impostazioni Pricing" nel pannello consulente
2. Seleziona il tab "Piani"
3. Modifica i prezzi desiderati
4. Clicca "Salva modifiche"

**Importante:**
```
⚠️ Le modifiche ai prezzi:
• Si applicano SOLO ai NUOVI abbonati
• Gli abbonati esistenti mantengono il prezzo originale
• Per applicare nuovi prezzi a esistenti, serve migrazione manuale
```

**Migrazione prezzi esistenti:**
1. Contatta supporto piattaforma
2. Richiedi migrazione prezzi
3. Gli utenti riceveranno notifica del cambio
4. Nuovo prezzo applicato al prossimo rinnovo

### 8.4 Come Gestire i Rimborsi?

**Tipologie rimborso:**

| Tipo | Quando | Come |
|------|--------|------|
| Rimborso completo | Entro 14 giorni, primo pagamento | Via Stripe Dashboard |
| Rimborso parziale | Calcolo prorata per giorni usati | Via Stripe Dashboard |
| Credito | Compensazione per disservizi | Manualmente nel pannello |

**Procedura rimborso via Stripe:**
1. Accedi a Stripe Dashboard
2. Trova la transazione in "Pagamenti"
3. Clicca "Rimborsa"
4. Scegli importo (totale/parziale)
5. Conferma rimborso

**Nota sul revenue sharing:**
```
In caso di rimborso:
• La fee piattaforma viene restituita proporzionalmente
• Le fee Stripe NON vengono restituite
• Il tier utente viene eventualmente downgraded
```

### 8.5 Troubleshooting Comune

**Problema: Utente non vede tier aggiornato dopo pagamento**

Causa probabile: Cache del token JWT

Soluzione:
1. Chiedere all'utente di fare logout/login
2. Oppure attendere refresh automatico (max 5 minuti)
3. Se persiste, verificare webhook Stripe nei log

---

**Problema: Stripe Connect mostra "Restricted"**

Causa: Documenti mancanti o scaduti

Soluzione:
1. Controllare email da Stripe
2. Accedere a Stripe Dashboard
3. Completare i requisiti mancanti
4. Attendere verifica

---

**Problema: Webhook Stripe non funziona**

Verifica:
1. URL webhook corretto in Stripe Dashboard
2. Segreto webhook configurato nel server
3. Endpoint raggiungibile pubblicamente
4. Log server per errori specifici

```bash
# Verifica logs webhook
grep "stripe webhook" /var/log/app.log
```

---

**Problema: Revenue non corrisponde ai calcoli**

Possibili cause:
- Fee Stripe variabile per tipo carta
- Conversione valuta (se applicabile)
- Dispute/chargeback in corso
- Ritardo payout (2-7 giorni lavorativi)

---

## Glossario

| Termine | Definizione |
|---------|-------------|
| **Tier** | Livello di abbonamento (Bronze, Silver, Gold) |
| **Slug** | Identificativo URL univoco del consulente |
| **Stripe Connect** | Servizio Stripe per marketplace e piattaforme |
| **Destination Charges** | Modello pagamento dove i fondi vanno al venditore |
| **Webhook** | Notifica HTTP automatica da Stripe al server |
| **JWT** | JSON Web Token per autenticazione utente |
| **Onboarding** | Processo di configurazione iniziale utente |
| **Revenue Share** | Divisione ricavi tra piattaforma e consulente |

---

**Autore:** Documentazione Sistema  
**Versione:** 1.0  
**Ultimo aggiornamento:** Gennaio 2026

---

*Per supporto tecnico sulla monetizzazione, contattare il team piattaforma.*
