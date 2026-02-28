export interface EmailTemplate {
  id: string;
  name: string;
  scenario: string;
  whenToUse: string;
  subject: string;
  body: string;
  psychologicalLever: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "template_1",
    name: "Primo Contatto Strategico",
    scenario: "first_contact",
    whenToUse: "Prima email a un lead freddo. Non ti conosce. Hai 3 secondi per catturare la sua attenzione.",
    subject: "{contactName}, ho studiato {businessName} — posso chiederti una cosa?",
    body: `Buongiorno {contactName},

mi chiamo **{consultantName}** e mi occupo di {serviceName} per attività nel settore **{sector}**.

Prima di scriverti ho dedicato del tempo ad analizzare **{businessName}**. Ho notato {specificDetail} — ed è chiaro che dietro c'è un lavoro serio.

C'è però **un aspetto che potrebbe fare una differenza importante** per voi nei prossimi mesi. È qualcosa che ho già affrontato con successo con altre realtà simili alla vostra, e vorrei condividerlo con te.

Non ti chiedo un'ora del tuo tempo. **Ti chiedo 15 minuti** — il tempo di un caffè — per mostrarti cosa intendo. Se dopo quei 15 minuti non avrai trovato nulla di utile, avrai comunque guadagnato un punto di vista esterno gratuito sulla tua attività.

**Quando preferisci, questa settimana o la prossima?**

Un saluto,

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Curiosità + dimostrazione di conoscenza specifica",
  },
  {
    id: "template_2",
    name: "Follow-up Elegante",
    scenario: "follow_up_1",
    whenToUse: "Nessuna risposta al primo contatto (3-5 giorni dopo). Riportare l'email in cima alla inbox con un motivo valido.",
    subject: "Re: {contactName}, ho studiato {businessName} — posso chiederti una cosa?",
    body: `{contactName},

capisco che le giornate di chi gestisce un'attività come **{businessName}** non lasciano molto spazio alle email — ci sono passato anch'io.

Ti riscrivo perché nel frattempo ho approfondito la vostra situazione e ho individuato **un'opportunità concreta** che credo meriti almeno una conversazione.

Per darti un'idea: un'attività nel **{sector}** con cui lavoro aveva lo stesso identico scenario di partenza. Oggi ha ottenuto **{resultMetric}** — e il primo passo è stato proprio una conversazione come quella che ti propongo.

**Non ti chiedo di comprare nulla. Ti chiedo solo 15 minuti per ascoltare.** Se non ti torna utile, me lo dici e non ti disturbo più.

Che ne dici?

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Reciprocità + micro-commitment",
  },
  {
    id: "template_3",
    name: "Break-up Email (Ultimo Tentativo)",
    scenario: "follow_up_2",
    whenToUse: "Seconda email senza risposta. Ultima chance. Generare una reazione con scarsità e paura di perdere un'opportunità.",
    subject: "{contactName}, chiudo qui",
    body: `{contactName},

ti avevo scritto perché vedevo un'opportunità reale per **{businessName}**. Non ho ricevuto risposta e lo rispetto — so che non tutto arriva al momento giusto.

Questa è l'ultima volta che ti scrivo su questo tema. **Non per pressarti**, ma perché credo che il tuo tempo e il mio meritino chiarezza.

Ti lascio solo con un dato: le attività nel **{sector}** che hanno implementato quello che volevo proporti hanno visto in media **{resultMetric}**. Non è teoria — sono numeri reali di clienti reali.

Se in futuro cambiasse qualcosa, **la mia porta è sempre aperta.** Ti basta rispondere a questa email, anche tra sei mesi.

Ti auguro il meglio per **{businessName}**.

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Scarsità + rispetto + inversione del rapporto di potere",
  },
  {
    id: "template_4",
    name: "Trigger su Evento Recente",
    scenario: "trigger_event",
    whenToUse: "Il lead ha fatto qualcosa di visibile di recente — nuovo sito, apertura, evento, post virale, ristrutturazione.",
    subject: "Ho visto cosa sta facendo {businessName} — complimenti (e un'idea)",
    body: `{contactName},

ho notato che **{triggerEvent}** — e devo farti i complimenti. È il tipo di mossa che distingue chi gestisce un'attività con visione da chi va avanti per inerzia.

Ecco perché ti scrivo proprio adesso: **questo è il momento perfetto per capitalizzare lo slancio.** Ho visto tante attività nel **{sector}** fare passi importanti come il vostro e poi non riuscire a convertirli in crescita strutturata — semplicemente perché mancava un metodo.

È esattamente il mio lavoro. Mi occupo di {serviceName} e aiuto realtà come **{businessName}** a trasformare momenti come questo in risultati che durano.

**Ti propongo 15 minuti di confronto — senza impegno, senza vendita.** Solo un'idea concreta che puoi decidere di usare o meno.

Quando ti torna comodo?

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Tempismo + validazione sociale + opportunità",
  },
  {
    id: "template_5",
    name: "Caso Studio con Prova Sociale",
    scenario: "case_study",
    whenToUse: "Hai un risultato concreto con un business nello stesso settore o zona. I numeri parlano da soli.",
    subject: `Come un {sector} a {cityOrArea} è passato da "{painPoint}" a {resultMetric}`,
    body: `{contactName},

ti racconto una storia vera — perché credo che ti ci riconoscerai.

Un'attività nel **{sector}**, molto simile a **{businessName}**, aveva un problema che conosci bene: **{painPoint}**. Nonostante la qualità del servizio, i numeri non riflettevano il valore reale dell'attività.

Abbiamo lavorato insieme su {serviceName}. **Nessuna rivoluzione, nessun investimento enorme.** Solo un metodo strutturato, applicato con costanza.

Il risultato dopo 90 giorni? **{resultMetric}.**

Non ti sto dicendo che otterrai lo stesso identico risultato — ogni attività è diversa. Ma le condizioni di partenza sono molto simili, e credo che valga la pena esplorare il potenziale.

**Hai 15 minuti questa settimana per una call? Ti mostro esattamente cosa abbiamo fatto e come potrebbe adattarsi a {businessName}.**

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Prova sociale + specificity bias (più il dato è specifico, più è credibile)",
  },
  {
    id: "template_6",
    name: "Pain Point di Settore",
    scenario: "pain_point",
    whenToUse: "Conosci un problema cronico nel settore del lead. Il lead deve pensare 'questo capisce la mia situazione'.",
    subject: "{contactName}, il vero motivo per cui il {sector} perde clienti (non è quello che pensi)",
    body: `{contactName},

lavoro con attività nel **{sector}** da diversi anni, e c'è un pattern che vedo ripetersi continuamente: **{painPoint}**.

La maggior parte dei titolari pensa che il problema sia la concorrenza, i costi, o il mercato. Ma nella mia esperienza, il vero collo di bottiglia è quasi sempre **un processo che nessuno ha mai ottimizzato** — semplicemente perché "si è sempre fatto così".

La buona notizia? **È uno dei problemi più risolvibili che esistano.** Non servono investimenti enormi né cambiamenti radicali. Serve il metodo giusto — ed è esattamente quello su cui lavoro ogni giorno con realtà come **{businessName}**.

Un mio cliente nello stesso settore ha risolto questa situazione in meno di 60 giorni, ottenendo **{resultMetric}**.

**Ti va di capire insieme se lo stesso approccio funzionerebbe anche per voi? 15 minuti, zero impegno.**

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Empatia + autorità di settore + agitazione del problema",
  },
  {
    id: "template_7",
    name: "Valore Gratuito in Anticipo",
    scenario: "free_value",
    whenToUse: "Lead potenzialmente diffidente o in un settore dove tutti provano a vendere qualcosa. Offri prima di chiedere.",
    subject: "{contactName}, ho preparato qualcosa per {businessName} (gratis)",
    body: `{contactName},

ho fatto una cosa che di solito faccio solo per i miei clienti: **ho analizzato {businessName} dall'esterno** — presenza online, posizionamento nel {sector}, punti di forza e aree dove state lasciando opportunità sul tavolo.

Ho sintetizzato tutto in **3 osservazioni concrete con suggerimenti pratici** che puoi applicare subito, anche senza il mio aiuto.

Perché lo faccio gratis? Perché è il modo migliore per dimostrarti che so di cosa parlo. Se poi quello che leggi ti convince e vuoi approfondire, ne parliamo. **Se non ti convince, tieni il report e buona strada** — nessun rancore.

**Rispondimi con un "sì" e te lo invio entro domani.**

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Reciprocità (principio di Cialdini) + generosità percepita + riduzione del rischio",
  },
  {
    id: "template_8",
    name: "Introduzione tramite Referral",
    scenario: "referral",
    whenToUse: "Hai una connessione in comune con il lead. La fiducia è già pre-costruita.",
    subject: "{referralName} mi ha suggerito di scriverti",
    body: `{contactName}, buongiorno.

Mi chiamo **{consultantName}** — lavoro nel campo di {serviceName} per attività nel **{sector}**.

**{referralName}** mi ha parlato di **{businessName}** e di quello che state costruendo. Mi ha detto che potrei darvi una mano concreta su un aspetto specifico della vostra crescita — e conoscendo {referralName}, se me lo dice, c'è un motivo.

Non ti faccio perdere tempo con presentazioni lunghe. **Ti propongo una call di 15 minuti** dove ti spiego cosa faccio, ascolto dove siete oggi, e ti dico onestamente se posso esservi utile oppure no.

Se non c'è un fit, te lo dico io per primo.

**Quando ti fa comodo questa settimana?**

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Riprova sociale + fiducia trasferita + esclusività",
  },
  {
    id: "template_9",
    name: "Complimento Genuino + Posizionamento",
    scenario: "compliment",
    whenToUse: "Hai trovato qualcosa di autentico da apprezzare nel lead. Apertura onesta che crea connessione.",
    subject: "Una cosa di {businessName} che non vedo spesso nel {sector}",
    body: `{contactName},

ti scrivo per una ragione semplice: **{specificDetail}**. Nel **{sector}** è raro vedere questo livello di attenzione, e mi ha colpito genuinamente.

Mi occupo di {serviceName} e lavoro quotidianamente con attività che hanno la stessa cura che vedo in **{businessName}**. Il mio lavoro è aiutarle a far sì che **quella qualità si traduca in numeri** — più clienti, più ricorrenza, più margine.

Non si tratta di stravolgere nulla. Si tratta di **costruire un sistema attorno a ciò che già funziona** perché renda al massimo del suo potenziale.

**Mi piacerebbe scambiare due parole con te — 15 minuti, senza impegno.** Anche solo per conoscerti e capire se c'è un terreno comune.

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Liking (ci fidiamo di chi ci apprezza) + posizionamento come pari",
  },
  {
    id: "template_10",
    name: "Re-engagement di un Lead Raffreddato",
    scenario: "re_engagement",
    whenToUse: "Il lead aveva mostrato interesse ma poi è sparito. Riaprire il dialogo senza sembrare disperati.",
    subject: "{contactName}, nel frattempo è cambiato qualcosa",
    body: `{contactName},

qualche tempo fa avevamo parlato della possibilità di lavorare insieme su {serviceName} per **{businessName}**. Poi, com'è normale, le priorità cambiano e il progetto è rimasto in sospeso.

Ti riscrivo perché nel frattempo **ho sviluppato un approccio nuovo** che sta dando risultati importanti con attività nel **{sector}** — e penso che potrebbe interessarti, soprattutto alla luce di quello che ci eravamo detti.

Non voglio ripartire da zero. **Ti chiedo solo 15 minuti per aggiornarti** su cosa è cambiato e capire insieme se il timing adesso è migliore.

Se non lo è, nessun problema — lo rispetto. Ma se c'è anche solo un pizzico di curiosità, **rispondimi e troviamo uno slot.**

A presto,

**{consultantName}**
{consultantBusiness}`,
    psychologicalLever: "Novità + rispetto del tempo + porta aperta",
  },
];

export const GOLDEN_RULES = `## Regole d'Oro per il Copy di Hunter

### Struttura di ogni email
1. **Apertura** → Hook specifico che dimostra conoscenza del lead (MAI generico)
2. **Problema/Opportunità** → Tocca un punto sensibile o mostra un potenziale inespresso
3. **Soluzione + Prova** → Posizionati come chi ha già risolto quel problema (con dati)
4. **CTA unico** → Una sola domanda chiara: "Hai 15 minuti?"
5. **Firma pulita** → Nome, azienda. Nient'altro.

### Principi inviolabili
- La prima riga decide tutto. Se non cattura in 3 secondi, l'email è morta.
- Scrivi come parli. Niente frasi da brochure aziendale.
- Un CTA, una domanda, una risposta possibile.
- Grassetto solo sulle parole che contano. Max 2-3 per email.
- Mai più di 6-8 righe effettive.

### Parole e frasi vietate
NON usare MAI: sinergia, all'avanguardia, innovativo, leader di settore, soluzione a 360°, win-win, best practice, ottimizzare le performance, trasformazione digitale, eccellenza operativa.

### L'oggetto email
- Breve (max 6-8 parole)
- Specifico (deve contenere il nome del lead o dell'azienda)
- Curioso (deve creare un gap informativo)
- Mai tutto maiuscolo, mai punti esclamativi, mai emoji
- Mai parole trigger spam: gratis, offerta, sconto, promozione, guadagna, urgente`;

export function selectTemplateForScenario(scenario: string): EmailTemplate {
  const scenarioMap: Record<string, string> = {
    "first_contact": "template_1",
    "follow_up_1": "template_2",
    "follow_up_2": "template_3",
    "trigger_event": "template_4",
    "case_study": "template_5",
    "pain_point": "template_6",
    "free_value": "template_7",
    "referral": "template_8",
    "compliment": "template_9",
    "re_engagement": "template_10",
  };

  const templateId = scenarioMap[scenario] || "template_6";
  return EMAIL_TEMPLATES.find(t => t.id === templateId) || EMAIL_TEMPLATES[5];
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATES;
}
