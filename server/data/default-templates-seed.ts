/**
 * Default WhatsApp Templates Seed Data
 * 
 * Contains 20 templates for each of the 5 agent types:
 * - receptionist
 * - proactive_setter
 * - informative_advisor
 * - customer_success
 * - intake_coordinator
 */

export type AgentType = "receptionist" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";

export interface DefaultTemplate {
    templateName: string;
    description: string;
    body: string;
    useCase: string;
    targetAgentType: AgentType;
}

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
    receptionist: "📞 Receptionist (Inbound)",
    proactive_setter: "🎯 Setter (Outbound)",
    informative_advisor: "📚 Consulente Educativo",
    customer_success: "❤️ Customer Success",
    intake_coordinator: "📋 Intake Coordinator",
};

// ═══════════════════════════════════════════════════════════════════════════
// RECEPTIONIST TEMPLATES (20)
// ═══════════════════════════════════════════════════════════════════════════

const receptionistTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Inbound",
        description: "Primo messaggio di benvenuto per lead che scrivono spontaneamente",
        body: "Ciao {nome_lead}! Grazie per averci contattato. Sono qui per aiutarti. Come posso assisterti oggi?",
        useCase: "primo contatto",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Conferma Ricezione",
        description: "Conferma ricezione richiesta",
        body: "{nome_lead}, ho ricevuto la tua richiesta. Ti rispondo entro poche ore. Grazie per la pazienza!",
        useCase: "conferma ricezione",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Appuntamento Confermato",
        description: "Conferma appuntamento schedulato",
        body: "Perfetto {nome_lead}! Il tuo appuntamento è confermato. Ti aspettiamo!",
        useCase: "conferma appuntamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Verifica Ricezione Info",
        description: "Verifica che il lead abbia ricevuto le informazioni",
        body: "Ciao {nome_lead}, volevo assicurarmi che avessi ricevuto le informazioni richieste. Posso aiutarti con altro?",
        useCase: "follow-up info",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Invio Informazioni",
        description: "Inviare informazioni richieste",
        body: "{nome_lead}, grazie per la tua pazienza. Ecco le informazioni che cercavi.",
        useCase: "invio dati",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Aggiornamento Richiesta",
        description: "Aggiornamento sullo stato della richiesta",
        body: "Buongiorno {nome_lead}! Come promesso, ti aggiorno sulla tua richiesta.",
        useCase: "aggiornamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Reminder Appuntamento",
        description: "Promemoria appuntamento del giorno dopo",
        body: "{nome_lead}, ti ricordo l'appuntamento di domani. Confermi la tua presenza?",
        useCase: "promemoria",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Verifica Chiarezza",
        description: "Verificare che tutto sia chiaro",
        body: "Ciao {nome_lead}! Tutto chiaro con le informazioni ricevute? Sono a disposizione.",
        useCase: "verifica comprensione",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Presa in Carico",
        description: "Conferma presa in carico richiesta",
        body: "{nome_lead}, il nostro team ha preso in carico la tua richiesta. Ti aggiorniamo presto.",
        useCase: "presa in carico",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Conferma Registrazione",
        description: "Conferma registrazione appuntamento",
        body: "Grazie {nome_lead}! Appuntamento registrato. Riceverai conferma via email.",
        useCase: "conferma registrazione",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Richiesta Info Aggiuntive",
        description: "Richiesta di informazioni extra per procedere",
        body: "{nome_lead}, abbiamo bisogno di un'informazione aggiuntiva per procedere.",
        useCase: "richiesta dati",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Feedback Post Appuntamento",
        description: "Chiedere feedback dopo l'appuntamento",
        body: "Ciao {nome_lead}, come è andato l'appuntamento? Posso aiutarti con altro?",
        useCase: "post appuntamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Conferma Modifica Appuntamento",
        description: "Conferma di modifica appuntamento",
        body: "{nome_lead}, ti confermiamo la modifica dell'appuntamento.",
        useCase: "modifica appuntamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Ringraziamento Scelta",
        description: "Ringraziamento per aver scelto il servizio",
        body: "Grazie per averci scelto {nome_lead}! A presto.",
        useCase: "ringraziamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Avviso Ricontatto",
        description: "Avviso che il consulente ricontatterà",
        body: "{nome_lead}, il consulente ti ricontatterà a breve. Grazie per l'attesa.",
        useCase: "avviso ricontatto",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Chiusura Positiva",
        description: "Messaggio di chiusura positivo",
        body: "Ciao {nome_lead}! Siamo felici di averti aiutato. Buona giornata!",
        useCase: "chiusura",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Riepilogo Conversazione",
        description: "Riepilogo di quanto discusso",
        body: "{nome_lead}, ecco il riepilogo di quanto discusso oggi.",
        useCase: "riepilogo",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Ringraziamento Fiducia",
        description: "Ringraziamento per la fiducia accordata",
        body: "Ti ringraziamo per la fiducia {nome_lead}. Siamo sempre a disposizione.",
        useCase: "fidelizzazione",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Dettagli Pre Appuntamento",
        description: "Invio dettagli per prepararsi all'appuntamento",
        body: "{nome_lead}, ti invio i dettagli per prepararti all'appuntamento.",
        useCase: "preparazione appuntamento",
        targetAgentType: "receptionist",
    },
    {
        templateName: "Check Finale",
        description: "Verifica finale che tutto sia a posto",
        body: "Ciao {nome_lead}, volevo solo confermare che è tutto a posto. Fammi sapere se hai bisogno!",
        useCase: "verifica finale",
        targetAgentType: "receptionist",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// SETTER TEMPLATES (20)
// ═══════════════════════════════════════════════════════════════════════════

const setterTemplates: DefaultTemplate[] = [
    {
        templateName: "Primo Contatto Outbound",
        description: "Primo messaggio per contatto proattivo",
        body: "Ciao {nome_lead}! Sono {nome_consulente}. Ho visto il tuo interesse. Posso chiederti 2 minuti per capire se possiamo aiutarti?",
        useCase: "primo contatto",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Follow-up Primo Messaggio",
        description: "Follow-up se non ha risposto al primo messaggio",
        body: "{nome_lead}, volevo assicurarmi che avessi visto il mio messaggio. Quando hai 5 minuti per una breve chiamata?",
        useCase: "follow-up",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Riconoscimento Impegni",
        description: "Riconoscere che il lead è occupato",
        body: "Ciao {nome_lead}! So che sei impegnato/a, ma credo che una chiacchierata potrebbe esserti utile. Quando sei disponibile?",
        useCase: "follow-up gentile",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Proposta Idea",
        description: "Proporre un'idea interessante",
        body: "{nome_lead}, ho un'idea che potrebbe interessarti. Posso condividerla con te in 10 minuti?",
        useCase: "proposta valore",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Ultimo Tentativo",
        description: "Ultimo tentativo di contatto rispettoso",
        body: "Ultimo tentativo {nome_lead}! Se non è il momento giusto, nessun problema. Fammi sapere quando vuoi sentirci.",
        useCase: "ultimo follow-up",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Social Proof",
        description: "Usare la prova sociale",
        body: "{nome_lead}, molti nella tua situazione hanno ottenuto risultati interessanti. Vuoi sapere come?",
        useCase: "social proof",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Disponibilità Orari",
        description: "Proporre orari specifici",
        body: "Ciao {nome_lead}! Ho disponibilità oggi pomeriggio e domani mattina. Quale preferisci?",
        useCase: "proposta orari",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Preferenza Canale",
        description: "Chiedere preferenza tra chiamata o messaggio",
        body: "{nome_lead}, preferisci una chiamata o un messaggio vocale con più dettagli?",
        useCase: "preferenza contatto",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Contenuto Preparato",
        description: "Annunciare contenuto preparato specificamente",
        body: "{nome_lead}, ho preparato qualcosa di specifico per te. Quando posso mostrartelo?",
        useCase: "proposta personalizzata",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Chiarimento Dubbi",
        description: "Offrirsi di chiarire dubbi",
        body: "Ciao {nome_lead}! So che hai valutato la nostra soluzione. Hai dubbi su cui posso aiutarti?",
        useCase: "gestione obiezioni",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Blocco Decisione",
        description: "Capire cosa blocca la decisione",
        body: "{nome_lead}, cosa ti impedisce di fare il prossimo passo? Forse posso aiutarti.",
        useCase: "sblocco obiezioni",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Gestione Dubbi Comuni",
        description: "Rispondere a dubbi comuni",
        body: "{nome_lead}, altre persone come te hanno avuto gli stessi dubbi. Vuoi sapere come li hanno superati?",
        useCase: "gestione obiezioni",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Slot Immediato",
        description: "Proporre chiamata immediata",
        body: "Ciao {nome_lead}! Ho uno slot libero tra 30 minuti. Ti andrebbe una breve chiamata?",
        useCase: "proposta immediata",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Pitch Veloce",
        description: "Richiedere 3 minuti per spiegare il valore",
        body: "{nome_lead}, se hai 3 minuti, ti spiego perché vale la pena approfondire.",
        useCase: "pitch rapido",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Preferenza Orario",
        description: "Chiedere preferenza orario",
        body: "{nome_lead}, qual è il momento migliore per sentirti? Mattina o pomeriggio?",
        useCase: "scheduling",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Approccio Rispettoso",
        description: "Approccio non invasivo",
        body: "Ciao {nome_lead}! Non voglio disturbarti, ma credo davvero che questo possa interessarti.",
        useCase: "approccio gentile",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Check Riflessione",
        description: "Verificare se ha riflettuto sulla proposta",
        body: "{nome_lead}, hai avuto modo di riflettere sulla nostra proposta?",
        useCase: "follow-up riflessione",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Offerta Chiarimenti",
        description: "Offrire chiarimenti pre-decisione",
        body: "{nome_lead}, ci sono domande che posso chiarirti prima di decidere?",
        useCase: "pre-decisione",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Promemoria Gentile",
        description: "Promemoria non invasivo",
        body: "Ciao {nome_lead}! Solo un gentile promemoria. Sono qui quando vuoi.",
        useCase: "promemoria",
        targetAgentType: "proactive_setter",
    },
    {
        templateName: "Chiusura Rispettosa",
        description: "Chiusura rispettosa senza forzare",
        body: "{nome_lead}, se cambi idea, sai dove trovarmi. In bocca al lupo!",
        useCase: "chiusura rispettosa",
        targetAgentType: "proactive_setter",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// INFORMATIVE ADVISOR TEMPLATES (20)
// ═══════════════════════════════════════════════════════════════════════════

const advisorTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Educativo",
        description: "Primo messaggio di benvenuto educativo",
        body: "Ciao {nome_lead}! Benvenuto/a. Sono qui per rispondere a tutte le tue domande. Cosa vorresti sapere?",
        useCase: "primo contatto",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Invio Guida",
        description: "Invio di una guida utile",
        body: "{nome_lead}, ecco una guida veloce che potrebbe esserti utile.",
        useCase: "contenuto educativo",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Spiegazione Semplice",
        description: "Spiegazione in modo semplice",
        body: "Ciao {nome_lead}! Molti si chiedono come funziona. Te lo spiego in modo semplice.",
        useCase: "spiegazione",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Verifica Comprensione",
        description: "Verificare la comprensione",
        body: "{nome_lead}, hai domande su quanto ti ho spiegato? Sono qui per chiarire tutto.",
        useCase: "verifica comprensione",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Tre Cose da Sapere",
        description: "Condivisione punti chiave",
        body: "Ecco 3 cose che dovresti sapere prima di iniziare, {nome_lead}.",
        useCase: "punti chiave",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Consegna Informazione",
        description: "Consegna informazione richiesta",
        body: "{nome_lead}, questa è l'informazione che cercavi. Fammi sapere se vuoi approfondire.",
        useCase: "consegna info",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Condivisione Consiglio",
        description: "Condivisione di un consiglio utile",
        body: "Ciao {nome_lead}! Ti condivido un consiglio che trovo molto utile.",
        useCase: "consiglio",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Guida Applicazione",
        description: "Come applicare quanto spiegato",
        body: "{nome_lead}, ecco come puoi applicare quello che ti ho spiegato.",
        useCase: "guida pratica",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Check Comprensione",
        description: "Verificare se ha capito tutto",
        body: "Hai capito tutto {nome_lead}? Se hai dubbi, scrivi pure!",
        useCase: "verifica dubbi",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Riepilogo",
        description: "Invio riepilogo discussione",
        body: "{nome_lead}, ti invio un riepilogo di quanto discusso.",
        useCase: "riepilogo",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Risorse Promesse",
        description: "Invio risorse promesse",
        body: "Ciao {nome_lead}! Ecco le risorse che ti avevo promesso.",
        useCase: "invio risorse",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Errore da Evitare",
        description: "Segnalare errore comune da evitare",
        body: "{nome_lead}, questo è un errore comune da evitare.",
        useCase: "warning",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Risposta Domanda",
        description: "Risposta diretta a domanda",
        body: "{nome_lead}, ecco la risposta alla tua domanda.",
        useCase: "risposta",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Augurio Utilità",
        description: "Augurio che le info siano utili",
        body: "Spero che le informazioni ti siano utili {nome_lead}. Buon percorso!",
        useCase: "chiusura positiva",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Offerta Approfondimento",
        description: "Offerta di materiali aggiuntivi",
        body: "{nome_lead}, se vuoi approfondire, posso inviarti altri materiali.",
        useCase: "offerta approfondimento",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Esperienza Personale",
        description: "Condivisione esperienza personale",
        body: "Ciao {nome_lead}! Nella mia esperienza, questo approccio funziona meglio.",
        useCase: "best practice",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Check Applicazione",
        description: "Verificare applicazione suggerimenti",
        body: "{nome_lead}, hai già provato quanto ti ho suggerito? Come è andata?",
        useCase: "follow-up applicazione",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Chiusura Supporto",
        description: "Chiusura con offerta supporto",
        body: "{nome_lead}, spero di esserti stato utile. A presto!",
        useCase: "chiusura",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Incoraggiamento",
        description: "Messaggio di incoraggiamento",
        body: "Ciao {nome_lead}! Ricorda: il primo passo è sempre il più difficile. Ce la puoi fare!",
        useCase: "motivazione",
        targetAgentType: "informative_advisor",
    },
    {
        templateName: "Disponibilità Futura",
        description: "Disponibilità per domande future",
        body: "{nome_lead}, se hai bisogno di altre informazioni in futuro, scrivimi pure!",
        useCase: "disponibilità continua",
        targetAgentType: "informative_advisor",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER SUCCESS TEMPLATES (20)
// ═══════════════════════════════════════════════════════════════════════════

const customerSuccessTemplates: DefaultTemplate[] = [
    {
        templateName: "Benvenuto Post-Acquisto",
        description: "Primo messaggio dopo l'acquisto",
        body: "Ciao {nome_lead}! Benvenuto/a nella nostra community! Sono qui per assicurarmi che tu abbia tutto ciò di cui hai bisogno.",
        useCase: "primo contatto post-vendita",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Check Andamento",
        description: "Verificare come sta andando",
        body: "{nome_lead}, come sta andando? Hai domande sul servizio?",
        useCase: "check-in",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Verifica Progresso",
        description: "Verificare che tutto proceda bene",
        body: "Ciao {nome_lead}! Volevo chiederti se tutto procede come previsto.",
        useCase: "verifica progresso",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Offerta Assistenza",
        description: "Offerta proattiva di assistenza",
        body: "{nome_lead}, hai bisogno di assistenza? Sono qui per te!",
        useCase: "assistenza proattiva",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Richiesta Feedback",
        description: "Richiesta feedback onesto",
        body: "{nome_lead}, come è stata la tua prima esperienza? Feedback onesto!",
        useCase: "raccolta feedback",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Celebrazione Successo",
        description: "Celebrare un successo del cliente",
        body: "Fantastico {nome_lead}! Sono felice che stia andando bene. Continua così!",
        useCase: "celebrazione",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Nuove Funzionalità",
        description: "Comunicare nuove funzionalità",
        body: "Ciao {nome_lead}! Hai visto le nuove funzionalità disponibili?",
        useCase: "aggiornamento prodotto",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Suggerimento Ottimizzazione",
        description: "Suggerimento per ottimizzare risultati",
        body: "{nome_lead}, ti invio un suggerimento per ottimizzare i tuoi risultati.",
        useCase: "ottimizzazione",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Riattivazione",
        description: "Riattivazione cliente inattivo",
        body: "{nome_lead}, abbiamo notato che non accedi da un po'. Tutto bene?",
        useCase: "riattivazione",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Case Study",
        description: "Condivisione risultati altri clienti",
        body: "Ciao {nome_lead}! Ecco cosa altri clienti come te stanno ottenendo.",
        useCase: "social proof",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Ringraziamento Fiducia",
        description: "Ringraziamento per la fiducia",
        body: "{nome_lead}, grazie per essere con noi. Apprezziamo la tua fiducia!",
        useCase: "fidelizzazione",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Check Risorse",
        description: "Verificare uso delle risorse disponibili",
        body: "{nome_lead}, hai sfruttato tutte le risorse a tua disposizione?",
        useCase: "educazione cliente",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Consiglio Esclusivo",
        description: "Consiglio esclusivo per clienti",
        body: "Ciao {nome_lead}! Ecco un consiglio esclusivo per i nostri clienti.",
        useCase: "valore esclusivo",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Richiesta Testimonianza",
        description: "Richiesta di testimonianza",
        body: "{nome_lead}, ti andrebbe di condividere la tua esperienza con una testimonianza?",
        useCase: "raccolta testimonianza",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Check Obiettivi",
        description: "Verificare raggiungimento obiettivi",
        body: "{nome_lead}, hai raggiunto i tuoi obiettivi? Parliamone!",
        useCase: "review obiettivi",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Anteprima Novità",
        description: "Anteprima di novità in arrivo",
        body: "Ciao {nome_lead}! Stiamo preparando qualcosa di speciale per te.",
        useCase: "engagement",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Richiesta Miglioramenti",
        description: "Richiesta feedback per miglioramenti",
        body: "{nome_lead}, c'è qualcosa che potremmo fare meglio? Il tuo feedback conta.",
        useCase: "raccolta feedback miglioramento",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Vantaggio Fedeltà",
        description: "Vantaggio esclusivo per clienti fedeli",
        body: "{nome_lead}, grazie per essere un cliente fedele. Ecco un vantaggio esclusivo per te.",
        useCase: "reward fedeltà",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Disponibilità",
        description: "Ricordare disponibilità supporto",
        body: "Ciao {nome_lead}! Ricorda che siamo sempre a disposizione.",
        useCase: "promemoria supporto",
        targetAgentType: "customer_success",
    },
    {
        templateName: "Saluto Cordiale",
        description: "Saluto cordiale di chiusura",
        body: "{nome_lead}, a presto! È un piacere averti come cliente.",
        useCase: "chiusura",
        targetAgentType: "customer_success",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// INTAKE COORDINATOR TEMPLATES (20)
// ═══════════════════════════════════════════════════════════════════════════

const intakeTemplates: DefaultTemplate[] = [
    {
        templateName: "Richiesta Documenti Iniziale",
        description: "Prima richiesta documenti pre-appuntamento",
        body: "Ciao {nome_lead}! Prima del tuo appuntamento, ho bisogno di alcuni documenti. Ti spiego cosa serve.",
        useCase: "primo contatto",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Richiesta Documento Specifico",
        description: "Richiesta documento specifico",
        body: "{nome_lead}, per procedere ho bisogno di un documento. Puoi inviarlo qui?",
        useCase: "richiesta documento",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Conferma Ricezione Parziale",
        description: "Conferma ricezione con documenti mancanti",
        body: "Ciao {nome_lead}! Ho ricevuto il documento, grazie! Ne manca ancora uno.",
        useCase: "conferma parziale",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Documenti Completi",
        description: "Conferma che tutti i documenti sono arrivati",
        body: "{nome_lead}, perfetto! Ho tutto. Sei pronto/a per l'appuntamento.",
        useCase: "conferma completa",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Qualità Insufficiente",
        description: "Richiesta nuovo invio per qualità",
        body: "{nome_lead}, il documento inviato non è leggibile. Puoi rifarlo per favore?",
        useCase: "richiesta reinvio",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Reminder Documenti",
        description: "Promemoria invio documenti",
        body: "Ciao {nome_lead}! Ti ricordo di inviare i documenti entro domani.",
        useCase: "promemoria",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Ultimo Documento",
        description: "Notifica che manca solo un documento",
        body: "{nome_lead}, manca solo un documento. Appena lo ricevo, sei a posto!",
        useCase: "quasi completo",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Verifica Completata",
        description: "Conferma verifica documenti completata",
        body: "{nome_lead}, ho controllato tutto. I documenti sono completi.",
        useCase: "verifica ok",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Checklist Documenti",
        description: "Invio checklist documenti necessari",
        body: "Ciao {nome_lead}! Ecco la checklist dei documenti necessari.",
        useCase: "invio checklist",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Offerta Aiuto",
        description: "Offerta di aiuto per reperire documenti",
        body: "{nome_lead}, hai bisogno di aiuto per reperire un documento?",
        useCase: "supporto",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Istruzioni Compilazione",
        description: "Istruzioni per compilare modulo",
        body: "{nome_lead}, ti invio le istruzioni per compilare il modulo.",
        useCase: "istruzioni",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Conferma Arrivo",
        description: "Conferma arrivo documento",
        body: "Ciao {nome_lead}! Il documento è arrivato. Tutto ok!",
        useCase: "conferma ricezione",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Documenti Appuntamento",
        description: "Lista documenti da portare all'appuntamento",
        body: "{nome_lead}, l'appuntamento è confermato. Porta con te questi documenti.",
        useCase: "preparazione appuntamento",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Scadenza Documenti",
        description: "Promemoria scadenza documenti",
        body: "{nome_lead}, ti mando un promemoria: i documenti servono entro breve.",
        useCase: "deadline",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Informazione Mancante",
        description: "Segnalazione informazione mancante nel modulo",
        body: "Ciao {nome_lead}! Ho notato un'informazione mancante nel modulo.",
        useCase: "correzione",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Aggiornamento Documento",
        description: "Richiesta aggiornamento documento in scadenza",
        body: "{nome_lead}, il documento scade tra poco. Aggiorniamolo prima dell'appuntamento.",
        useCase: "aggiornamento",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Riepilogo Inviati",
        description: "Riepilogo documenti inviati",
        body: "{nome_lead}, ecco il riepilogo di tutto ciò che hai inviato.",
        useCase: "riepilogo",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Pronti Appuntamento",
        description: "Conferma tutto pronto per l'appuntamento",
        body: "Ciao {nome_lead}! Siamo pronti. A domani!",
        useCase: "conferma finale",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Ringraziamento Collaborazione",
        description: "Ringraziamento per la collaborazione",
        body: "{nome_lead}, grazie per la collaborazione! Tutti i documenti sono in ordine.",
        useCase: "ringraziamento",
        targetAgentType: "intake_coordinator",
    },
    {
        templateName: "Disponibilità Domande",
        description: "Disponibilità per domande sui documenti",
        body: "{nome_lead}, se hai domande sui documenti, scrivimi pure!",
        useCase: "supporto",
        targetAgentType: "intake_coordinator",
    },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
    ...receptionistTemplates,
    ...setterTemplates,
    ...advisorTemplates,
    ...customerSuccessTemplates,
    ...intakeTemplates,
];

export const DEFAULT_TEMPLATES_BY_AGENT: Record<AgentType, DefaultTemplate[]> = {
    receptionist: receptionistTemplates,
    proactive_setter: setterTemplates,
    informative_advisor: advisorTemplates,
    customer_success: customerSuccessTemplates,
    intake_coordinator: intakeTemplates,
};

/**
 * Get all default templates for a specific agent type
 */
export function getDefaultTemplatesForAgent(agentType: AgentType): DefaultTemplate[] {
    return DEFAULT_TEMPLATES_BY_AGENT[agentType] || [];
}

/**
 * Get the first template (opening message) for an agent type
 */
export function getOpeningTemplateForAgent(agentType: AgentType): DefaultTemplate | undefined {
    const templates = getDefaultTemplatesForAgent(agentType);
    return templates.find(t => t.useCase === "primo contatto");
}
