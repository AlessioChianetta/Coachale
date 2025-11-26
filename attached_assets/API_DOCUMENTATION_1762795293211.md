# Documentazione API - Unified Leads CRM

## 🔑 Autenticazione

Tutti gli endpoint API richiedono autenticazione tramite API Key. Puoi generare le API keys dall'interfaccia amministrativa.

### Metodi di Autenticazione

Puoi autenticarti in due modi:

**1. Header X-API-Key (raccomandato)**
```bash
X-API-Key: crm_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**2. Authorization Bearer Token**
```bash
Authorization: Bearer crm_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Formato API Keys

Le API keys hanno il seguente formato:
- **Produzione**: `crm_live_` + 32 caratteri esadecimali (41 caratteri totali)
- **Test**: `crm_test_` + 32 caratteri esadecimali (41 caratteri totali)

Esempio: `crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4`

### Scopes (Permessi)

- `marketing_leads:read` - Lettura lead marketing
- `marketing_leads:write` - Scrittura lead marketing
- `leads:read` - Lettura lead CRM
- `leads:write` - Scrittura lead CRM

---

## 📋 Endpoint Unified Leads

L'API unificata `/external/leads` consente di accedere a lead CRM e marketing attraverso un singolo endpoint. Il parametro `type` determina quale tipologia di lead recuperare.

### Base URL
```
http://localhost:5000/api/external/leads
```

---

### 1. Lista Tutti i Lead (Unified)

Recupera lead da CRM e/o Marketing Leads in un formato unificato con supporto per filtri e paginazione.

**Endpoint**: `GET /api/external/leads`

**Autenticazione**: 
- API Key con scope `leads:read` (per CRM leads)
- API Key con scope `marketing_leads:read` (per marketing leads)
- Almeno uno dei due scopes è richiesto

**Parametri Query**:

| Parametro | Tipo | Default | Descrizione |
|-----------|------|---------|-------------|
| `type` | string | both | Tipo di lead: `'crm'`, `'marketing'`, o `'both'` (entrambi) |
| `limit` | number | 100 | Numero massimo di risultati (max: 1000) |
| `offset` | number | 0 | Offset per paginazione |
| `days` | number/string | all | Giorni da considerare (es: 7, 30, "all") |
| `source` | string | - | Filtra per sorgente specifica |
| `campaign` | string | - | Filtra per campagna specifica (solo marketing leads) |
| `status` | string | - | Filtra per status |
| `fields` | string | - | Campi da includere (separati da virgola) |

**Access Control**:
- Se `type=crm`: richiede scope `leads:read`
- Se `type=marketing`: richiede scope `marketing_leads:read`
- Se `type=both` o non specificato: restituisce i lead in base agli scopes disponibili
  - Solo `leads:read` → solo CRM leads
  - Solo `marketing_leads:read` → solo marketing leads
  - Entrambi gli scopes → tutti i lead

**Headers**:
```http
X-API-Key: crm_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Content-Type: application/json
```

**Esempi Richieste**:

```bash
# Tutti i lead (CRM + Marketing) se l'API key ha entrambi i permessi
curl -X GET "http://localhost:5000/api/external/leads?limit=10" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Solo CRM leads
curl -X GET "http://localhost:5000/api/external/leads?type=crm&limit=10" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Solo Marketing leads
curl -X GET "http://localhost:5000/api/external/leads?type=marketing&limit=10&days=7" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Marketing leads filtrati per campaign
curl -X GET "http://localhost:5000/api/external/leads?type=marketing&campaign=metodo-orbitale" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"
```

**Risposta Success (200)** - Formato Unificato:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-crm-lead-123",
      "type": "crm",
      "fullName": "Mario Rossi",
      "email": "mario.rossi@azienda.it",
      "phone": "+39 333 1234567",
      "source": "contact-form",
      "status": "new",
      "createdAt": "2025-11-07T10:30:00.000Z",
      "updatedAt": "2025-11-07T10:30:00.000Z",
      "details": {
        "company": "Azienda SRL",
        "message": "Vorrei informazioni sui vostri servizi",
        "notes": null
      }
    },
    {
      "id": "42",
      "type": "marketing",
      "fullName": "Laura Bianchi",
      "email": "laura.bianchi@example.com",
      "phone": "+39 345 6789012",
      "source": "landing-page-orbitale",
      "status": "new",
      "createdAt": "2025-11-07T09:15:00.000Z",
      "updatedAt": "2025-11-07T09:15:00.000Z",
      "details": {
        "campaign": "metodo-orbitale",
        "emailSent": false,
        "whatsappSent": false,
        "businessName": "Marketing Agency Ltd",
        "additionalData": {
          "company_size": "10-50",
          "industry": "Marketing"
        }
      }
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  },
  "filters": {
    "type": null,
    "days": null,
    "source": null,
    "campaign": null,
    "status": null
  },
  "meta": {
    "timestamp": "2025-11-07T10:35:00.000Z",
    "version": "1.0",
    "endpoint": "external/leads"
  }
}
```

**Formato Response - Struttura `details`**:

Il campo `details` varia in base al `type` del lead:

**CRM Lead (`type: "crm"`):**
```json
{
  "details": {
    "company": "Nome azienda o null",
    "message": "Messaggio del lead o null",
    "notes": "Note interne o null"
  }
}
```

**Marketing Lead (`type: "marketing"`):**
```json
{
  "details": {
    "campaign": "Nome campagna",
    "emailSent": true/false,
    "whatsappSent": true/false,
    "businessName": "Nome business o null",
    "additionalData": {
      "campo_custom_1": "valore",
      "campo_custom_2": "valore"
    }
  }
}
```

**Export CSV**:

Aggiungi l'header `Accept: text/csv` per esportare in formato CSV:

```bash
# Export tutti i lead
curl -X GET "http://localhost:5000/api/external/leads" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Accept: text/csv" \
  -o leads.csv

# Export solo CRM leads
curl -X GET "http://localhost:5000/api/external/leads?type=crm" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Accept: text/csv" \
  -o crm-leads.csv
```

**Errori**:

| Codice | Descrizione |
|--------|-------------|
| `400` | Parametro `type` invalido (deve essere 'crm', 'marketing', o 'both') |
| `401` | API key mancante, invalida o revocata |
| `403` | Scopes insufficienti per il tipo di lead richiesto |
| `500` | Errore interno del server |

---

### 2. Singolo Lead per ID (Unified)

Recupera i dettagli di un singolo lead (CRM o Marketing) in formato unificato.

**Endpoint**: `GET /api/external/leads/:id`

**Autenticazione**: 
- API Key con scope `leads:read` (per CRM leads)
- API Key con scope `marketing_leads:read` (per marketing leads)
- Almeno uno dei due scopes è richiesto

**Logica di Ricerca**:
1. Cerca prima nella tabella CRM leads (se hai scope `leads:read`)
2. Se non trovato, cerca nella tabella marketing leads (se hai scope `marketing_leads:read`)
3. Restituisce il lead nel formato unificato con campo `type`

**Parametri URL**:

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `id` | string | ID del lead (UUID per CRM, numerico per marketing) |

**Esempi Richieste**:

```bash
# Cerca lead CRM
curl -X GET "http://localhost:5000/api/external/leads/uuid-crm-lead-123" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Cerca marketing lead
curl -X GET "http://localhost:5000/api/external/leads/42" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"
```

**Risposta Success (200)** - CRM Lead:

```json
{
  "success": true,
  "data": {
    "id": "uuid-crm-lead-123",
    "type": "crm",
    "fullName": "Mario Rossi",
    "email": "mario.rossi@azienda.it",
    "phone": "+39 333 1234567",
    "source": "contact-form",
    "status": "contacted",
    "createdAt": "2025-11-07T10:30:00.000Z",
    "updatedAt": "2025-11-07T14:20:00.000Z",
    "details": {
      "company": "Azienda SRL",
      "message": "Vorrei informazioni sui vostri servizi",
      "notes": "Chiamato il 07/11, interessato a consulenza"
    }
  },
  "meta": {
    "timestamp": "2025-11-07T15:00:00.000Z",
    "version": "1.0",
    "endpoint": "external/leads/:id"
  }
}
```

**Risposta Success (200)** - Marketing Lead:

```json
{
  "success": true,
  "data": {
    "id": "42",
    "type": "marketing",
    "fullName": "Laura Bianchi",
    "email": "laura.bianchi@example.com",
    "phone": "+39 345 6789012",
    "source": "landing-page-orbitale",
    "status": "new",
    "createdAt": "2025-11-07T09:15:00.000Z",
    "updatedAt": "2025-11-07T09:15:00.000Z",
    "details": {
      "campaign": "metodo-orbitale",
      "emailSent": true,
      "whatsappSent": false,
      "businessName": "Marketing Agency Ltd",
      "additionalData": {
        "company_size": "10-50",
        "industry": "Marketing",
        "budget": "5000-10000"
      }
    }
  },
  "meta": {
    "timestamp": "2025-11-07T15:00:00.000Z",
    "version": "1.0",
    "endpoint": "external/leads/:id"
  }
}
```

**Errori**:

| Codice | Descrizione |
|--------|-------------|
| `401` | API key mancante, invalida o revocata |
| `403` | Lead trovato ma scopes insufficienti (es: CRM lead trovato ma manca `leads:read`) |
| `404` | Lead non trovato in nessuna tabella |
| `500` | Errore interno del server |

---

### 3. Statistiche Aggregate (Unified)

Recupera statistiche aggregate da CRM e/o Marketing Leads con breakdown per tipo, sorgente, campagna e status.

**Endpoint**: `GET /api/external/leads/stats`

**Autenticazione**: 
- API Key con scope `leads:read` (per stats CRM)
- API Key con scope `marketing_leads:read` (per stats marketing)
- Almeno uno dei due scopes è richiesto

**Parametri Query**:

| Parametro | Tipo | Default | Descrizione |
|-----------|------|---------|-------------|
| `type` | string | both | Tipo di stats: `'crm'`, `'marketing'`, o `'both'` |
| `days` | number/string | all | Giorni da considerare (es: 7, 30, "all") |
| `source` | string | - | Filtra per sorgente specifica |
| `campaign` | string | - | Filtra per campagna specifica (solo marketing) |
| `status` | string | - | Filtra per status |

**Access Control**:
- Se `type=crm`: richiede scope `leads:read`
- Se `type=marketing`: richiede scope `marketing_leads:read`
- Se `type=both` o non specificato: calcola stats in base agli scopes disponibili

**Esempi Richieste**:

```bash
# Statistiche combinate (CRM + Marketing)
curl -X GET "http://localhost:5000/api/external/leads/stats" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Solo statistiche CRM ultimi 7 giorni
curl -X GET "http://localhost:5000/api/external/leads/stats?type=crm&days=7" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Solo statistiche Marketing ultimi 30 giorni per campagna
curl -X GET "http://localhost:5000/api/external/leads/stats?type=marketing&days=30&campaign=metodo-orbitale" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Tutte le statistiche filtrate per source
curl -X GET "http://localhost:5000/api/external/leads/stats?days=all&source=landing-page-orbitale" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"
```

**Risposta Success (200)**:

```json
{
  "success": true,
  "data": {
    "general": {
      "total_leads": 127,
      "total_crm_leads": 45,
      "total_marketing_leads": 82,
      "unique_sources": 5,
      "leads_last_24h": 12,
      "leads_last_7d": 38,
      "emails_sent": 65,
      "whatsapp_sent": 42
    },
    "breakdown": {
      "by_type": {
        "crm": 45,
        "marketing": 82
      },
      "by_source": [
        {
          "source": "landing-page-orbitale",
          "count": 58
        },
        {
          "source": "contact-form",
          "count": 35
        },
        {
          "source": "facebook-ads",
          "count": 24
        },
        {
          "source": "google-ads",
          "count": 10
        }
      ],
      "by_campaign": [
        {
          "campaign": "metodo-orbitale",
          "count": 52
        },
        {
          "campaign": "patrimonio-sicuro",
          "count": 30
        }
      ],
      "by_status": [
        {
          "status": "new",
          "count": 68
        },
        {
          "status": "contacted",
          "count": 35
        },
        {
          "status": "qualified",
          "count": 18
        },
        {
          "status": "lost",
          "count": 6
        }
      ]
    },
    "trends": {
      "daily": [
        {
          "date": "2025-11-01",
          "count": 8
        },
        {
          "date": "2025-11-02",
          "count": 12
        },
        {
          "date": "2025-11-03",
          "count": 15
        }
      ]
    }
  },
  "filters": {
    "type": null,
    "days": null,
    "source": null,
    "campaign": null,
    "status": null
  },
  "meta": {
    "timestamp": "2025-11-07T15:00:00.000Z",
    "version": "1.0",
    "endpoint": "external/leads/stats",
    "tenant": {
      "id": 1,
      "name": "My Company",
      "domain": "mycompany.example.com"
    }
  }
}
```

**Descrizione Campi**:

**General Stats:**
- `total_leads` - Totale lead nel periodo selezionato (CRM + Marketing)
- `total_crm_leads` - Totale lead CRM
- `total_marketing_leads` - Totale marketing leads
- `unique_sources` - Numero di sorgenti uniche
- `leads_last_24h` - Lead delle ultime 24 ore
- `leads_last_7d` - Lead degli ultimi 7 giorni
- `emails_sent` - Marketing leads a cui è stata inviata email (solo con scope `marketing_leads:read`)
- `whatsapp_sent` - Marketing leads a cui è stato inviato WhatsApp (solo con scope `marketing_leads:read`)

**Breakdown:**
- `by_type` - Conteggio per tipo (crm vs marketing)
- `by_source` - Breakdown per sorgente (combinato da entrambe le tabelle)
- `by_campaign` - Breakdown per campagna (solo marketing leads)
- `by_status` - Breakdown per status (combinato da entrambe le tabelle)

**Trends:**
- `daily` - Trend giornaliero degli ultimi 30 giorni

**Errori**:

| Codice | Descrizione |
|--------|-------------|
| `400` | Parametro `type` invalido |
| `401` | API key mancante, invalida o revocata |
| `403` | Scopes insufficienti per il tipo di stats richiesto |
| `500` | Errore nel calcolo delle statistiche |

---

## 🔄 Backward Compatibility & Deprecation

Gli endpoint legacy `/external/marketing-leads*` sono ancora disponibili ma **deprecati**.

**Endpoint Deprecati:**
- `GET /api/external/marketing-leads`
- `GET /api/external/marketing-leads/:id`
- `GET /api/external/marketing-leads/stats`

**Migrazione Raccomandata:**

Usa i nuovi endpoint unificati `/external/leads` con parametro `type=marketing` per accedere ai marketing leads:

```bash
# VECCHIO (deprecato)
GET /api/external/marketing-leads?limit=10

# NUOVO (raccomandato)
GET /api/external/leads?type=marketing&limit=10
```

**Timeline di Deprecazione:**

Gli endpoint legacy continueranno a funzionare per garantire compatibilità, ma saranno rimossi in una versione futura. Si consiglia di migrare ai nuovi endpoint il prima possibile.

**Vantaggi della Migrazione:**
- ✅ Accesso unificato a CRM e marketing leads
- ✅ Formato dati standardizzato
- ✅ Maggiore flessibilità nei filtri
- ✅ Statistiche combinate
- ✅ Supporto futuro garantito

---

## 🔒 Sicurezza

### Multi-Tenancy

Tutti gli endpoint isolano automaticamente i dati per tenant. Ogni API key è associata a un tenant specifico e può accedere solo ai dati di quel tenant.

### Scope-Based Access Control

Il sistema utilizza scopes granulari per controllare l'accesso:
- **`leads:read`** - Permette lettura dei lead CRM
- **`marketing_leads:read`** - Permette lettura dei marketing leads
- **API Key con entrambi gli scopes** - Accesso completo a tutti i lead

Le richieste vengono automaticamente filtrate in base agli scopes della API key utilizzata.

### Rate Limiting

Le API hanno un rate limit configurabile per prevenire abusi. Per esigenze di rate limit personalizzate, contatta il supporto.

### Revoca API Keys

Le API keys possono essere revocate in qualsiasi momento dall'interfaccia amministrativa. Una volta revocata, la chiave non può più essere utilizzata.

### Last Used Tracking

Ogni volta che usi un'API key, il sistema aggiorna automaticamente il timestamp `lastUsedAt` per monitorare l'utilizzo.

---

## 📝 Esempi Pratici

### JavaScript/Node.js

```javascript
const API_KEY = 'crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4';
const BASE_URL = 'http://localhost:5000/api/external/leads';

// Fetch tutti i lead (CRM + Marketing)
async function getAllLeads(limit = 10, offset = 0) {
  const response = await fetch(`${BASE_URL}?limit=${limit}&offset=${offset}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Fetch solo CRM leads
async function getCrmLeads(limit = 10) {
  const response = await fetch(`${BASE_URL}?type=crm&limit=${limit}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Fetch solo Marketing leads
async function getMarketingLeads(campaign = null, limit = 10) {
  let url = `${BASE_URL}?type=marketing&limit=${limit}`;
  if (campaign) {
    url += `&campaign=${encodeURIComponent(campaign)}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Fetch singolo lead (automaticamente cerca in entrambe le tabelle)
async function getLeadById(id) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Fetch statistiche unificate
async function getUnifiedStats(type = null, days = 30) {
  let url = `${BASE_URL}/stats?days=${days}`;
  if (type) {
    url += `&type=${type}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Usage examples
async function main() {
  try {
    // Tutti i lead
    const allLeads = await getAllLeads(20);
    console.log('All Leads:', allLeads);
    
    // Solo CRM
    const crmLeads = await getCrmLeads(10);
    console.log('CRM Leads:', crmLeads);
    
    // Solo Marketing per campagna specifica
    const marketingLeads = await getMarketingLeads('metodo-orbitale', 10);
    console.log('Marketing Leads:', marketingLeads);
    
    // Singolo lead
    const lead = await getLeadById('uuid-or-numeric-id');
    console.log('Single Lead:', lead);
    console.log('Lead Type:', lead.data.type); // 'crm' o 'marketing'
    
    // Stats unificate
    const stats = await getUnifiedStats(null, 7);
    console.log('Unified Stats (7 days):', stats);
    console.log('CRM Leads:', stats.data.general.total_crm_leads);
    console.log('Marketing Leads:', stats.data.general.total_marketing_leads);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### Python

```python
import requests
from typing import Optional, Dict, Any

API_KEY = 'crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4'
BASE_URL = 'http://localhost:5000/api/external/leads'

# Headers con autenticazione
headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Fetch tutti i lead (CRM + Marketing)
def get_all_leads(limit: int = 10, offset: int = 0) -> Dict[str, Any]:
    params = {'limit': limit, 'offset': offset}
    response = requests.get(BASE_URL, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

# Fetch solo CRM leads
def get_crm_leads(limit: int = 10, days: Optional[int] = None) -> Dict[str, Any]:
    params = {'type': 'crm', 'limit': limit}
    if days:
        params['days'] = days
    
    response = requests.get(BASE_URL, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

# Fetch solo Marketing leads
def get_marketing_leads(
    limit: int = 10,
    campaign: Optional[str] = None,
    source: Optional[str] = None
) -> Dict[str, Any]:
    params = {'type': 'marketing', 'limit': limit}
    if campaign:
        params['campaign'] = campaign
    if source:
        params['source'] = source
    
    response = requests.get(BASE_URL, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

# Fetch singolo lead per ID
def get_lead_by_id(lead_id: str) -> Dict[str, Any]:
    response = requests.get(f'{BASE_URL}/{lead_id}', headers=headers)
    response.raise_for_status()
    return response.json()

# Fetch statistiche unificate
def get_unified_stats(
    type: Optional[str] = None,
    days: int = 30,
    source: Optional[str] = None,
    campaign: Optional[str] = None
) -> Dict[str, Any]:
    params = {'days': days}
    if type:
        params['type'] = type
    if source:
        params['source'] = source
    if campaign:
        params['campaign'] = campaign
    
    response = requests.get(f'{BASE_URL}/stats', headers=headers, params=params)
    response.raise_for_status()
    return response.json()

# Export leads to CSV
def export_leads_to_csv(
    filename: str = 'leads.csv',
    type: Optional[str] = None
) -> None:
    params = {}
    if type:
        params['type'] = type
    
    csv_headers = headers.copy()
    csv_headers['Accept'] = 'text/csv'
    
    response = requests.get(BASE_URL, headers=csv_headers, params=params)
    response.raise_for_status()
    
    with open(filename, 'wb') as f:
        f.write(response.content)
    
    print(f'Leads exported to {filename}')

# Usage examples
if __name__ == '__main__':
    try:
        # Tutti i lead
        all_leads = get_all_leads(limit=20)
        print(f"Total leads: {all_leads['pagination']['total']}")
        
        # Solo CRM leads ultimi 7 giorni
        crm_leads = get_crm_leads(limit=10, days=7)
        print(f"CRM leads (7 days): {len(crm_leads['data'])}")
        
        # Solo Marketing leads per campagna specifica
        marketing_leads = get_marketing_leads(
            limit=10,
            campaign='metodo-orbitale'
        )
        print(f"Marketing leads for campaign: {len(marketing_leads['data'])}")
        
        # Singolo lead
        lead = get_lead_by_id('some-id')
        print(f"Lead: {lead['data']['fullName']} (Type: {lead['data']['type']})")
        
        # Controlla il tipo e accedi ai details appropriati
        if lead['data']['type'] == 'crm':
            print(f"Company: {lead['data']['details']['company']}")
        elif lead['data']['type'] == 'marketing':
            print(f"Campaign: {lead['data']['details']['campaign']}")
            print(f"Email sent: {lead['data']['details']['emailSent']}")
        
        # Statistiche unificate
        stats = get_unified_stats(days=7)
        print(f"Stats last 7 days:")
        print(f"  Total: {stats['data']['general']['total_leads']}")
        print(f"  CRM: {stats['data']['general']['total_crm_leads']}")
        print(f"  Marketing: {stats['data']['general']['total_marketing_leads']}")
        
        # Statistiche solo CRM
        crm_stats = get_unified_stats(type='crm', days=30)
        print(f"CRM stats (30 days): {crm_stats['data']['general']['total_leads']}")
        
        # Export CSV
        export_leads_to_csv('all_leads.csv')
        export_leads_to_csv('crm_leads.csv', type='crm')
        export_leads_to_csv('marketing_leads.csv', type='marketing')
        
    except requests.exceptions.HTTPError as e:
        print(f'HTTP Error: {e}')
        print(f'Response: {e.response.text}')
    except Exception as e:
        print(f'Error: {e}')
```

### cURL

```bash
# ===== LISTA LEAD =====

# Tutti i lead (CRM + Marketing)
curl -X GET "http://localhost:5000/api/external/leads?limit=20" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Content-Type: application/json"

# Solo CRM leads
curl -X GET "http://localhost:5000/api/external/leads?type=crm&limit=10" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Solo Marketing leads
curl -X GET "http://localhost:5000/api/external/leads?type=marketing&limit=10" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Marketing leads ultimi 7 giorni per campagna
curl -X GET "http://localhost:5000/api/external/leads?type=marketing&days=7&campaign=metodo-orbitale" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# CRM leads filtrati per source e status
curl -X GET "http://localhost:5000/api/external/leads?type=crm&source=contact-form&status=new" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# ===== SINGOLO LEAD =====

# Lead per ID (cerca automaticamente in entrambe le tabelle)
curl -X GET "http://localhost:5000/api/external/leads/uuid-or-numeric-id" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# ===== STATISTICHE =====

# Statistiche unificate (CRM + Marketing)
curl -X GET "http://localhost:5000/api/external/leads/stats" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Statistiche solo CRM ultimi 7 giorni
curl -X GET "http://localhost:5000/api/external/leads/stats?type=crm&days=7" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Statistiche solo Marketing ultimi 30 giorni
curl -X GET "http://localhost:5000/api/external/leads/stats?type=marketing&days=30" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Statistiche per campagna specifica
curl -X GET "http://localhost:5000/api/external/leads/stats?type=marketing&campaign=metodo-orbitale&days=all" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# Statistiche per source specifica (combinate)
curl -X GET "http://localhost:5000/api/external/leads/stats?source=landing-page-orbitale" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4"

# ===== EXPORT CSV =====

# Export tutti i lead
curl -X GET "http://localhost:5000/api/external/leads" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Accept: text/csv" \
  -o all_leads.csv

# Export solo CRM leads
curl -X GET "http://localhost:5000/api/external/leads?type=crm" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Accept: text/csv" \
  -o crm_leads.csv

# Export solo Marketing leads
curl -X GET "http://localhost:5000/api/external/leads?type=marketing" \
  -H "X-API-Key: crm_live_a3f7e9d2c1b8f4e6a9d3c7b2e5f8a1d4" \
  -H "Accept: text/csv" \n  -o marketing_leads.csv
```

---

## ⚡ Best Practices

1. **Conserva la tua API Key al sicuro** - Non condividerla pubblicamente o commitarla nel codice
2. **Usa variabili d'ambiente** - Memorizza la chiave in variabili d'ambiente, non hardcodata
3. **Gestisci gli errori** - Implementa sempre gestione degli errori per le chiamate API
4. **Usa paginazione** - Per grandi dataset, usa `limit` e `offset` per paginare i risultati
5. **Filtra per tipo quando possibile** - Se hai bisogno solo di CRM o Marketing leads, usa il parametro `type` per ottimizzare le performance
6. **Cache quando possibile** - Le statistiche possono essere cachate per ridurre le chiamate
7. **Controlla il campo `type`** - Usa il campo `type` nella risposta per determinare la struttura di `details`
8. **Migra ai nuovi endpoint** - Se stai usando gli endpoint legacy, pianifica la migrazione agli endpoint unificati
9. **Monitora lastUsedAt** - Controlla regolarmente quando le tue chiavi sono state usate l'ultima volta
10. **Revoca chiavi inutilizzate** - Per sicurezza, revoca le chiavi che non usi più

---

## 📞 Supporto

Per domande o problemi con l'API, contatta il team di supporto.

**Versione API**: 1.0  
**Ultima Modifica**: 7 Novembre 2025
