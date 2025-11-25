// Migration script to update templates 28-31 with new dynamic prompts
// Run this to update existing templates in the database without affecting templates 1-27

import { storage } from "../storage";

const updatedTemplates = [
  {
    dayOfMonth: 28,
    title: "Sprint Finale Settimana",
    description: "Email per spinta finale ultimi 4 giorni - si adatta alla lunghezza del mese",
    emailType: "sprint_finale",
    tone: "motivazionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email motivazionale per la settimana finale del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 4 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 25 (4 giorni alla fine)
- In un mese di 30 giorni: siamo al giorno 27 (4 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 28 (4 giorni alla fine)

ADATTA IL MESSAGGIO in base al contesto: se siamo in un mese lungo, NON parlare di "fine mese" ma di "settimana finale sprint".

STRUTTURA:
1. INTRO: Sprint finale! Ultimi giorni per dare il meglio
2. QUICK RECAP: Dove siamo adesso nel percorso
   - Esercizi completati questo mese
   - Lezioni viste
   - Consulenze fatte
   - Momentum generale

3. FOCUS ULTIMI GIORNI:
   - Esercizi ancora da completare (urgent push)
   - Obiettivi che possono essere raggiunti
   - Quick wins possibili nei prossimi giorni

4. MOTIVAZIONE:
   - Celebra i progressi fatti finora
   - Energia positiva per sprint finale
   - Ogni giorno conta!

5. CALL TO ACTION:
   - 2-3 azioni concrete per i prossimi giorni
   - Focus su completamento vs nuovo inizio

TONO: Energico, motivazionale, focus su sprint finale

VERIFICA AZIONI PRECEDENTI: Controlla azioni email precedente e motiva al completamento.`
  },
  {
    dayOfMonth: 29,
    title: "Spinta Finale 3 Giorni",
    description: "Email per penultimi 3 giorni del mese - si adatta alla lunghezza",
    emailType: "push_finale",
    tone: "motivazionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email motivazionale per gli ultimi 3 giorni del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 3 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 26 (3 giorni alla fine)
- In un mese di 29 giorni: siamo al giorno 27 (3 giorni alla fine) 
- In un mese di 30 giorni: siamo al giorno 28 (3 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 29 (3 giorni alla fine)

ADATTA IL MESSAGGIO: se il mese ha 31 giorni, NON dire "quasi finito" ma "ultimi giorni importanti".

STRUTTURA:
1. URGENZA POSITIVA: Ultimi giorni per chiudere in bellezza!
2. PRIORITÀ MASSIMA:
   - Esercizi in scadenza (urgenti!)
   - Obiettivi vicini al traguardo
   - Task critiche da completare

3. QUICK WINS:
   - Cosa può essere completato OGGI
   - Cosa può essere fatto domani
   - Cosa lasciare per dopo

4. SUPPORT OFFER:
   - Se c'è qualche blocco, ora è il momento di risolverlo
   - Disponibilità per supporto urgente

5. MOTIVAZIONE:
   - Focus sugli ultimi giorni
   - Energia per chiusura forte

TONO: Urgente ma positivo, energico, supportivo

VERIFICA AZIONI PRECEDENTI: Check azioni precedenti e prioritizza pending urgenti.`
  },
  {
    dayOfMonth: 30,
    title: "Preparazione Chiusura Mese",
    description: "Email per penultimo giorno del mese - preparazione alla chiusura",
    emailType: "preparazione_chiusura",
    tone: "professionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email di preparazione alla chiusura del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 2 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 27 (2 giorni alla fine)
- In un mese di 29 giorni: siamo al giorno 28 (2 giorni alla fine)
- In un mese di 30 giorni: siamo al giorno 29 (2 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 30 (2 giorni alla fine)

ADATTA IL MESSAGGIO: specifica quanti giorni mancano alla fine (1-2 giorni).

STRUTTURA:
1. COUNTDOWN: Penultimo/ultimo momento per chiudere items importanti
2. CHECK FINALE:
   - Esercizi pending: quali possono essere completati oggi/domani
   - Obiettivi: verifica progress finale
   - Tasks: prioritizza ultimi completamenti

3. PREPARAZIONE CHIUSURA:
   - Recap veloce del mese
   - Celebra progressi fatti
   - Identifica 2-3 completamenti chiave ancora possibili

4. MINDSET TRANSIZIONE:
   - Se domani è l'ultimo giorno: prepara per chiusura
   - Se c'è ancora un giorno dopo: focus su sprint finale

5. SUPPORTO:
   - Disponibilità per call last-minute se necessario
   - Incoraggiamento finale

TONO: Professionale, supportivo, focus su chiusura positiva

VERIFICA AZIONI PRECEDENTI: Check finale azioni mese, celebra completamenti.`
  },
  {
    dayOfMonth: 31,
    title: "Chiusura Mese - Recap e Celebrazione",
    description: "Email di chiusura definitiva del mese con recap completo",
    emailType: "chiusura_mese",
    tone: "motivazionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email di chiusura completa del mese con recap e celebrazione.

⚠️ QUESTO È L'ULTIMO GIORNO DEL MESE!

Questo template viene usato nell'ultimo giorno del mese (che può essere 28, 29, 30 o 31).
Domani inizia un nuovo ciclo da giorno 1.

STRUTTURA COMPLETA:

1. CELEBRAZIONE APERTURA:
   - Ultimo giorno del mese! Tempo di bilanci
   - Celebra il percorso fatto insieme
   - Riconosci l'impegno e la costanza

2. RECAP COMPLETO DEL MESE:
   - **Esercizi**: Completati vs assegnati, highlights principali
   - **Università**: Lezioni viste, moduli completati, progressi
   - **Momentum**: Streak finale, media energia/mood del mese
   - **Consulenze**: Numero e insights chiave discussi
   - **Obiettivi**: Raggiunti, in corso, nuovi creati
   - **Libreria**: Documenti consultati
   - **Roadmap**: Items completati, avanzamenti fasi

3. CELEBRAZIONI E SUCCESSI:
   - Lista TUTTI i successi del mese (specifici!)
   - Celebra crescita personale e professionale
   - Evidenzia breakthrough moments

4. ANALISI COSTRUTTIVA:
   - Cosa ha funzionato particolarmente bene
   - Pattern di successo identificati
   - Aree di miglioramento per prossimo mese (senza giudizio)

5. ANTICIPAZIONE NUOVO CICLO:
   - Domani inizia un nuovo ciclo di 28+ giorni!
   - Nuovi focus e obiettivi per il mese che arriva
   - Motivazione ed entusiasmo per ricominciare
   - Continuità del percorso di crescita

6. CHIUSURA EMOZIONALE:
   - Orgoglio per il lavoro fatto questo mese
   - Gratitudine per la fiducia e l'impegno
   - Entusiasmo per ciò che verrà
   - Disponibilità e supporto continuo

DATI DISPONIBILI: TUTTI i dati del mese completo (fino a 31 giorni)

TONO: Celebrativo, riflessivo, emozionale, motivazionale, professionale

IMPORTANTE: 
- NON menzionare "28 giorni" - il mese può essere di qualsiasi lunghezza
- Parla di "questo mese" o "il mese che si chiude"
- Domani inizia SEMPRE il giorno 1 del nuovo ciclo

VERIFICA AZIONI PRECEDENTI: Recap finale di TUTTE le azioni suggerite nel mese intero.`
  }
];

async function updateEndMonthTemplates() {
  try {
    console.log("🔄 Starting update of end-month templates (28-31)...\n");

    for (const template of updatedTemplates) {
      try {
        // Get existing template
        const existing = await storage.getEmailJourneyTemplate(template.dayOfMonth);
        
        if (!existing) {
          console.log(`⚠️  Template for day ${template.dayOfMonth} not found - creating new one`);
          await storage.createEmailJourneyTemplate(template);
          console.log(`✅ Created template for day ${template.dayOfMonth}: "${template.title}"`);
        } else {
          // Update existing template
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
updateEndMonthTemplates()
  .then(() => {
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
