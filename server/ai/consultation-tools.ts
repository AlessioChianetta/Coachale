/**
 * Consultation Tools for Gemini Function Calling
 * These tools allow the AI to manage client consultations:
 * - Get real-time consultation status and limits
 * - Check available appointment slots
 * - Propose and confirm bookings
 */

export interface ConsultationToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      format?: string;
    }>;
    required: string[];
  };
}

export const consultationTools: ConsultationToolDeclaration[] = [
  {
    name: "getConsultationStatus",
    description: `OBBLIGATORIO: Usa questo tool per rispondere a QUALSIASI domanda sulle consulenze del cliente.
Questo include:
- "Quante consulenze ho fatto questo mese?"
- "Quante ne ho ancora disponibili?"
- "Ho raggiunto il limite?"
- "Quante consulenze ho prenotato?"
NON rispondere MAI a queste domande senza chiamare prima questo tool.
Il tool restituisce i dati UFFICIALI e AGGIORNATI in tempo reale dal database.`,
    parameters: {
      type: "object",
      properties: {
        month: {
          type: "number",
          description: "Mese (1-12). Se non specificato, usa il mese corrente."
        },
        year: {
          type: "number",
          description: "Anno (es. 2026). Se non specificato, usa l'anno corrente."
        }
      },
      required: []
    }
  },
  {
    name: "getAvailableSlots",
    description: `Ottiene gli slot disponibili per prenotare una nuova consulenza.
Usa questo tool quando il cliente chiede:
- "Quando posso prenotare la prossima consulenza?"
- "Che slot hai disponibili?"
- "Posso prenotare per giovedì?"
Restituisce una lista di date e orari disponibili.`,
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Data di inizio ricerca (formato YYYY-MM-DD). Default: oggi.",
          format: "date"
        },
        endDate: {
          type: "string",
          description: "Data di fine ricerca (formato YYYY-MM-DD). Default: 30 giorni da oggi.",
          format: "date"
        },
        preferredDayOfWeek: {
          type: "string",
          description: "Giorno della settimana preferito (opzionale)",
          enum: ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
        },
        preferredTimeRange: {
          type: "string",
          description: "Fascia oraria preferita (opzionale)",
          enum: ["mattina", "pomeriggio", "sera"]
        }
      },
      required: []
    }
  },
  {
    name: "proposeBooking",
    description: `Propone una prenotazione per una consulenza.
NON prenota direttamente - mostra un'anteprima al cliente che deve confermare.
Usa questo tool quando il cliente indica una preferenza:
- "Vorrei prenotare per giovedì alle 15"
- "Mi va bene il primo slot disponibile"

IMPORTANTE: La conferma avviene SOLO via chat. Il cliente deve rispondere con "confermo", "sì", "ok" o simili.
NON menzionare MAI pulsanti, bottoni o link di conferma - non esistono.
Chiedi semplicemente al cliente di confermare rispondendo in chat.`,
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Data della consulenza (formato YYYY-MM-DD)",
          format: "date"
        },
        time: {
          type: "string",
          description: "Ora della consulenza (formato HH:MM, es. '15:00')"
        },
        duration: {
          type: "number",
          description: "Durata in minuti (default: 60)"
        },
        notes: {
          type: "string",
          description: "Note aggiuntive per la consulenza (opzionale)"
        }
      },
      required: ["date", "time"]
    }
  },
  {
    name: "confirmBooking",
    description: `Conferma una prenotazione precedentemente proposta.
Usa questo tool SOLO dopo che il cliente ha esplicitamente confermato.
Frasi di conferma: "Sì, conferma", "Ok, prenota", "Va bene, procedi"
Richiede il token di conferma ottenuto da proposeBooking.`,
    parameters: {
      type: "object",
      properties: {
        confirmationToken: {
          type: "string",
          description: "Token di conferma ricevuto da proposeBooking"
        }
      },
      required: ["confirmationToken"]
    }
  }
];

export interface ConsultationToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ConsultationToolResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
}

export function getConsultationToolByName(name: string): ConsultationToolDeclaration | undefined {
  return consultationTools.find(t => t.name === name);
}

export function isConsultationTool(toolName: string): boolean {
  return consultationTools.some(t => t.name === toolName);
}
