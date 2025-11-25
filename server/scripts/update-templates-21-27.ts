// Migration script to update templates 21-27 with new dynamic prompts
// Run this to update existing templates in the database

import { storage } from "../storage";

const updatedTemplates = [
  {
    dayOfMonth: 21,
    title: "Sprint Finale Inizia",
    description: "Email per iniziare lo sprint finale - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email per iniziare lo sprint finale del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Il giorno 21 cade in momenti diversi a seconda della lunghezza del mese:
- In un mese di 28 giorni: siamo al giorno 21, mancano 7 giorni (ultima settimana!)
- In un mese di 30 giorni: siamo al giorno 21, mancano 9 giorni
- In un mese di 31 giorni: siamo al giorno 21, mancano 10 giorni

ADATTA IL MESSAGGIO: non dire "ultima settimana" se mancano più di 8 giorni.

STRUTTURA:
1. Annuncio: entramo nella fase finale del mese (specifica quanti giorni mancano)
2. Recap veloce di cosa è stato fatto finora (primi 20 giorni)
3. Identifica 3-5 priorità chiave per chiudere bene il mese:
   - Esercizi pending con scadenza fine mese
   - Obiettivi da completare
   - Roadmap items in corso
4. Piano d'azione per i giorni rimanenti
5. Motivazione finale: chiudi forte!

DATI DISPONIBILI: Tutti i dati, focus su pending items con scadenze

TONO: Energico, focalizzato, determinato

VERIFICA AZIONI PRECEDENTI: Verifica azioni importanti del mese ancora pending.`
  },
  {
    dayOfMonth: 22,
    title: "Check Tutto Pending",
    description: "Email completa con tutti gli items pending - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email completa con tutti gli items pending.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 22, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 6 giorni
- In un mese di 30 giorni: mancano 8 giorni
- In un mese di 31 giorni: mancano 9 giorni

ADATTA IL MESSAGGIO: specifica il numero corretto di giorni rimanenti.

STRUTTURA:
1. Intro: specifica quanti giorni mancano alla fine del mese
2. Lista completa e organizzata di tutto ciò che è pending:
   - Esercizi (ordinati per scadenza)
   - Consultation tasks
   - Obiettivi in corso
   - Roadmap items iniziati ma non completati
   - Lezioni università non finite
3. Per ognuno, indica priorità (alta/media/bassa)
4. Suggerisci piano per completare priorità alte nei giorni rimanenti
5. Incoraggia focus e determinazione

DATI DISPONIBILI: Tutti i dati pending

VERIFICA AZIONI PRECEDENTI: Lista di tutte le azioni suggerite nel mese non ancora completate.`
  },
  {
    dayOfMonth: 23,
    title: "Urgenza Finale",
    description: "Email urgente per items critici - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email urgente per items critici da completare.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 23, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 5 giorni
- In un mese di 30 giorni: mancano 7 giorni
- In un mese di 31 giorni: mancano 8 giorni

ADATTA IL MESSAGGIO: specifica il numero corretto di giorni rimanenti e adapta l'urgenza.

STRUTTURA:
1. Alert: specifica quanti giorni mancano alla fine del mese
2. Focus solo su items CRITICI:
   - Esercizi con scadenza entro fine mese
   - Tasks con alta priorità
   - Obiettivi con target date fine mese
3. Per ognuno, indica deadline esatta
4. Suggerisci ordine di completamento
5. Offri supporto urgente se serve
6. Motivazione: ce la puoi fare!

DATI DISPONIBILI: Esercizi e tasks con scadenze imminenti

TONO: Urgente ma supportivo, non ansioso (adatta l'intensità ai giorni rimanenti)

VERIFICA AZIONI PRECEDENTI: Focus su azioni critiche non completate.`
  },
  {
    dayOfMonth: 25,
    title: "Preparazione Prossimo Mese",
    description: "Email per iniziare a pensare agli obiettivi del prossimo mese - dinamica",
    emailType: "pianificazione",
    tone: "professionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email per preparare il prossimo mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 25, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 3 giorni (fase conclusiva!)
- In un mese di 30 giorni: mancano 5 giorni
- In un mese di 31 giorni: mancano 6 giorni

ADATTA IL MESSAGGIO: 
- Se mancano 3-4 giorni: focus su chiusura E pianificazione
- Se mancano 5+ giorni: più enfasi su completamento prima della pianificazione

STRUTTURA:
1. Intro: specifica quanti giorni mancano e bilancia chiusura/pianificazione
2. Invita a riflettere su:
   - Cosa ha funzionato bene questo mese
   - Cosa migliorare
   - Nuovi obiettivi per prossimo mese
3. Suggerisci di dedicare 15-20 minuti a pianificare
4. Anticipa che riceverà supporto per pianificazione
5. Focus: chiudi forte questo mese E preparati per il prossimo

DATI DISPONIBILI: Progressi del mese corrente, obiettivi

TONO: Riflessivo ma proattivo

VERIFICA AZIONI PRECEDENTI: Verifica se azioni del mese sono quasi tutte completate.`
  },
  {
    dayOfMonth: 27,
    title: "Verifica Obiettivi Raggiunti",
    description: "Email per verificare obiettivi raggiunti - si adatta alla lunghezza del mese",
    emailType: "obiettivi",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email per verificare obiettivi raggiunti.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 27, i giorni rimanenti variano:
- In un mese di 28 giorni: manca 1 giorno (ultimo giorno!)
- In un mese di 30 giorni: mancano 3 giorni
- In un mese di 31 giorni: mancano 4 giorni

ADATTA IL MESSAGGIO: specifica correttamente quanti giorni mancano e l'urgenza.

STRUTTURA:
1. Intro: specifica quanti giorni mancano e il momento di verifica obiettivi
2. Per ogni obiettivo attivo:
   - Target value vs current value
   - Progress % 
   - Se raggiunto: CELEBRA! 🎉
   - Se quasi raggiunto: incoraggia sprint finale (se ci sono giorni rimanenti)
   - Se lontano: analizza cosa è mancato (senza giudizio)
3. Celebra anche progressi parziali
4. Se mancano giorni: opportunità per ultimo push
5. Incoraggiamento finale

DATI DISPONIBILI: Obiettivi con target e current values

VERIFICA AZIONI PRECEDENTI: Verifica se azioni suggerite nel mese hanno contribuito a obiettivi.`
  }
];

async function updateTemplates21to27() {
  try {
    console.log("🔄 Starting update of templates 21-27...\n");

    for (const template of updatedTemplates) {
      try {
        const existing = await storage.getEmailJourneyTemplate(template.dayOfMonth);
        
        if (!existing) {
          console.log(`⚠️  Template for day ${template.dayOfMonth} not found - creating new one`);
          await storage.createEmailJourneyTemplate(template);
          console.log(`✅ Created template for day ${template.dayOfMonth}: "${template.title}"`);
        } else {
          await storage.updateEmailJourneyTemplate(existing.id, template);
          console.log(`✅ Updated template for day ${template.dayOfMonth}: "${template.title}"`);
          console.log(`   Previous: "${existing.title}"`);
          console.log(`   New: "${template.title}"`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to update template for day ${template.dayOfMonth}:`, error.message);
      }
    }

    console.log(`\n🎉 Update completed! Updated ${updatedTemplates.length} templates.`);
    
    // Verify
    console.log("\n📊 Verification:");
    for (const template of updatedTemplates) {
      const updated = await storage.getEmailJourneyTemplate(template.dayOfMonth);
      if (updated && updated.title === template.title) {
        console.log(`✓ Day ${template.dayOfMonth}: "${updated.title}" - OK`);
      } else {
        console.log(`✗ Day ${template.dayOfMonth}: Update verification failed`);
      }
    }
  } catch (error: any) {
    console.error("Error updating templates:", error);
    throw error;
  }
}

// Run the update
updateTemplates21to27()
  .then(() => {
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
