
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  GraduationCap,
  FileText,
  Calendar,
  MessageCircle,
  Map,
  Library,
  Settings,
  Sparkles,
  ChevronRight,
  Home,
  X,
  Video,
  Zap,
  CalendarDays
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Section {
  id: string;
  title: string;
  icon: any;
  color: string;
  path: string;
  content: {
    intro: string;
    fullText: string;
    tips: string[];
  };
}

const sections: Section[] = [
  {
    id: "video-tutorial",
    title: "Video Tutorial",
    icon: Video,
    color: "red",
    path: "/client/faq",
    content: {
      intro: "Guarda il video tutorial completo per imparare ad usare tutte le funzionalità della piattaforma in modo semplice e veloce.",
      fullText: `## Tutorial Video Completo della Piattaforma

Abbiamo preparato un video tutorial dettagliato che ti guida attraverso tutte le funzionalità principali della piattaforma. Questo video è il modo più veloce per capire come sfruttare al massimo ogni strumento a tua disposizione.

### Cosa Imparerai dal Video

Il video tutorial ti accompagna in un viaggio strutturato in 5 tappe fondamentali, mostrandoti come questa piattaforma non sia una semplice raccolta di strumenti, ma un vero ecosistema integrato di crescita professionale.

**1. Le Fondamenta: La Grande Promessa (0:00 - 1:12)**: Scoprirai la filosofia alla base della piattaforma. Non si tratta di avere tanti strumenti separati (un corso qui, un'app per le abitudini là, un coach separatamente), ma di un sistema dove ogni elemento comunica con tutti gli altri. La vera forza non sta nei singoli strumenti, ma nella loro sinergia. Vedrai come questa integrazione crea un'esperienza fluida che risolve il problema dell'apprendimento frammentato.

**2. I Due Pilastri Fondamentali (1:12 - 3:26)**: Qui esploriamo i due elementi che reggono l'intera impalcatura. Da un lato l'**AI Assistant**, il tuo compagno di viaggio con doppia personalità: supporto quotidiano per dubbi immediati e briefing mattutini, ma anche consigliere strategico specializzato (finanza, business, vendita). La genialità? È "context-aware" - sa esattamente dove ti trovi nella piattaforma e adatta le risposte di conseguenza. Dall'altro lato l'**Università**, strutturata come un percorso accademico ma con logica da videogioco: anni, trimestri, moduli e lezioni che si sbloccano progressivamente garantendo un apprendimento solido.

**3. Dalla Teoria alla Pratica (3:26 - 5:02)**: Questa sezione mostra come trasformare la conoscenza in competenze reali. Vedrai il ciclo completo degli **Esercizi**: da completare → in revisione → approvato/da correggere, con feedback continuo dal consulente. Scoprirai le tre visualizzazioni (Kanban per il flusso, Timeline per la storia, Griglia per la panoramica). E poi il potentissimo **Diario dei 5 Minuti**: tre domande quotidiane (gratitudine, priorità, miglioramenti) che ancorano tutto il percorso alla vita reale.

**4. La Magia dell'Integrazione (5:02 - 6:22)**: Questo è il cuore pulsante del video. Vedrai esempi pratici di come tutto si connette: stai seguendo una lezione? Con un click apri l'esercizio collegato. Lo pianifichi nel calendario. Serve un approfondimento? Accedi al documento nella Libreria. E in ogni punto l'AI è lì, contestualmente. Non sono strumenti separati - è un flusso naturale e intuitivo dove ogni passo supporta il tuo percorso specifico.

**5. Il Futuro della Formazione (6:22 - 7:14)**: La conclusione ti mostra la visione d'insieme: un ambiente di apprendimento vivo, olistico e reattivo. Un sistema che guarda tutti gli aspetti della crescita (teoria, pratica, pianificazione, riflessione), che si adatta a te, ai tuoi progressi e necessità. Non è formazione statica, ma un ecosistema che evolve con te verso i tuoi obiettivi.

### Perché Guardare il Video

Molte persone preferiscono l'apprendimento visivo rispetto alla lettura di guide testuali. Il video ti permette di **vedere in azione** ogni funzionalità, rendendo tutto più chiaro e immediato. Invece di immaginare come funziona qualcosa leggendone la descrizione, lo vedi direttamente sullo schermo.

Il tutorial è strutturato in modo che tu possa **guardarlo tutto d'un fiato** per avere una panoramica completa, oppure **saltare direttamente** alle sezioni che ti interessano di più usando i timestamp indicati sopra.

### Come Utilizzare al Meglio il Video

Mentre guardi il video, tieni aperta la piattaforma in un'altra finestra o tab. In questo modo puoi **seguire passo-passo** ciò che viene mostrato, replicando le azioni nel tuo account reale. Questo approccio pratico ti aiuta a memorizzare meglio i processi.

Non sentirti obbligato a guardare tutto in una volta. Il video è lungo e dettagliato proprio per essere completo. Guardalo a **pezzi**, concentrandoti su una sezione alla volta. Per esempio, oggi potresti guardare la parte sull'Università e metterla in pratica, domani quella sugli Esercizi, e così via.

Usa il video come **riferimento ricorrente**. Anche dopo averlo guardato una prima volta, potrai tornarci quando hai dubbi su una funzionalità specifica. I timestamp ti permettono di trovare rapidamente la parte che ti serve.

### Funzionalità Aggiuntive Non Presenti nel Video

Il video tutorial copre le funzionalità core della piattaforma. Tuttavia, abbiamo continuato ad evolvere il sistema aggiungendo nuove sezioni potenti:

**Calendario**: Un hub integrato per gestire eventi, appuntamenti, consulenze e visualizzare la tua attività produttiva in un'unica vista tipo Google Calendar. Sincronizza automaticamente le consulenze e può mostrare i tuoi check-in Momentum come eventi colorati.

**Momentum**: Un sistema di tracking produttività che ti aiuta a costruire streak giornalieri, registrare check-in durante la giornata e monitorare metriche chiave come punteggio produttività e obiettivi raggiunti. È perfettamente integrato con il Calendario per una vista unificata del tuo tempo.

Queste funzionalità sono descritte in dettaglio nelle rispettive sezioni di questa guida FAQ, con tutorial completi e best practices.

### Integrare Video e Guide Testuali

Questo video non sostituisce le guide testuali dettagliate che trovi nelle altre sezioni di questa pagina FAQ. Piuttosto, **si integra** con esse. Il video ti dà una panoramica visuale e pratica, mentre le guide testuali approfondiscono i concetti, spiegano le strategie e forniscono best practices.

L'approccio ideale è: guarda il video per capire **come** fare le cose, poi leggi le guide per capire **perché** farle in un certo modo e come massimizzare i benefici. Per funzionalità più recenti come Calendario e Momentum, fai riferimento direttamente alle guide testuali dedicate.`,
      tips: [
        "Usa i timestamp nel video per saltare direttamente alle sezioni che ti interessano. Non è necessario guardare tutto in sequenza se hai bisogno di informazioni su una funzionalità specifica.",
        "Mentre guardi il video, tieni aperta la piattaforma in un'altra finestra e replica le azioni mostrate. L'apprendimento pratico è molto più efficace della visione passiva.",
        "Se una parte del video non ti è chiara, metti in pausa e riavvolgi. Guardare più volte lo stesso segmento ti aiuta a comprendere meglio i passaggi complessi.",
        "Dopo aver guardato una sezione del video, vai immediatamente a provare quella funzionalità nella piattaforma. L'applicazione immediata consolida l'apprendimento.",
        "Salva il link del video nei preferiti del browser. Potrai tornarci facilmente quando hai bisogno di un ripasso veloce su una funzionalità specifica.",
        "Combina il video con le guide testuali: il video ti mostra COME fare le cose, le guide ti spiegano PERCHÉ farle in un certo modo e come massimizzare i benefici."
      ]
    }
  },
  {
    id: "university",
    title: "Università",
    icon: GraduationCap,
    color: "blue",
    path: "/client/university",
    content: {
      intro: "L'Università è il cuore del tuo percorso formativo. Qui trovi tutte le lezioni organizzate in un percorso strutturato che ti accompagnerà passo dopo passo verso i tuoi obiettivi.",
      fullText: `## Benvenuto nella Tua Università Personale

L'Università rappresenta il tuo percorso di crescita professionale strutturato in modo chiaro e progressivo. Pensa a questa sezione come a un vero e proprio corso universitario, ma completamente personalizzato sulle tue esigenze e sui tuoi obiettivi di business.

### Come Funziona la Struttura

Il sistema è organizzato su **tre livelli gerarchici** che ti permettono di procedere con ordine e metodo:

**Gli Anni Accademici** rappresentano le macro-fasi del tuo percorso. Ogni anno è pensato per costruire competenze specifiche che si integrano con quelle dell'anno precedente. Quando accedi alla sezione Università, vedrai una lista verticale di anni. Cliccando su un anno, questo si espanderà mostrandoti i trimestri al suo interno.

**I Trimestri** suddividono ogni anno in blocchi tematici di 3 mesi circa. Ogni trimestre si concentra su un aspetto particolare del tuo sviluppo professionale. Per esempio, un trimestre potrebbe essere dedicato alle competenze finanziarie, un altro alle strategie di vendita, e così via. Questa suddivisione ti aiuta a mantenere il focus e a vedere progressi concreti in tempi definiti.

**I Moduli** sono i contenitori delle lezioni vere e proprie. Ogni modulo raggruppa 5-10 lezioni che trattano un argomento specifico in modo approfondito. I moduli sono pensati per essere completati in sequenza, così da costruire le tue competenze mattone dopo mattone.

### Studiare e Completare le Lezioni

Quando clicchi su un modulo, vedrai l'elenco completo delle lezioni disponibili. Ogni lezione è presentata con un titolo chiaro e, accanto ad essa, troverai una **checkbox**. Questa checkbox è il tuo strumento principale per tenere traccia dei progressi: quando completi lo studio di una lezione, spuntala. Il sistema aggiornerà automaticamente le tue statistiche e la barra di progresso.

Ma c'è di più: molte lezioni sono collegate a contenuti presenti nella **Libreria** - le riconosci perché hanno l'icona 📖 accanto al titolo. Quando clicchi su "Vai alla Lezione", il sistema ti porterà direttamente al materiale formativo completo, che potrebbe includere video, PDF scaricabili, presentazioni e altro ancora.

### Gli Esercizi Collegati

Alcune lezioni hanno degli **esercizi pratici** associati. Questi esercizi sono fondamentali perché ti permettono di applicare subito ciò che hai studiato. Quando una lezione ha un esercizio collegato, vedrai un badge colorato che indica lo stato:

- **"Da Fare"** in rosso: l'esercizio è stato assegnato ma non ancora iniziato
- **"In Corso"** in giallo: hai iniziato a lavorarci ma non l'hai ancora completato
- **"Completato"** in verde: hai completato e consegnato l'esercizio

Cliccando sul badge, verrai portato direttamente alla pagina dell'esercizio dove potrai lavorarci.

### Le Note Personali

Per ogni lezione hai la possibilità di aggiungere **note personali**. Questa funzionalità è preziosa perché ti permette di:

- Scrivere insights e riflessioni mentre studi
- Annotare domande da fare al consulente
- Creare riassunti personalizzati
- Collegare i concetti alle tue esperienze pratiche

Clicca sull'icona delle note accanto a qualsiasi lezione per aprire il campo di testo. Le tue note vengono salvate automaticamente e saranno sempre disponibili quando torni sulla lezione.

### Monitorare i Tuoi Progressi

Nella parte superiore della pagina Università trovi una sezione dedicata alle **statistiche**. Qui puoi vedere in tempo reale:

- **Il progresso complessivo**: una barra che mostra quante lezioni hai completato rispetto al totale
- **La media voti**: se hai completato esercizi valutati dal consulente, vedrai la tua media
- **Gli attestati ottenuti**: quando completi trimestri o anni interi, il consulente può rilasciarti attestati di completamento

Questi dati ti danno una visione chiara di dove sei nel tuo percorso e quanto manca per raggiungere i prossimi traguardi.

### Come Sfruttare al Meglio l'Università

Il consiglio principale è di procedere **con costanza e metodo**. Non cercare di bruciare le tappe: ogni lezione è posizionata in un punto specifico del percorso per un motivo preciso. Le competenze si costruiscono una sull'altra.

Dedica del tempo ogni giorno allo studio, anche solo 30 minuti. È meglio studiare poco ma con regolarità che fare maratone sporadiche. Usa la sezione "Task & Riflessioni" per pianificare le tue sessioni di studio quotidiane.

Quando studi una lezione, non limitarti a leggerla: rifletti su come applicare quei concetti al tuo business specifico. Usa le note per creare questo ponte tra teoria e pratica.

Se una lezione ha un esercizio collegato, completalo prima di passare alla successiva. Gli esercizi sono progettati per consolidare l'apprendimento e il consulente li usa per verificare che tu abbia davvero compreso i concetti.`,
      tips: [
        "Le lezioni con l'icona 📖 hanno contenuti ricchi nella Libreria - video, PDF, presentazioni. Clicca 'Vai alla Lezione' per accedere a tutto il materiale formativo completo.",
        "Le lezioni con esercizi collegati mostrano un badge colorato che indica lo stato (Da Fare, In Corso, Completato). Completa gli esercizi prima di proseguire per consolidare l'apprendimento.",
        "Usa le note personali per annotare insights, domande e riflessioni mentre studi. Questo trasforma lo studio passivo in apprendimento attivo e personalizzato.",
        "Gli attestati vengono rilasciati dal consulente quando completi trimestri o anni interi. Sono un riconoscimento formale del tuo impegno e progresso.",
        "La barra di progresso in alto si aggiorna in tempo reale quando completi le lezioni. Usala per monitorare quotidianamente i tuoi avanzamenti.",
        "Non saltare le lezioni anche se pensi di conoscere già l'argomento. Ogni lezione contiene dettagli specifici e strategie pratiche che potrebbero esserti sfuggite."
      ]
    }
  },
  {
    id: "exercises",
    title: "Esercizi",
    icon: FileText,
    color: "purple",
    path: "/client/exercises",
    content: {
      intro: "Gli Esercizi sono il ponte tra teoria e pratica. Qui trasformi ciò che hai imparato in azioni concrete per il tuo business.",
      fullText: `## La Palestra del Tuo Business

Gli Esercizi rappresentano la parte più pratica e operativa del tuo percorso formativo. Se l'Università è il luogo dove acquisisci le conoscenze, gli Esercizi sono la palestra dove alleni le competenze e le trasformi in risultati concreti.

### Le Due Tipologie di Esercizi

Il sistema ti offre **due modalità di esercizi**, ciascuna con uno scopo specifico:

**Gli Esercizi Consulenza** sono completamente personalizzati sulle tue esigenze. Il tuo consulente li crea appositamente per te, basandosi sulla tua situazione attuale, sui tuoi obiettivi e sulle sfide che stai affrontando. Questi esercizi possono riguardare qualsiasi aspetto del tuo business: dalla creazione di un piano marketing alla strutturazione di un'offerta, dall'analisi finanziaria alla gestione del tempo.

**Gli Esercizi Corso** sono legati al percorso formativo dell'Università. Questi esercizi seguono la progressione delle lezioni e sono progettati per far sì che tu applichi immediatamente i concetti studiati. Completando questi esercizi, solidifichi l'apprendimento e costruisci un portfolio di lavori pratici.

Puoi passare da una modalità all'altra usando il selettore in alto nella pagina. Questo ti permette di concentrarti di volta in volta sul tipo di lavoro che è più urgente o utile per te in quel momento.

### Organizzare e Filtrare gli Esercizi

Gli esercizi sono organizzati per **categorie tematiche**: Finanza, Vendita, Business, Marketing, Mindset, Operatività. Sulla sinistra della schermata trovi i filtri che ti permettono di visualizzare solo gli esercizi di una categoria specifica.

Questo è particolarmente utile quando vuoi concentrarti su un'area particolare del tuo sviluppo. Per esempio, se stai lavorando per migliorare le tue competenze di vendita, puoi filtrare solo gli esercizi di categoria "Vendita" e dedicarti esclusivamente a quelli.

### Le Tre Viste Disponibili

Il sistema ti offre **tre modalità di visualizzazione** diverse, pensate per adattarsi al tuo stile di lavoro:

**La Vista Kanban** organizza gli esercizi in colonne verticali in base allo stato: Da Fare, In Corso, In Revisione, Completati, Restituiti. Questa vista è ideale se ti piace avere una panoramica visuale immediata di dove si trova ogni esercizio nel flusso di lavoro. Puoi vedere a colpo d'occhio quanti esercizi hai in corso, quanti attendono il feedback del consulente e quali hai già completato.

**La Vista Griglia** presenta gli esercizi come card disposte in una griglia. Ogni card mostra il titolo, la categoria, la durata stimata e lo stato. Questa vista è perfetta per scansionare rapidamente tutti gli esercizi disponibili e scegliere su quale lavorare.

**La Vista Timeline** mostra gli esercizi disposti su una linea temporale in base alle date di scadenza e completamento. Questa vista ti aiuta a pianificare il lavoro e a rispettare le deadline. Puoi vedere quali esercizi sono urgenti e organizzare di conseguenza il tuo tempo.

### Come Lavorare su un Esercizio

Quando clicchi su un esercizio, si apre una pagina dedicata dove trovi:

**Le Istruzioni Dettagliate**: il consulente ha preparato una guida completa su cosa devi fare. Leggi attentamente le istruzioni prima di iniziare. Spesso includono esempi, riferimenti a lezioni specifiche e suggerimenti pratici.

**Le Domande o Compiti**: ogni esercizio è strutturato con domande specifiche o task da completare. Alcune domande richiedono risposte testuali, altre potrebbero richiedere di creare documenti, strategie o piani d'azione.

**I Campi di Risposta**: compila ogni campo con attenzione e dettaglio. Non limitarti a risposte superficiali - questo è il momento di riflettere davvero e applicare ciò che hai imparato alla tua situazione specifica.

**La Durata Stimata**: ogni esercizio indica quanto tempo dovresti dedicargli. Usa questa informazione per pianificare quando lavorarci. Alcuni esercizi richiedono 30 minuti, altri potrebbero necessitare di 2-3 ore.

### Il Sistema di Revisione

Una volta completato l'esercizio, clicca su **"Invia per Revisione"**. A questo punto, il consulente riceverà una notifica e valuterà il tuo lavoro. Il processo di revisione è una parte fondamentale del percorso:

Il consulente legge attentamente le tue risposte, valuta la qualità del lavoro e ti fornisce **feedback dettagliato**. Questo feedback non è una semplice valutazione numerica, ma un'analisi approfondita di cosa hai fatto bene, dove puoi migliorare e quali prossimi passi dovresti fare.

Se l'esercizio viene **Approvato**, significa che hai completato il lavoro in modo soddisfacente. L'esercizio si sposta nello stato "Completato" e contribuisce alle tue statistiche di progresso.

Se l'esercizio viene **Restituito**, non preoccuparti: significa semplicemente che il consulente ha individuato aree di miglioramento. Leggi attentamente il feedback, comprendi i suggerimenti e rielabora l'esercizio. Questa iterazione è preziosa perché ti permette di affinare le tue competenze.

### Salvare le Bozze

Non devi necessariamente completare un esercizio in una sola sessione. Il sistema ti permette di **salvare le bozze**: puoi lavorare su un esercizio, salvare i progressi e riprenderlo in un secondo momento. Quando torni sull'esercizio, troverai tutto esattamente come l'avevi lasciato.

Questa funzionalità è particolarmente utile per esercizi complessi che richiedono ricerche, riflessioni o che devono essere sviluppati in più fasi.

### Massimizzare il Valore degli Esercizi

Gli esercizi non sono solo compiti da completare - sono opportunità di trasformazione. Ogni esercizio è progettato per portarti a riflettere, pianificare e agire in modo nuovo nel tuo business.

Affronta ogni esercizio con serietà e dedizione. Non cercare scorciatoie o risposte rapide. Il vero valore non sta nel "completare" l'esercizio, ma nel processo di riflessione e applicazione che fai mentre lo sviluppi.

Usa gli esercizi come occasione per sperimentare nuove strategie nel tuo business reale. Non limitarti a rispondere in teoria - applica, testa, verifica i risultati e poi condividi le tue esperienze con il consulente.

Quando ricevi il feedback, non limitarti a leggerlo: studialo attentamente, fai domande se qualcosa non è chiaro e, soprattutto, implementa i suggerimenti ricevuti. Il feedback del consulente è oro puro - è esperienza concentrata che puoi applicare immediatamente.`,
      tips: [
        "Gli esercizi marcati come 'Restituiti' contengono feedback prezioso dal consulente. Non vederli come fallimenti, ma come opportunità di apprendimento approfondito. Leggi ogni commento con attenzione prima di rielaborare.",
        "Salva frequentemente le bozze mentre lavori su esercizi complessi. Questo ti permette di lavorare in più sessioni senza perdere progressi e di riflettere con calma tra una sessione e l'altra.",
        "La durata stimata ti aiuta a pianificare quando dedicarti all'esercizio. Blocca del tempo nel tuo calendario specificamente per gli esercizi - non lavorarci nei ritagli di tempo.",
        "Ogni esercizio completato e approvato contribuisce al tuo progresso formativo complessivo e costruisce il tuo portfolio di competenze pratiche. Tieni traccia di quello che impari da ogni esercizio.",
        "Usa i filtri per categoria quando vuoi concentrarti su un'area specifica del tuo sviluppo professionale. Lavorare a blocchi tematici è più efficace che saltare da un argomento all'altro.",
        "La vista Timeline è particolarmente utile per gestire le scadenze. Se hai esercizi con deadline ravvicinate, usa questa vista per prioritizzare il lavoro."
      ]
    }
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    icon: Sparkles,
    color: "pink",
    path: "/client/ai-assistant",
    content: {
      intro: "L'AI Assistant è il tuo consulente digitale sempre disponibile, che conosce tutto del tuo percorso e può aiutarti in qualsiasi momento.",
      fullText: `## Il Tuo Consulente Intelligente 24/7

L'AI Assistant rappresenta una vera rivoluzione nel tuo percorso di crescita. Immagina di avere un consulente esperto sempre a disposizione, che conosce perfettamente la tua situazione, i tuoi progressi, i tuoi dati finanziari e può darti consigli personalizzati in qualsiasi momento del giorno o della notte.

### Come Funziona l'Intelligenza dell'Assistant

L'AI non è un semplice chatbot che risponde a domande generiche. Questo sistema ha accesso completo al tuo **profilo formativo**: conosce quali lezioni hai completato, quali esercizi stai svolgendo, quali feedback hai ricevuto dal consulente, i tuoi obiettivi e le tue sfide attuali.

Ma c'è di più: se hai collegato il tuo account Percorso Capitale nelle Impostazioni, l'AI ha accesso anche ai tuoi **dati finanziari reali** - conti correnti, budget, transazioni, investimenti, obiettivi finanziari. Questo gli permette di darti consigli non teorici ma basati sulla tua situazione finanziaria effettiva.

### Le Due Modalità Principali

L'AI Assistant lavora in **due modalità fondamentali**, ciascuna ottimizzata per esigenze diverse:

**La Modalità Assistenza** è pensata per il supporto quotidiano e operativo. È come avere un assistente personale che ti aiuta a organizzare il lavoro, tenere traccia dei progressi e navigare la piattaforma. In questa modalità, l'AI può:

- Darti un briefing giornaliero personalizzato ("Cosa devo fare oggi?")
- Aiutarti a trovare lezioni o esercizi specifici
- Spiegarti come funzionano le varie sezioni della piattaforma
- Ricordarti task e scadenze importanti
- Creare riassunti dei tuoi progressi settimanali o mensili

**La Modalità Consulente** trasforma l'AI in un vero e proprio advisor strategico. In questa modalità, l'intelligenza artificiale assume il ruolo di un consulente esperto in uno specifico ambito professionale. Quando selezioni la Modalità Consulente, devi anche scegliere il **Tipo di Consulente** di cui hai bisogno:

Il **Consulente Finanziario** è specializzato in tutto ciò che riguarda la gestione del denaro. Ti aiuta ad analizzare i tuoi flussi di cassa, ottimizzare il budget, pianificare investimenti, gestire il debito, creare piani di risparmio. Se hai collegato Percorso Capitale, può darti consigli basati sui tuoi dati finanziari reali.

Il **Consulente Vendita** è focalizzato su tutto il processo commerciale. Ti aiuta a creare script di vendita, gestire obiezioni, strutturare presentazioni, analizzare il funnel di vendita, migliorare le tecniche di chiusura, aumentare le conversioni.

Il **Consulente Business** ha una visione strategica d'insieme. Ti aiuta con la pianificazione aziendale, la creazione di offerte, il posizionamento sul mercato, la gestione del tempo, la definizione di obiettivi, la creazione di sistemi e processi.

### Le Azioni Rapide

Quando apri l'AI Assistant, vedrai una serie di **pulsanti con azioni rapide**. Questi sono suggerimenti intelligenti basati sulla tua situazione attuale. Per esempio:

- Se hai esercizi in sospeso, potrebbe suggerirti "Quali esercizi devo completare questa settimana?"
- Se stai studiando un modulo specifico, potrebbe offrirti "Spiegami i concetti chiave del modulo X"
- Se è lunedì mattina, potrebbe proporti "Dammi un piano d'azione per questa settimana"

Questi suggerimenti cambiano dinamicamente in base a dove sei nel percorso e a cosa stai facendo. Sono un modo rapido per iniziare conversazioni utili senza dover scrivere domande da zero.

### Come Interagire Efficacemente

L'AI funziona meglio quando le fai **domande specifiche e contestualizzate**. Invece di chiedere "Come faccio a vendere meglio?", prova con "Sto vendendo il mio servizio di consulenza a €2000, ma le persone dicono che è troppo caro. Come posso gestire questa obiezione?".

Più dettagli fornisci sulla tua situazione specifica, più i consigli dell'AI saranno pertinenti e utili. L'AI può leggere tra le righe e capire il contesto, ma dare informazioni esplicite aiuta.

L'AI può anche **suggerirti azioni concrete**. Per esempio, se stai discutendo di un argomento trattato in una lezione specifica, l'AI potrebbe suggerirti link diretti per aprire quella lezione. Se parli di un esercizio, potrebbe proporti di aprirlo direttamente. Questi link blu sono cliccabili e ti portano immediatamente dove devi andare.

### Gestire le Conversazioni

Ogni volta che avvii una nuova conversazione con l'AI, questa viene **salvata automaticamente**. Puoi tornare a qualsiasi conversazione passata in qualsiasi momento usando il menu laterale.

È buona pratica creare **conversazioni separate per argomenti diversi**. Per esempio:

- Una conversazione dedicata alla pianificazione finanziaria
- Una per il lavoro su esercizi specifici
- Una per domande sulle lezioni
- Una per la strategia di vendita

Questo ti permette di ritrovare facilmente le informazioni e di mantenere il focus su temi specifici. Usa il pulsante "Nuova Conversazione" quando vuoi iniziare a parlare di un argomento completamente nuovo.

Il filtro nella barra laterale ti permette di **cercare tra le conversazioni passate**. Se ricordi di aver discusso di un argomento specifico settimane fa, puoi cercarlo e rileggere i consigli ricevuti.

### Casi d'Uso Pratici

Ecco alcuni modi concreti in cui puoi sfruttare l'AI Assistant:

**Analisi Lezioni**: "Spiegami in modo semplice il concetto di Value Ladder trattato nella lezione 5 del modulo Marketing"

**Supporto Esercizi**: "Sto lavorando sull'esercizio 'Creazione Offerta Premium'. Puoi aiutarmi a strutturare un'offerta per il mio servizio di coaching?"

**Pianificazione Quotidiana**: "Cosa devo fare oggi per essere produttivo? Considera le mie scadenze e priorità"

**Analisi Finanziaria**: (se hai collegato Percorso Capitale) "Analizza le mie spese del mese scorso e dimmi dove posso ridurre i costi"

**Problem Solving**: "Ho un cliente che non paga da 60 giorni. Come dovrei gestire la situazione?"

**Strategia**: "Voglio lanciare un nuovo servizio. Aiutami a creare un piano di lancio step-by-step"

### Limiti e Potenzialità

L'AI Assistant è incredibilmente potente, ma ha anche dei limiti che è importante conoscere. **Non può sostituire** il rapporto con il tuo consulente umano. Per decisioni strategiche importanti, problemi complessi o situazioni delicate, il consulente rimane il tuo riferimento principale.

L'AI è eccellente per:
- Chiarimenti immediati su concetti
- Brainstorming e generazione di idee
- Organizzazione e pianificazione
- Analisi di dati oggettivi
- Spiegazioni e formazione

Il consulente umano è insostituibile per:
- Feedback personalizzato e profondo
- Comprensione di sfumature emotive e psicologiche
- Decisioni strategiche a lungo termine
- Accountability e supporto motivazionale continuativo

Usa l'AI come strumento quotidiano di supporto e il consulente come guida strategica del tuo percorso.`,
      tips: [
        "L'AI ha accesso al tuo profilo completo: progressi nelle lezioni, esercizi in corso, feedback ricevuti e, se collegato, anche i tuoi dati finanziari reali. Sfrutta questa conoscenza chiedendo consigli personalizzati sulla tua situazione specifica.",
        "Quando fai domande, fornisci contesto. Invece di 'Come migliorare le vendite?', prova 'Vendo servizi B2B da €5000, il mio tasso di conversione è del 10%, come posso aumentarlo?'. Più dettagli = consigli migliori.",
        "Usa domande come 'Cosa devo fare oggi?' per ricevere un briefing giornaliero personalizzato che considera le tue scadenze, gli esercizi in sospeso e i prossimi obiettivi formativi.",
        "Le conversazioni vengono salvate automaticamente. Crea conversazioni separate per argomenti diversi (es: una per finanza, una per vendite, una per esercizi) per ritrovare facilmente le informazioni.",
        "Quando l'AI suggerisce azioni (aprire lezioni, esercizi o task), i link sono cliccabili e in blu. Questi collegamenti ti portano direttamente dove devi andare, risparmiando tempo di navigazione.",
        "Se hai collegato Percorso Capitale, l'AI può analizzare le tue transazioni, budget e conti reali. Chiedi analisi specifiche: 'Dove sto spendendo troppo questo mese?' o 'Quanto posso risparmiare entro fine anno?'"
      ]
    }
  },
  {
    id: "tasks",
    title: "Task & Riflessioni",
    icon: Calendar,
    color: "orange",
    path: "/client/daily-tasks",
    content: {
      intro: "Task & Riflessioni è il tuo diario digitale dove organizzi le attività quotidiane e rifletti sui progressi. È il luogo dove il lavoro diventa consapevolezza.",
      fullText: `## Il Tuo Diario di Crescita Quotidiana

Task & Riflessioni è molto più di una semplice to-do list. È uno strumento progettato per combinare l'organizzazione operativa con la riflessione strategica, creando un circolo virtuoso di azione e apprendimento.

### La Filosofia del Sistema

Molte persone gestiscono le attività quotidiane in modo meccanico: fanno la lista delle cose da fare, le completano, e passano oltre. Questo approccio ti fa essere produttivo, ma non necessariamente efficace o consapevole.

Il sistema Task & Riflessioni introduce un elemento fondamentale: la **riflessione quotidiana**. Ogni giorno non si conclude semplicemente con task completati, ma con un momento di analisi: cosa hai imparato? Quali sfide hai affrontato? Cosa farai diversamente domani?

Questa pratica, apparentemente semplice, è trasformativa. Ti costringe a estrarre insegnamenti dalle tue esperienze, a riconoscere pattern, a celebrare vittorie e a pianificare miglioramenti.

### Il Calendario Settimanale

La vista principale è un **calendario settimanale** che mostra tutti i tuoi task organizzati per giorno. Questa visualizzazione ti dà una panoramica immediata della settimana, permettendoti di bilanciare il carico di lavoro e evitare giorni sovraccarichi.

Ogni giorno nel calendario mostra:
- Il numero totale di task pianificati
- Quanti task hai già completato
- Una barra di progresso visuale
- Il tuo livello di energia registrato (se hai compilato la riflessione)

Cliccando su un giorno specifico, entri nel dettaglio e vedi l'elenco completo dei task per quella giornata.

### Creare e Gestire i Task

Aggiungere un nuovo task è semplicissimo: clicca sul simbolo **"+"** accanto al giorno desiderato. Si aprirà un campo dove puoi descrivere l'attività.

Quando crei task, sii **specifico e azionabile**. Invece di scrivere "Lavorare sul business", scrivi "Creare bozza email per promozione corso Maggio" o "Chiamare i 5 prospect della lista X".

Task specifici hanno due vantaggi: primo, è più facile iniziarli perché sai esattamente cosa fare; secondo, quando li completi, hai una sensazione di achievement più concreta.

Ogni task ha una **checkbox**. Quando completi l'attività, spunta la casella. Il sistema aggiorna automaticamente la barra di progresso del giorno e le statistiche complessive.

Puoi anche **modificare o eliminare** i task in qualsiasi momento. Se una priorità cambia, se un task diventa irrilevante o se devi riformularlo, hai pieno controllo.

### La Riflessione Giornaliera

Questa è la parte che distingue il sistema da una semplice lista di task. Alla fine di ogni giornata (o all'inizio del giorno successivo), dedica 5-10 minuti a compilare la **riflessione giornaliera**.

La riflessione è strutturata in diverse sezioni:

**Cosa Ho Imparato Oggi**: Questa è forse la domanda più potente. Ogni giorno, anche se apparentemente ordinario, contiene lezioni. Forse hai scoperto che lavorare al mattino presto ti rende più produttivo. O che delegare un certo tipo di task ti fa risparmiare ore. O che una particolare obiezione di un cliente nasconde sempre lo stesso problema di fondo.

Annotando queste lezioni, le cristallizzi. Non si perdono nel flusso continuo della quotidianità ma diventano parte della tua conoscenza consapevole.

**Le Sfide Affrontate**: Ogni giorno presenta ostacoli - tecnici, relazionali, motivazionali, organizzativi. Identificare esplicitamente queste sfide ti aiuta a riconoscere pattern. Se ogni giorno scrivi "ho procrastinato sulla chiamata commerciale", diventa evidente che c'è un blocco da affrontare.

Inoltre, rivedere le sfide superate in passato ti dà fiducia. Quando affronti una nuova difficoltà, puoi tornare indietro e vedere tutte le sfide precedenti che hai superato con successo.

**I Prossimi Passi**: Chiudi la giornata guardando avanti. Cosa farai domani? Quali sono le 2-3 priorità assolute? Questa domanda ti fa arrivare al giorno successivo con chiarezza, invece di improvvisare al mattino.

**Il Livello di Energia**: Una semplice valutazione numerica del tuo livello di energia e motivazione. Nel tempo, questo dato diventa prezioso. Puoi iniziare a notare pattern: forse il martedì hai sempre energia bassa (e quindi è meglio non pianificare task critici), o forse dopo un giorno molto produttivo tendi ad avere un calo (e quindi puoi pianificare task più leggeri).

### Usare i Dati Storici

Tutte le tue riflessioni passate rimangono **consultabili**. Questo crea un archivio incredibilmente prezioso della tua evoluzione.

Quando affronti una sfida simile a una che hai già superato in passato, puoi tornare alla riflessione di allora e vedere come l'hai risolta. Quando ti senti scoraggiato, puoi rileggere le vittorie celebrate settimane fa e ricordare quanto sei già progredito.

Periodicamente (una volta al mese, per esempio), è utile **rivedere le riflessioni** per identificare pattern più ampi. Ci sono lezioni che continuano a ripresentarsi? Ci sono sfide ricorrenti che richiedono un intervento più strutturato? Ci sono aree dove stai migliorando costantemente?

### Integrare Task & Riflessioni con il Resto del Percorso

Questo strumento non vive in isolamento. È profondamente integrato con tutto il resto:

Quando studi una lezione nell'Università, puoi aggiungere un task "Applicare la strategia X imparata oggi". Quando ricevi un feedback su un esercizio, puoi creare task specifici per implementare i suggerimenti.

Il consulente può vedere le tue riflessioni giornaliere (se scegli di condividerle) e usarle per capire meglio come stai procedendo, dove incontri difficoltà e come può supportarti meglio.

L'AI Assistant può analizzare i tuoi task e riflessioni per darti consigli personalizzati. Per esempio, se vede che menzioni ripetutamente "mancanza di tempo" nelle sfide, potrebbe suggerirti strategie di time management specifiche.

### Best Practices per Massimizzare i Benefici

**Costanza**: Il valore viene dalla pratica quotidiana. Anche nei giorni "vuoti", compila la riflessione. Anche se il giorno non ha portato grandi rivelazioni, il semplice atto di fermarsi a riflettere è prezioso.

**Onestà**: Le riflessioni sono per te. Non abbellire, non censurarti. Se hai procrastinato, scrivilo. Se hai avuto paura, ammettilo. Solo riconoscendo onestamente dove sei puoi lavorare per migliorare.

**Specificità**: Invece di "ho imparato cose utili", scrivi "ho imparato che quando inizio la giornata con la task più difficile, il resto scorre meglio". Dettagli concreti sono molto più utili di generalità.

**Azione**: Ogni riflessione dovrebbe portare a qualche azione futura. Se identifichi una sfida, crea un task per affrontarla. Se impari qualcosa di importante, pianifica come applicarlo sistematicamente.`,
      tips: [
        "Le riflessioni giornaliere sono il cuore del sistema. Dedica 10 minuti a fine giornata a compilarle con onestà. Questo esercizio di metacognizione trasforma le esperienze in apprendimenti consolidati.",
        "Quando crei task, sii specifico e azionabile. Invece di 'Lavorare sul marketing', scrivi 'Creare 3 post LinkedIn per la prossima settimana'. Task vaghi generano procrastinazione.",
        "Usa la valutazione del livello di energia per identificare pattern nel tempo. Se noti che certi giorni della settimana sei sempre più stanco, pianifica di conseguenza i task impegnativi.",
        "Rivedi le riflessioni passate mensilmente. Cerca pattern ricorrenti: lezioni che si ripresentano, sfide che si ripetono, aree dove stai migliorando costantemente. Questa visione d'insieme è preziosa.",
        "I task completati sono automaticamente visibili anche nella dashboard principale, dandoti un senso di progresso concreto ogni giorno.",
        "Condividi le riflessioni significative con il tuo consulente durante le sessioni. Sono materiale ricco per discussioni approfondite e per personalizzare ulteriormente il percorso."
      ]
    }
  },
  {
    id: "library",
    title: "Libreria",
    icon: Library,
    color: "green",
    path: "/client/library",
    content: {
      intro: "La Libreria è il tuo archivio completo di conoscenza. Qui trovi tutti i materiali formativi, organizzati e sempre accessibili.",
      fullText: `## La Tua Enciclopedia Personale del Business

La Libreria rappresenta il cuore della conoscenza del tuo percorso formativo. È una raccolta organizzata e completa di tutti i materiali di apprendimento: video lezioni, articoli approfonditi, guide PDF, presentazioni, templates e risorse pratiche.

### L'Organizzazione dei Contenuti

I contenuti sono strutturati per **categorie tematiche**. Quando accedi alla Libreria, la prima cosa che vedi è l'elenco dei corsi disponibili. Ogni corso rappresenta una macro-area di competenza: potrebbe essere "Finanza Personale e Aziendale", "Strategie di Vendita Avanzate", "Marketing Digitale", "Mindset dell'Imprenditore", e così via.

Questa organizzazione per corsi serve a raggruppare contenuti correlati in modo logico. Tutti i materiali su un tema specifico sono raccolti in un unico luogo, facilitando l'apprendimento sistematico.

Quando clicchi su un corso, accedi all'elenco completo delle lezioni al suo interno. Qui l'organizzazione diventa ancora più granulare: le lezioni sono categorizzate per **sottocategoria** e **livello di difficoltà**.

### Le Sottocategorie e i Livelli

Le **sottocategorie** rappresentano sotto-temi specifici all'interno di un corso. Per esempio, un corso su "Finanza" potrebbe avere sottocategorie come "Gestione Liquidità", "Budget e Previsioni", "Investimenti", "Ottimizzazione Fiscale".

Questa strutturazione ti permette di navigare direttamente verso gli argomenti che ti interessano o che sono più rilevanti per la tua situazione attuale.

Ogni lezione ha anche un **livello di difficoltà** assegnato:

- **Base**: Lezioni introduttive che spiegano concetti fondamentali. Ideali se ti avvicini per la prima volta a un argomento.
- **Intermedio**: Lezioni che presuppongono una conoscenza di base e approfondiscono strategie e applicazioni pratiche.
- **Avanzato**: Contenuti complessi per chi ha già dimestichezza con l'argomento e vuole ottimizzare o specializzarsi.

Questo sistema di livelli ti aiuta a seguire una progressione naturale di apprendimento: iniziare dalle basi, consolidarle, e poi approfondire.

### I Filtri e la Ricerca

La sidebar sinistra contiene potenti strumenti di navigazione:

I **Filtri per Sottocategoria** ti permettono di visualizzare solo le lezioni di un sotto-argomento specifico. Se stai lavorando sui budget questa settimana, puoi filtrare solo quelle lezioni e concentrarti esclusivamente su quel tema.

I **Filtri per Livello** ti aiutano a selezionare contenuti appropriati al tuo livello attuale di conoscenza. Se sei già esperto in un'area, puoi nascondere le lezioni Base e vedere solo Intermedie e Avanzate.

La **Barra di Ricerca** è incredibilmente utile quando cerchi informazioni su un argomento specifico. Invece di navigare manualmente attraverso categorie e sottocategorie, puoi semplicemente cercare "obiezioni prezzo" o "gestione cash flow" e il sistema ti mostrerà tutte le lezioni pertinenti.

### Studiare una Lezione

Quando clicchi su una lezione, si apre la pagina dedicata con tutto il materiale formativo. La struttura tipica include:

**Il Titolo e la Descrizione**: Una chiara indicazione di cosa tratta la lezione e cosa imparerai. Leggi sempre la descrizione prima di iniziare - ti dà il contesto necessario per massimizzare l'apprendimento.

**Il Contenuto Principale**: Può essere testo formativo strutturato, video lezioni, o una combinazione di entrambi. I contenuti sono progettati per essere chiari e pratici, con esempi concreti e applicazioni reali.

**Video Lezioni**: Quando una lezione include video, lo vedrai chiaramente indicato con un'icona specifica. I video sono particolarmente utili per concetti visivi, per vedere dimostrazioni pratiche o per imparare attraverso esempi narrati. Molte persone trovano più facile assorbire informazioni complesse quando le vedono spiegate in video piuttosto che leggendole.

**Materiali Scaricabili**: Alcune lezioni includono PDF, worksheets, templates o checklist scaricabili. Questi sono strumenti pratici che puoi stampare, compilare e usare nel tuo lavoro quotidiano. Un template ben fatto può farti risparmiare ore di lavoro.

**Allegati e Risorse Aggiuntive**: Link a risorse esterne, tools consigliati, esempi di casi studio. Questi materiali supplementari arricchiscono l'apprendimento e ti danno risorse pratiche da usare.

### Il Sistema di Progresso

Quando completi lo studio di una lezione, clicca sul pulsante **"Segna come Letto"**. Questo semplice atto ha diverse conseguenze positive:

Il sistema aggiorna automaticamente le **statistiche del corso**, mostrando quante lezioni hai completato rispetto al totale. Questa visualizzazione ti dà un senso di progresso concreto e ti motiva a continuare.

La tua percentuale di completamento viene tracciata e visualizzata con una **barra di progresso colorata**. Vedere questa barra riempirsi progressivamente è sorprendentemente motivante.

Il tuo progresso nella Libreria si riflette anche nelle **statistiche complessive** della dashboard principale, contribuendo al tuo score formativo generale.

Importante: puoi sempre rivedere lezioni già marcate come lette. L'apprendimento non è lineare - è normale tornare su concetti già studiati per approfondirli, rinfrescare la memoria o applicarli in modo nuovo.

### Quando e Come Usare la Libreria

La Libreria funziona in modo sinergico con l'Università. Molte lezioni dell'Università hanno collegamenti diretti a contenuti della Libreria. Quando studi un modulo universitario e vedi il simbolo 📖, cliccando su "Vai alla Lezione" atterri direttamente sul materiale corrispondente nella Libreria.

Ma la Libreria non è solo un supporto all'Università - è anche una risorsa autonoma. Puoi:

**Esplorare liberamente** argomenti che ti incuriosiscono, anche se non sono nel tuo percorso universitario corrente.

**Approfondire** temi specifici quando ne hai bisogno nel tuo business reale. Se domani devi presentare un'offerta a un cliente, puoi cercare nella Libreria tutte le lezioni su "Presentazione Offerte" e studiarle immediatamente.

**Rivedere** concetti già studiati quando hai bisogno di un refresh o quando vuoi applicarli in modo nuovo.

**Anticipare** argomenti che studierai in futuro nell'Università, se hai particolare interesse o urgenza.

### Richiedere Nuovi Contenuti

Non trovi quello che cerchi? Usa il pulsante **"Richiedi Contenuto"**. Questa funzionalità ti permette di suggerire al consulente nuove lezioni o argomenti che vorresti fossero aggiunti alla Libreria.

Il consulente raccoglie queste richieste e le usa per arricchire continuamente la Libreria con contenuti sempre più rilevanti per te e altri clienti con esigenze simili. È un sistema che si evolve basandosi sui bisogni reali.

### Massimizzare il Valore dell'Apprendimento

La Libreria è più efficace quando la usi in modo **attivo** piuttosto che passivo. Non limitarti a guardare video o leggere articoli - prendi note, rifletti su come applicare i concetti al tuo business, crea piani d'azione concreti.

Dopo aver studiato una lezione, chiediti sempre: "Come posso applicare questo nei prossimi 7 giorni?". Crea task specifici nella sezione Task & Riflessioni per implementare ciò che hai imparato.

Usa l'AI Assistant per **approfondire** concetti che non ti sono chiari o per fare brainstorming su come applicare strategie al tuo caso specifico.

Torna periodicamente su lezioni già studiate. L'apprendimento avviene a spirale - quando rivedi un concetto dopo settimane o mesi, lo comprendi a un livello più profondo perché hai più contesto ed esperienza.`,
      tips: [
        "Le lezioni con video hanno un'icona dedicata. I video sono ideali per apprendimento visivo, dimostrazioni pratiche e concetti complessi. Guardali in un ambiente senza distrazioni per massimizzare la comprensione.",
        "Scarica i PDF e i templates allegati alle lezioni. Stampali o salvali in una cartella dedicata. Questi strumenti pratici possono farti risparmiare ore di lavoro quando devi creare documenti da zero.",
        "Il progresso di ogni categoria viene visualizzato con una barra colorata in tempo reale. Usa questa visualizzazione per bilanciare il tuo apprendimento tra diverse aree di competenza.",
        "La funzione di ricerca è potentissima. Invece di navigare manualmente, cerca direttamente argomenti specifici: 'gestione obiezioni', 'pricing strategico', 'email marketing'. Risparmierai tempo prezioso.",
        "Quando completi una lezione, non segnarla semplicemente come letta. Fermati 2 minuti a riflettere: cosa ho imparato? Come lo applicherò? Poi crea un task concreto per implementare quell'apprendimento.",
        "Usa 'Richiedi Contenuto' quando senti che manca materiale su un argomento che ti serve. Il consulente raccoglie queste richieste e arricchisce costantemente la Libreria per renderla sempre più utile."
      ]
    }
  },
  
  {
    id: "consultations",
    title: "Consulenze",
    icon: MessageCircle,
    color: "green",
    path: "/client/consultations",
    content: {
      intro: "Le Consulenze sono i tuoi appuntamenti one-to-one con il consulente. Momenti dedicati esclusivamente a te, ai tuoi obiettivi e alle tue sfide.",
      fullText: `## Il Tuo Tempo con il Consulente

Le Consulenze rappresentano il momento più personale e ad alto valore del tuo percorso. È qui che la relazione con il consulente si concretizza in conversazioni strategiche, decisioni importanti e piani d'azione personalizzati.

### Cosa Sono le Consulenze

A differenza di tutto il resto della piattaforma (che puoi usare in modo autonomo e asincrono), le consulenze sono **incontri sincroni** con il consulente. Possono essere video call, chiamate telefoniche o, in alcuni casi, incontri di persona.

Ogni consulenza ha una **durata definita** (tipicamente 30, 60 o 90 minuti) e si focalizza su argomenti specifici concordati in anticipo. Non sono chiacchierate casuali, ma sessioni strategiche con obiettivi chiari.

### Le Prossime Consulenze

Quando accedi alla sezione Consulenze, vedi per prima cosa **"Prossime Consulenze"** - l'elenco di tutti gli appuntamenti programmati in ordine cronologico.

Ogni consulenza mostra:

**Data e Ora**: Esattamente quando si terrà l'incontro. Questi appuntamenti sono nel tuo fuso orario, quindi non ci sono ambiguità.

**Durata**: Quanto tempo hai a disposizione. Conoscere la durata ti aiuta a prepararti adeguatamente.

**Note della Consulenza**: Il consulente spesso inserisce qui gli argomenti che verranno trattati, domande preparatorie per te, o materiali da rivedere prima dell'incontro. Leggi sempre queste note in anticipo.

**Stato Visuale**: Le consulenze del giorno corrente sono evidenziate in arancione, rendendo immediatamente visibile se hai un appuntamento imminente.

### Come Prepararsi a una Consulenza

La preparazione è fondamentale per massimizzare il valore del tempo con il consulente. Ecco un processo efficace:

**Rivedi le Note**: Leggi attentamente le note lasciate dal consulente. Se ha indicato argomenti specifici, riflettici in anticipo. Se ha chiesto di preparare dati o materiali, fallo prima della call.

**Prepara Domande**: Tieni una lista di domande o argomenti che vuoi assolutamente discutere. Durante il lavoro quotidiano, quando ti vengono dubbi o idee, annotateli in vista della prossima consulenza invece di dimenticarli.

**Rivedi i Progressi**: Guarda cosa hai fatto dall'ultima consulenza - esercizi completati, lezioni studiate, item della Roadmap completati. Questo contesto aiuta entrambi a rendere la conversazione più produttiva.

**Definisci Obiettivi**: Cosa vuoi aver ottenuto al termine di questa consulenza? Una decisione presa? Un piano creato? Chiarezza su una sfida? Avere obiettivi chiari ti mantiene focalizzato.

**Sii Puntuale**: Entra nella call (o presentati all'appuntamento) in orario. Il tempo è limitato e prezioso - ogni minuto conta.

### Durante la Consulenza

Durante l'incontro, ricorda:

**Sii Presente**: Elimina distrazioni. Non controllare email, non rispondere al telefono. Questi 60 minuti sono un investimento su di te - rispettalo.

**Sii Onesto**: Se qualcosa non funziona, dillo. Se hai procrastinato, ammettilo. Se hai dubbi, esprimili. Il consulente può aiutarti solo se ha la piena visione della situazione reale.

**Prendi Note**: Annota decisioni prese, suggerimenti ricevuti, prossimi passi concordati. La memoria è fallibile - le note scritte durante la call saranno preziose nei giorni successivi.

**Fai Domande**: Se qualcosa non è chiaro, chiedi immediatamente. Non uscire dalla call con dubbi irrisolti per paura di sembrare poco preparato.

**Co-Crea Soluzioni**: La consulenza non è una lezione unidirezionale. È una conversazione strategica. Contribuisci attivamente con le tue idee, esperienze e prospettive.

### Lo Storico delle Consulenze

Tutte le consulenze passate vengono archiviate nella sezione **"Storico"**. Questa è una risorsa incredibilmente preziosa.

Ogni consulenza completata include:

**Riassunto**: Il consulente scrive un riassunto di cosa avete discusso, quali decisioni avete preso, quali insights sono emersi.

**Prossimi Passi**: Lista concreta di azioni da intraprendere prima della prossima consulenza. Questo trasforma la conversazione in azione.

**Feedback e Riflessioni**: Commenti del consulente su progressi notati, aree di miglioramento, osservazioni importanti.

**Stato**: Indica se la consulenza si è svolta come programmato o se è stata cancellata/riprogrammata.

### Usare lo Storico in Modo Strategico

Non limitarti a vedere lo storico come un archivio passivo. Usalo attivamente:

**Rivedi Periodicamente**: Una volta al mese, rileggi i riassunti delle consulenze precedenti. Scoprirai di aver dimenticato insights importanti che, riletti, assumono nuovo significato con la prospettiva acquisita.

**Verifica l'Implementazione**: Controlla i "prossimi passi" delle consulenze passate. Li hai effettivamente completati? Se no, perché? Questo audit è prezioso per capire dove stai bloccando.

**Traccia l'Evoluzione**: Confronta i temi discussi mesi fa con quelli attuali. Vedrai chiaramente come sei evoluto, quali problemi hai superato, quali nuove sfide hai iniziato ad affrontare.

**Prepara le Call Future**: Prima di una nuova consulenza, rileggi l'ultima. Questo crea continuità e ti permette di ripartire da dove avevate lasciato invece di ricominciare da capo.

### Le Consulenze Cancellate

A volte le consulenze vengono cancellate o riprogrammate. Questo può succedere per imprevisti di entrambe le parti. Nello storico, le consulenze cancellate sono chiaramente segnalate.

Se una consulenza viene cancellata, contatta il consulente per riprogrammarla appena possibile. La continuità degli incontri è importante per mantenere momentum nel percorso.

### Massimizzare il ROI delle Consulenze

Le consulenze sono probabilmente l'elemento più costoso (in termini di tempo e risorse) del tuo percorso. Massimizzarne il valore è fondamentale:

**Arriva Preparato**: Una consulenza con preparazione zero produce 30% del valore di una consulenza preparata attentamente.

**Segui i Suggerimenti**: Ricevere consigli e non implementarli è uno spreco. Prendi i suggerimenti del consulente, trasformali in task concreti e agisci.

**Crea Accountability**: Comunica al consulente cosa ti impegni a fare prima della prossima call. Questa accountability pubblica aumenta drammaticamente la probabilità di esecuzione.

**Usa gli Strumenti di Supporto**: Tra una consulenza e l'altra, usa l'AI Assistant per questioni operative, gli esercizi per praticare, le riflessioni per processare. Questo libera il tempo della consulenza per discussioni strategiche ad alto valore.

### L'Integrazione con il Percorso

Le consulenze non sono eventi isolati ma parte di un ecosistema integrato:

Durante le consulenze, il consulente potrebbe:
- Assegnarti nuovi esercizi basati su sfide emerse
- Aggiornare la tua Roadmap con nuovi obiettivi
- Suggerirti lezioni specifiche da studiare
- Modificare il percorso universitario in base ai tuoi progressi

Dopo ogni consulenza, aspettati aggiornamenti in altre sezioni della piattaforma che riflettono decisioni prese durante l'incontro.`,
      tips: [
        "Le consulenze del giorno sono evidenziate in arancione nella lista. Controlla ogni mattina se hai appuntamenti - imposta anche un promemoria personale 30 minuti prima per prepararti mentalmente.",
        "Le note delle consulenze future sono preparate dal consulente in anticipo. Leggile almeno 24 ore prima dell'incontro per avere tempo di riflettere sugli argomenti e prepararti adeguatamente.",
        "Durante ogni consulenza, prendi note scritte a mano (non al computer). La scrittura manuale aumenta la ritenzione. Dopo la call, trascrivi i punti chiave e crea task specifici.",
        "I riassunti delle consulenze passate sono tesori nascosti. Una volta al mese, dedicaci 30 minuti: rileggi tutti i riassunti recenti e estrai i pattern ricorrenti. Vedrai chiaramente la tua evoluzione.",
        "Se una consulenza viene cancellata, non aspettare passivamente. Prendi iniziativa e contatta il consulente per riprogrammare. Il momentum è prezioso - non lasciare che si perda.",
        "Prima di ogni call, prepara una lista scritta di 3-5 punti che vuoi assolutamente discutere. Questo ti assicura di non dimenticare nulla di importante nel flusso della conversazione."
      ]
    }
  },
  {
    id: "calendar",
    title: "Calendario",
    icon: CalendarDays,
    color: "teal",
    path: "/client/calendar",
    content: {
      intro: "Il Calendario è il tuo centro di comando per organizzare eventi, appuntamenti e visualizzare il tuo percorso produttivo in un'unica vista integrata.",
      fullText: `## Il Tuo Centro di Organizzazione Temporale

Il Calendario non è una semplice agenda digitale - è un hub intelligente che unifica tutti gli aspetti della tua gestione del tempo: eventi di lavoro, appuntamenti personali, consulenze programmate e check-in di produttività Momentum.

### La Vista Calendario Integrata

Quando accedi al Calendario, trovi una vista mensile pulita e moderna ispirata a Google Calendar. Ogni giorno mostra:

**Eventi Personali e Professionali**: Tutti gli appuntamenti che crei manualmente - riunioni, deadline, attività programmate. Ogni evento può avere un titolo, descrizione, orario di inizio e fine, e può essere configurato come evento giornaliero (all-day) o con orari specifici.

**Consulenze Programmate**: Gli appuntamenti one-to-one con il tuo consulente appaiono automaticamente nel calendario. Sono sincronizzati dalla sezione Consulenze e vengono visualizzati con un colore distintivo per renderli immediatamente riconoscibili.

**Check-in Momentum**: Se hai attivato il tracking Momentum, i tuoi check-in di produttività vengono visualizzati come eventi colorati nel calendario. I check-in produttivi appaiono in verde, le pause in arancione. Puoi attivare/disattivare la visualizzazione dei check-in usando il toggle dedicato.

### Creare e Gestire Eventi

Aggiungere un nuovo evento è intuitivo. Puoi:

**Cliccare su "Nuovo Evento"**: Si apre un form dove inserire tutti i dettagli - titolo, descrizione, data/ora inizio e fine, se è un evento che dura tutto il giorno.

**Cliccare direttamente su una Data**: Cliccando su un giorno nel calendario, si apre automaticamente il form di creazione con quella data preselezionata, risparmiant un passaggio.

**Modificare Eventi Esistenti**: Cliccando su un evento già creato, puoi visualizzarne i dettagli completi e modificarlo o eliminarlo se necessario.

Ogni evento che crei viene salvato istantaneamente e sincronizzato con la tua vista calendario.

### L'Integrazione con Momentum

Il Calendario è profondamente integrato con il sistema Momentum di tracking produttività. Quando registri check-in durante la giornata (ad esempio "Sto lavorando sul progetto X" o "Pausa pranzo"), questi appaiono automaticamente nel calendario come piccoli eventi colorati.

Questa integrazione visual ti permette di:

**Vedere a Colpo d'Occhio la Tua Produttività**: Guardando il calendario, vedi immediatamente quali giorni sono stati più produttivi (molti eventi verdi) e quali meno attivi.

**Correlare Eventi e Produttività**: Puoi notare pattern interessanti - ad esempio, i giorni con meno riunioni programmate tendono a essere più produttivi? O al contrario, una struttura di appuntamenti ti aiuta a rimanere focalizzato?

**Pianificare Meglio**: Vedendo storicamente quando sei stato più produttivo, puoi pianificare eventi importanti negli slot temporali in cui performi meglio.

Puoi controllare se visualizzare o nascondere i check-in Momentum nel calendario usando il toggle apposito, personalizzando la vista in base alle tue preferenze.

### Navigazione e Viste

Il Calendario offre diversa modalità di navigazione:

**Vista Mensile**: La vista predefinita che mostra l'intero mese corrente con tutti gli eventi di colpo d'occhio.

**Vista Settimanale**: Utile quando vuoi concentrarti su una singola settimana e vedere più dettagli su ogni giorno.

**Vista Giornaliera**: Perfetta per pianificare nel dettaglio una giornata specifica, mostrando la timeline ora per ora.

Puoi navigare tra mesi diversi usando le frecce, o tornare rapidamente al giorno corrente con il pulsante "Oggi".

### Sincronizzazione e Notifiche

Tutti gli eventi del calendario sono sincronizzati in tempo reale. Se il consulente crea una nuova consulenza, questa appare immediatamente nel tuo calendario senza bisogno di aggiornare la pagina.

Gli eventi imminenti (nelle prossime 24 ore) vengono evidenziati visivamente con colori e indicatori specifici, aiutandoti a non perdere appuntamenti importanti.

### Best Practices per Uso Efficace

**Pianifica con Anticipo**: Alla fine di ogni settimana, dedica 15 minuti a pianificare gli eventi della settimana successiva. Questo ti dà chiarezza e controllo.

**Usa Descrizioni Ricche**: Nei campi descrizione degli eventi, includi informazioni utili - link a documenti, domande da preparare, materiali necessari. Il calendario diventa così non solo un promemoria di quando, ma anche di cosa e come.

**Blocca Tempo per Lavoro Profondo**: Crea eventi "fittizi" per bloccare slot di tempo dedicati a lavoro concentrato. Questo ti protegge dall'overbooking e garantisce spazio per attività strategiche.

**Rivedi Regolarmente**: Una volta al mese, rivedi il calendario del mese passato. Identifica pattern - hai rispettato gli impegni? Ci sono stati giorni sovraccarichi? Usa questi insight per pianificare meglio il futuro.`,
      tips: [
        "Gli eventi possono essere di due tipi: normali (con orario specifico) o 'tutto il giorno'. Usa eventi tutto il giorno per deadline, compleanni o giorni speciali che non hanno un orario preciso.",
        "I check-in Momentum vengono visualizzati automaticamente come piccoli eventi colorati. Verde = produttivo, Arancione = pausa. Usa il toggle per mostrarli/nasconderli in base alla chiarezza visiva che preferisci.",
        "Le consulenze programmate appaiono automaticamente sincronizzate dalla sezione Consulenze. Non duplicarle manualmente nel calendario - si aggiorneranno da sole.",
        "Clicca su qualsiasi evento esistente per vedere i dettagli completi, modificarlo o eliminarlo. La modifica è immediata e sincronizzata ovunque.",
        "Usa il pulsante 'Oggi' per tornare rapidamente alla vista del giorno corrente quando stai navigando tra mesi diversi. Risparmia tempo invece di cliccare più volte le frecce.",
        "Il calendario è responsive e funziona perfettamente su mobile. Puoi consultarlo e aggiungere eventi anche dal telefono quando sei fuori ufficio."
      ]
    }
  },
  {
    id: "momentum",
    title: "Momentum",
    icon: Zap,
    color: "violet",
    path: "/client/calendar?tab=momentum",
    content: {
      intro: "Momentum è il tuo sistema di tracking produttività che ti aiuta a costruire abitudini vincenti, monitorare il tuo progresso e mantenere lo slancio verso i tuoi obiettivi.",
      fullText: `## Il Motore della Tua Produttività Consapevole

Momentum è molto più di un semplice tracker di attività. È un sistema progettato per aiutarti a costruire consapevolezza su come usi il tuo tempo, mantenere streak di produttività e raggiungere obiettivi concreti attraverso check-in regolari e metriche visibili.

### La Filosofia di Momentum

Molte persone lavorano duramente ma senza consapevolezza. Momentum ribalta questo approccio: invece di arrivare a fine giornata chiedendoti "dove è andato il tempo?", registri regolarmente cosa stai facendo durante la giornata.

Questo semplice atto di fermarsi e annotare "Sto lavorando su X" crea **interruzioni intenzionali** che ti mantengono focalizzato e consapevole. Inoltre, nel tempo, accumuli dati preziosi su come usi realmente il tuo tempo.

### I Check-in di Produttività

Il cuore di Momentum sono i **check-in regolari**. Durante la giornata, registri periodicamente cosa stai facendo. Ogni check-in richiede solo 30 secondi:

**Cosa Sto Facendo**: Descrivi brevemente l'attività corrente - "Scrivendo proposta per cliente X", "Riunione di team", "Pausa caffè".

**Tipo di Attività**: Scegli se è tempo produttivo (lavoro focalizzato, task importanti) o una pausa (pranzo, riposo, scroll social).

**Note Opzionali**: Se vuoi, aggiungi dettagli - livello di energia, sfide incontrate, insights emersi.

Il sistema ti suggerisce automaticamente quando fare check-in basandosi su intervalli intelligenti (tipicamente ogni 30-60 minuti durante l'orario lavorativo), ma puoi sempre crearne uno manualmente quando cambi attività.

### Le Metriche Chiave

Momentum traccia diverse metriche che ti danno una visione chiara della tua produttività:

**Streak Giornaliero**: Quanti giorni consecutivi hai fatto almeno un check-in. Questa metrica è potente psicologicamente - non vuoi "rompere la catena". Vedere uno streak di 30+ giorni ti motiva a continuare.

**Check-in Oggi**: Quanti check-in hai registrato oggi. Ti aiuta a capire se stai monitorando abbastanza frequentemente (idealmente 6-10 check-in in una giornata lavorativa di 8 ore).

**Punteggio Produttività**: Una percentuale calcolata in base alla proporzione tra tempo produttivo e pause. Non è una misura rigida di "quanto hai lavorato" ma un indicatore di bilanciamento - troppo basso indica procrastinazione, troppo alto (sempre 100%) indica rischio burnout.

Queste metriche sono sempre visibili nell'header unificato quando sei nella sezione Calendario/Momentum, dandoti feedback in tempo reale.

### Visualizzare il Progresso

La dashboard Momentum offre diverse visualizzazioni:

**Andamento Settimanale**: Un grafico che mostra il tuo punteggio di produttività giorno per giorno nell'ultima settimana. Puoi vedere immediatamente pattern - forse il lunedì parti sempre lento, o il venerdì cali di energia.

**Obiettivi Attivi**: Se hai impostato obiettivi specifici (es: "Fare almeno 8 check-in al giorno per 30 giorni"), vedi qui il progresso in tempo reale con barre di avanzamento visive.

**Check-in Recenti**: Una lista cronologica dei tuoi ultimi check-in, permettendoti di rivedere rapidamente cosa hai fatto nelle ultime ore o giorni.

**Calendario Integrato**: Puoi vedere i tuoi check-in direttamente nel calendario principale come eventi colorati, creando una timeline visuale del tuo tempo.

### Impostare e Raggiungere Obiettivi

La sezione Obiettivi ti permette di definire target specifici e misurabili:

**Obiettivi di Streak**: "Mantieni almeno un check-in al giorno per 60 giorni". Perfetto per costruire l'abitudine di tracking.

**Obiettivi di Volume**: "Fai almeno 50 check-in questa settimana". Utile per assicurarti di monitorare frequentemente.

**Obiettivi di Produttività**: "Raggiungi un punteggio medio del 75% per il mese". Bilancia lavoro ed energie.

Quando crei un obiettivo, il sistema lo traccia automaticamente e ti mostra i progressi. Raggiungere obiettivi viene celebrato con notifiche e badge motivazionali.

### I Promemoria Intelligenti

Momentum può inviarti **promemoria automatici** a intervalli regolari durante la giornata per ricordarti di fare check-in. Nelle impostazioni puoi configurare:

**Frequenza**: Ogni quanto ricevere promemoria (30min, 1h, 2h, etc.)

**Orario Attivo**: In quali ore della giornata ricevere promemoria (es: solo 9-18 nei giorni lavorativi)

**Canale**: Notifiche in-app, email, o entrambi

I promemoria non sono invasivi - sono gentili nudge che ti riportano alla consapevolezza quando sei immerso nel lavoro.

### Integrare Momentum nel Flusso Quotidiano

L'efficacia di Momentum dipende dalla costanza. Ecco un flusso tipo:

**Mattina (9:00)**: Check-in iniziale - "Inizio giornata, revisione task e priorità". Tipo: Produttivo.

**Mid-mattina (10:30)**: Check-in - "Lavorando su proposta cliente X". Produttivo.

**Pausa (12:00)**: Check-in - "Pausa pranzo". Pausa.

**Pomeriggio (14:00)**: Check-in - "Riunione con team marketing". Produttivo.

**Fine giornata (18:00)**: Check-in finale - "Chiusura giornata, review progressi". Produttivo.

Questo pattern ti dà visibilità completa su dove è andato il tempo, mantiene lo streak, e fornisce dati per analisi.

### Analisi e Pattern

Dopo alcune settimane di tracking costante, emergeranno **pattern preziosi**:

- A che ora del giorno sei più produttivo? (Spesso mattina presto o tardo pomeriggio)
- Quali tipi di attività ti fanno perdere più tempo?
- Ci sono giorni della settimana costantemente meno produttivi?
- Come correlano riunioni/pause con produttività?

Usa questi insight per **ottimizzare la tua giornata**: pianifica task complessi nei tuoi orari di picco, limita riunioni nei giorni dove tendi a essere meno energico, struttura pause intenzionali invece di farle casuali.

### Privacy e Controllo

I tuoi dati Momentum sono completamente privati. Solo tu (e il tuo consulente se scegli di condividerli) potete vederli. Puoi eliminare check-in singoli o modificarli se hai fatto errori.

Il sistema è pensato per essere un **supporto**, non un controllo. L'obiettivo non è farti lavorare di più, ma farti lavorare con più consapevolezza ed equilibrio.`,
      tips: [
        "Lo streak giornaliero è incredibilmente motivante. Non rompere la catena! Anche nei weekend o giorni di riposo, fai almeno un check-in (anche se è 'Giorno di riposo completo') per mantenere lo streak.",
        "Check-in frequenti (ogni 30-60min) sono ideali. Non aspettare troppo tra un check-in e l'altro o dimenticherai cosa hai fatto. Usa i promemoria automatici per costruire l'abitudine.",
        "Il punteggio di produttività non dovrebbe mai essere sempre 100%. Pause sono essenziali per sostenibilità. Cerca un range sano tipo 70-85% che bilancia lavoro e recupero.",
        "Guarda l'andamento settimanale ogni venerdì. Identifica pattern: giorni deboli, orari produttivi, correlazioni con eventi. Usa questi insight per pianificare la settimana successiva meglio.",
        "Gli obiettivi trasformano il tracking da passivo ad attivo. Imposta sempre almeno un obiettivo attivo - ti dà un target concreto da raggiungere e celebrare.",
        "I check-in possono avere note opzionali. Usale per registrare insights o sfide. Dopo mesi, rileggere queste note ti mostra quanto sei cresciuto e superato ostacoli."
      ]
    }
  },
  {
    id: "settings",
    title: "Impostazioni",
    icon: Settings,
    color: "gray",
    path: "/client/settings",
    content: {
      intro: "Le Impostazioni ti permettono di configurare integrazioni esterne che potenziano l'intelligenza dell'AI Assistant con i tuoi dati reali.",
      fullText: `## Potenziare l'AI con i Tuoi Dati Reali

La sezione Impostazioni potrebbe sembrare tecnica e secondaria, ma in realtà nasconde una funzionalità incredibilmente potente: la possibilità di collegare i tuoi **dati finanziari reali** all'AI Assistant.

### L'Integrazione con Percorso Capitale

Percorso Capitale è una piattaforma di gestione finanziaria personale e aziendale. Se la usi per tracciare le tue finanze, puoi collegarla a questa piattaforma formativa.

Quando colleghi Percorso Capitale, accade qualcosa di trasformativo: l'AI Assistant smette di essere un consulente generico e diventa un **advisor che conosce la tua situazione finanziaria reale**.

### Cosa Significa Avere Dati Finanziari Integrati

Senza l'integrazione, se chiedi all'AI "Come posso migliorare il mio budget?", riceverai consigli generici validi per chiunque.

Con l'integrazione attiva, la stessa domanda produce risultati radicalmente diversi. L'AI può:

**Analizzare i Tuoi Conti Reali**: Sa esattamente quanto hai in ogni conto corrente, quanto in risparmi, quanto in investimenti. Può darti consigli basati sulla tua liquidità effettiva.

**Studiare i Tuoi Budget**: Vede i tuoi budget per categoria (marketing, operatività, personale, etc.) e può confrontare quanto pianificato vs quanto effettivamente speso. Può identificare dove stai sforando e suggerire ottimizzazioni concrete.

**Esaminare le Tue Transazioni**: Ha accesso a tutte le tue entrate e uscite. Può identificare pattern di spesa, individuare costi ricorrenti inutili, suggerire dove tagliare.

**Valutare i Tuoi Investimenti**: Se hai investimenti tracciati in Percorso Capitale, l'AI può analizzare la performance, il rischio, la diversificazione e darti feedback strategico.

**Monitorare i Tuoi Obiettivi Finanziari**: Se hai impostato obiettivi (es: "risparmiare €10.000 entro giugno"), l'AI può tracciare i progressi e suggerirti aggiustamenti per rimanere in pista.

### Come Collegare l'Account

Il processo è semplice ma richiede attenzione:

**Inserisci le Credenziali**: Nella sezione Impostazioni, troverai campi per email e password del tuo account Percorso Capitale. Inseriscili esattamente come li usi per accedere a Percorso Capitale.

**Testa la Connessione**: Usa il pulsante "Testa Connessione" per verificare che le credenziali siano corrette. Il sistema proverà ad accedere a Percorso Capitale e ti darà un feedback immediato.

**Verifica il Successo**: Se la connessione funziona, vedrai un messaggio di conferma. Da quel momento, l'AI Assistant ha accesso ai tuoi dati finanziari.

**Mantieni Aggiornate le Credenziali**: Se cambi password su Percorso Capitale, ricorda di aggiornarla anche qui. Altrimenti l'integrazione smetterà di funzionare.

### Sicurezza e Privacy

È naturale avere preoccupazioni sulla sicurezza quando condividi credenziali finanziarie. Ecco come funziona:

**Crittografia**: Le tue credenziali vengono crittografate prima di essere salvate nel database. Nessuno, nemmeno gli amministratori della piattaforma, può leggerle in chiaro.

**Accesso Limitato**: L'AI usa le credenziali solo per importare dati da Percorso Capitale. Non può modificare nulla, non può fare transazioni, non può alterare i tuoi budget. È accesso in sola lettura.

**Nessuna Condivisione**: I tuoi dati finanziari non vengono mai condivisi con terze parti. Rimangono tra te, il sistema e il tuo consulente (se scegli di condividere insights con lui durante le consulenze).

**Disconnessione in Qualsiasi Momento**: Puoi disconnettere l'integrazione quando vuoi. Basta rimuovere le credenziali dalle Impostazioni e l'AI perderà immediatamente l'accesso.

### Come Cambia l'Esperienza con l'AI

Con l'integrazione attiva, le conversazioni con l'AI diventano incredibilmente concrete:

**Tu**: "Dove sto spendendo troppo questo mese?"
**AI**: "Analizzando le tue transazioni di ottobre, vedo che hai speso €850 in 'Servizi Software', che è il 40% sopra il tuo budget di €600 per questa categoria. I principali colpevoli sono: [lista specifica]."

**Tu**: "Posso permettermi di assumere un assistente part-time?"
**AI**: "Basandomi sulla tua liquidità attuale di €12.450 e il tuo flusso di cassa medio degli ultimi 3 mesi (+€3.200/mese), un assistente part-time a €1.000/mese è sostenibile, ma ti consiglio di mantenere un buffer di 6 mesi di spese operative."

**Tu**: "Come sta performando il mio portfolio investimenti?"
**AI**: "Il tuo portfolio è cresciuto del 7.3% negli ultimi 6 mesi, battendo l'indice di riferimento del 5.1%. Tuttavia, hai il 78% concentrato in azioni tech, che rappresenta un rischio. Considera di diversificare."

Vedi la differenza? Non sono più consigli generici ma analisi precise sulla tua situazione.

### Quando è Particolarmente Utile

Ci sono momenti specifici in cui l'integrazione diventa preziosa:

**Pianificazione Budget Annuale**: L'AI può analizzare le spese dell'anno precedente e aiutarti a creare un budget realistico per l'anno successivo.

**Decisioni di Investimento**: Prima di fare un investimento importante nel business (assumere, comprare strumenti, investire in marketing), l'AI può simulare l'impatto sul tuo cash flow.

**Ottimizzazione Costi**: Periodicamente, chiedi all'AI di analizzare tutte le tue spese ricorrenti e identificare dove puoi risparmiare senza impattare le operazioni.

**Tracciamento Obiettivi**: Se hai obiettivi finanziari (lanciare un prodotto che genera €X, raggiungere €Y di risparmi), l'AI può darti aggiornamenti regolari sui progressi.

**Gestione Cash Flow**: Per chi ha entrate variabili (freelance, consulenti), l'AI può aiutare a pianificare i mesi magri basandosi su pattern storici.

### Se Non Usi Percorso Capitale

Se non hai un account Percorso Capitale, puoi comunque usare l'AI Assistant efficacemente. Semplicemente, quando fai domande finanziarie, fornisci tu i dati manualmente.

Invece di: "Analizza il mio budget"
Scrivi: "Ho €15.000 di liquidità, spendo €3.500/mese in operatività e genero €6.000/mese di entrate. Come ottimizzare?"

È meno comodo dell'integrazione automatica, ma funziona. L'AI elaborerà i dati che fornisci e darà consigli pertinenti.

### Future Integrazioni

La sezione Impostazioni è progettata per espandersi. In futuro potrebbero essere aggiunte integrazioni con:

- CRM per dati di vendita
- Piattaforme email marketing
- Analytics tools
- Project management systems

L'obiettivo è sempre lo stesso: dare all'AI Assistant accesso a dati reali per fornirti consigli sempre più personalizzati e actionable.`,
      tips: [
        "L'integrazione con Percorso Capitale trasforma l'AI da consulente generico a advisor personalizzato. Se usi Percorso Capitale, collegalo - la differenza nella qualità dei consigli è drammatica.",
        "Dopo aver collegato l'account, fai un test completo. Chiedi all'AI di analizzare vari aspetti delle tue finanze per verificare che abbia accesso a tutti i dati necessari.",
        "I dati finanziari vengono importati e crittografati. La piattaforma usa protocolli di sicurezza bancari. Le tue credenziali sono più sicure qui di quanto potrebbero essere in un file Excel sul tuo computer.",
        "Se cambi password su Percorso Capitale, aggiorna immediatamente le credenziali anche qui. Un'integrazione non funzionante è peggio di non averla - crea aspettative false.",
        "Puoi disconnettere l'integrazione in qualsiasi momento dalle impostazioni. I dati già importati vengono eliminati immediatamente. Hai pieno controllo.",
        "Anche senza Percorso Capitale, l'AI rimane utilissima. Quando fai domande finanziarie, fornisci semplicemente i dati manualmente nella conversazione. L'AI li userà per darti consigli specifici."
      ]
    }
  }
];

export default function ClientFAQ() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navSidebarOpen, setNavSidebarOpen] = useState(!isMobile);
  const [selectedSection, setSelectedSection] = useState<string>("university");

  const currentSection = sections.find(s => s.id === selectedSection) || sections[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        {/* Sidebar principale nascosta nella pagina FAQ */}
        {isMobile && <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

        <div className="flex-1 flex overflow-hidden">
          {/* Documentation Sidebar */}
          {(!isMobile || navSidebarOpen) && (
            <div className={cn(
              "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col",
              isMobile ? "absolute inset-y-0 left-0 z-50 w-80" : "w-80"
            )}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Guida & Tutorial
                    </h2>
                  </div>
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setNavSidebarOpen(false)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Guide complete per usare ogni funzionalità
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => setLocation('/client')}
                  >
                    <Home className="h-4 w-4 mr-3" />
                    Torna alla Dashboard
                  </Button>

                  <Separator className="my-4" />

                  {sections.map((section) => {
                    const Icon = section.icon;
                    const isSelected = selectedSection === section.id;

                    return (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                          isSelected
                            ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-l-4 border-blue-600 dark:border-blue-400"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          isSelected
                            ? `bg-${section.color}-100 dark:bg-${section.color}-900/30`
                            : "bg-gray-100 dark:bg-gray-800"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            isSelected
                              ? `text-${section.color}-600 dark:text-${section.color}-400`
                              : "text-gray-600 dark:text-gray-400"
                          )} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className={cn(
                            "font-semibold",
                            isSelected
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-700 dark:text-gray-300"
                          )}>
                            {section.title}
                          </div>
                        </div>
                        {isSelected && (
                          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 md:p-12">
              {isMobile && !navSidebarOpen && (
                <Button
                  variant="outline"
                  className="mb-6"
                  onClick={() => setNavSidebarOpen(true)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Menu Tutorial
                </Button>
              )}

              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    `bg-${currentSection.color}-100 dark:bg-${currentSection.color}-900/30`
                  )}>
                    <currentSection.icon className={cn(
                      "h-8 w-8",
                      `text-${currentSection.color}-600 dark:text-${currentSection.color}-400`
                    )} />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                      {currentSection.title}
                    </h1>
                    <Button
                      variant="link"
                      className={`p-0 h-auto text-${currentSection.color}-600 dark:text-${currentSection.color}-400 font-semibold`}
                      onClick={() => setLocation(currentSection.path)}
                    >
                      Vai a {currentSection.title} →
                    </Button>
                  </div>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {currentSection.content.intro}
                </p>
              </div>

              {/* Quick Link Card */}
              <Card className={cn(
                "mb-8 border-l-4",
                `border-l-${currentSection.color}-500 bg-${currentSection.color}-50/50 dark:bg-${currentSection.color}-950/20`
              )}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        Pronto per iniziare?
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Clicca qui per accedere direttamente alla sezione
                      </p>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      onClick={() => setLocation(currentSection.path)}
                    >
                      Apri {currentSection.title}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Video Player - Only for video-tutorial section */}
              {selectedSection === "video-tutorial" && (
                <div className="mb-8">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-6">
                    <iframe
                      src="https://www.youtube.com/embed/AivKQ45LoHo"
                      title="Tutorial Completo Piattaforma"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}

              {/* Full Tutorial Content - Blog Style */}
              <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
                  {currentSection.content.fullText
                    .split('\n\n')
                    .map((paragraph, idx) => {
                      if (paragraph.startsWith('##')) {
                        return (
                          <h2 key={idx} className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
                            {paragraph.replace('## ', '')}
                          </h2>
                        );
                      } else if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                        return (
                          <h3 key={idx} className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                            {paragraph.replace(/\*\*/g, '')}
                          </h3>
                        );
                      } else {
                        // Split by ** to find bold text
                        const parts = paragraph.split(/(\*\*.*?\*\*)/g);
                        return (
                          <p key={idx} className="mb-4 text-base leading-relaxed">
                            {parts.map((part, partIdx) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={partIdx}>{part.replace(/\*\*/g, '')}</strong>;
                              }
                              return part;
                            })}
                          </p>
                        );
                      }
                    })}
                </div>
              </div>

              {/* Tips Section */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  Suggerimenti Pratici
                </h2>
                <div className="space-y-4">
                  {currentSection.content.tips.map((tip, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-shadow"
                    >
                      <div className="text-2xl flex-shrink-0">💡</div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer CTA */}
              <Card className="bg-gradient-to-r from-blue-600 to-purple-600">
                <CardContent className="p-8 text-center text-white">
                  <h3 className="text-2xl font-bold mb-3">
                    Hai ancora domande?
                  </h3>
                  <p className="text-white/90 mb-6">
                    L'AI Assistant è sempre disponibile per aiutarti
                  </p>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setLocation('/client/ai-assistant')}
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Parla con l'AI Assistant
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
