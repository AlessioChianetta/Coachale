export interface AgentIdea {
  id: string;
  name: string;
  description: string;
  suggestedPersonality: "professionale" | "amichevole" | "entusiasta" | "formale" | "amico_fidato" | "consulente_esperto";
  agentType?: "reactive_lead" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";
  isProactiveAgent?: boolean;
  integrationMode?: "whatsapp_ai" | "ai_only";
}

export interface AgentCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  ideas: AgentIdea[];
}

export const whatsappAgentIdeas: AgentCategory[] = [
  {
    id: "immobiliare",
    title: "Immobiliare",
    description: "Agenti per agenzie immobiliari, gestione proprietà e servizi real estate",
    icon: "🏢",
    ideas: [
      {
        id: "immobiliare-1",
        name: "Sofia - Accoglienza Clienti",
        description: "Prima accoglienza per nuovi lead interessati ad acquisto o affitto",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-2",
        name: "Marco - Consulente Vendite",
        description: "Supporto per clienti che vogliono vendere la propria proprietà",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-3",
        name: "Elena - Setter Visite",
        description: "Fissa appuntamenti per visite immobiliari proattivamente",
        suggestedPersonality: "entusiasta",
        agentType: "proactive_setter"
      },
      {
        id: "immobiliare-4",
        name: "Andrea - Valutazioni Immobili",
        description: "Raccoglie informazioni per valutazioni gratuite",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-5",
        name: "Giulia - Affitti Brevi",
        description: "Gestisce richieste per affitti turistici e brevi periodi",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-6",
        name: "Luca - Investimenti",
        description: "Consulenza per investimenti immobiliari e rendite",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-7",
        name: "Chiara - Follow-up Lead",
        description: "Ricontatta lead inattivi per riattivare l'interesse",
        suggestedPersonality: "amico_fidato",
        agentType: "proactive_setter"
      },
      {
        id: "immobiliare-8",
        name: "Roberto - Assistenza Mutui",
        description: "Informazioni su mutui e finanziamenti immobiliari",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "immobiliare-9",
        name: "Francesca - Nuove Costruzioni",
        description: "Promozione di nuovi progetti immobiliari in costruzione",
        suggestedPersonality: "entusiasta",
        agentType: "proactive_setter"
      },
      {
        id: "immobiliare-10",
        name: "Paolo - Commerciale",
        description: "Gestione immobili commerciali, uffici e capannoni",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "salute-fitness",
    title: "Salute & Fitness",
    description: "Palestre, personal trainer, nutrizionisti e servizi benessere",
    icon: "💪",
    ideas: [
      {
        id: "fitness-1",
        name: "Alex - Receptionist Palestra",
        description: "Accoglienza nuovi iscritti e informazioni abbonamenti",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-2",
        name: "Marta - Personal Trainer Bot",
        description: "Prenota sessioni PT e fornisce info su programmi personalizzati",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-3",
        name: "Davide - Nutrizione",
        description: "Consulenza nutrizionale e prenotazione visite dietista",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-4",
        name: "Sara - Lezioni Gruppo",
        description: "Prenotazioni per corsi yoga, pilates, spinning",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-5",
        name: "Tommaso - Prova Gratuita",
        description: "Fissa trial gratuiti per nuovi interessati",
        suggestedPersonality: "amichevole",
        agentType: "proactive_setter"
      },
      {
        id: "fitness-6",
        name: "Laura - Wellness Coach",
        description: "Supporto motivazionale e tracking progressi clienti",
        suggestedPersonality: "amico_fidato",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-7",
        name: "Fabio - Crossfit Assistant",
        description: "Gestione box crossfit, WOD e competizioni",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-8",
        name: "Valentina - Fisioterapia",
        description: "Prenotazioni per fisioterapia e riabilitazione",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "fitness-9",
        name: "Simone - Recupero Inattivi",
        description: "Riattiva abbonamenti scaduti con offerte speciali",
        suggestedPersonality: "amico_fidato",
        agentType: "proactive_setter"
      },
      {
        id: "fitness-10",
        name: "Alessia - Spa & Massaggi",
        description: "Prenota trattamenti benessere e massaggi",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "ristorazione",
    title: "Ristoranti & Food",
    description: "Ristoranti, pizzerie, catering e servizi di ristorazione",
    icon: "🍕",
    ideas: [
      {
        id: "food-1",
        name: "Maria - Prenotazioni Tavoli",
        description: "Gestisce prenotazioni per ristorante con conferme automatiche",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "food-2",
        name: "Giuseppe - Pizzeria Express",
        description: "Ordini takeaway e delivery per pizzeria",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "food-3",
        name: "Anna - Catering Events",
        description: "Preventivi per eventi, matrimoni e cerimonie",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "food-4",
        name: "Carlo - Menu del Giorno",
        description: "Invia menu giornalieri e offerte speciali",
        suggestedPersonality: "amichevole",
        agentType: "proactive_setter"
      },
      {
        id: "food-5",
        name: "Lucia - Eventi Privati",
        description: "Organizza feste private e sale riservate",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "food-6",
        name: "Francesco - Wine Bar",
        description: "Degustazioni vini ed eventi enogastronomici",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "food-7",
        name: "Beatrice - Pasticceria",
        description: "Ordini torte personalizzate e dolci su misura",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "food-8",
        name: "Antonio - Sushi Bar",
        description: "All you can eat e menu alla carta per sushi bar",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "food-9",
        name: "Silvia - Feedback & Loyalty",
        description: "Raccoglie recensioni e gestisce programma fedeltà",
        suggestedPersonality: "amico_fidato",
        agentType: "proactive_setter"
      },
      {
        id: "food-10",
        name: "Michele - Street Food",
        description: "Location food truck e preordini eventi",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "ecommerce",
    title: "E-commerce & Retail",
    description: "Negozi online, boutique e vendita al dettaglio",
    icon: "🛍️",
    ideas: [
      {
        id: "ecommerce-1",
        name: "Emma - Customer Care",
        description: "Assistenza clienti per ordini e resi",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-2",
        name: "Leonardo - Product Expert",
        description: "Consulenza sui prodotti e caratteristiche tecniche",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-3",
        name: "Giorgia - Flash Sales",
        description: "Notifica offerte lampo e promozioni esclusive",
        suggestedPersonality: "entusiasta",
        agentType: "proactive_setter"
      },
      {
        id: "ecommerce-4",
        name: "Matteo - Carrelli Abbandonati",
        description: "Recupera carrelli abbandonati con incentivi",
        suggestedPersonality: "amichevole",
        agentType: "proactive_setter"
      },
      {
        id: "ecommerce-5",
        name: "Federica - Fashion Stylist",
        description: "Consigli di stile e abbinamenti per abbigliamento",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-6",
        name: "Riccardo - Tracking Spedizioni",
        description: "Informazioni su spedizioni e consegne",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-7",
        name: "Camilla - Gift Advisor",
        description: "Suggerimenti per regali e confezioni personalizzate",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-8",
        name: "Stefano - Tech Support",
        description: "Supporto tecnico per prodotti elettronici",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-9",
        name: "Elisa - Pre-Order Manager",
        description: "Gestisce pre-ordini per nuovi lanci prodotti",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "ecommerce-10",
        name: "Daniele - VIP Program",
        description: "Gestisce clienti premium e vantaggi esclusivi",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "servizi-professionali",
    title: "Servizi Professionali",
    description: "Avvocati, commercialisti, consulenti e studi professionali",
    icon: "💼",
    ideas: [
      {
        id: "professional-1",
        name: "Avv. Rossi - Assistente Legale",
        description: "Prima consulenza legale e fissaggio appuntamenti",
        suggestedPersonality: "formale",
        agentType: "reactive_lead"
      },
      {
        id: "professional-2",
        name: "Dott. Bianchi - Studio Commercialista",
        description: "Consulenza fiscale e gestione dichiarazioni",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "professional-3",
        name: "Ing. Ferrari - Consulenza Tecnica",
        description: "Perizie tecniche e pratiche edilizie",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "professional-4",
        name: "Dott.ssa Verdi - Psicologa",
        description: "Prenotazione sedute psicoterapia e supporto emotivo",
        suggestedPersonality: "amico_fidato",
        agentType: "reactive_lead"
      },
      {
        id: "professional-5",
        name: "Arch. Moretti - Studio Architettura",
        description: "Preventivi ristrutturazioni e progettazione",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "professional-6",
        name: "Dott. Colombo - Medico Legale",
        description: "Perizie medico-legali e consulenze assicurative",
        suggestedPersonality: "formale",
        agentType: "reactive_lead"
      },
      {
        id: "professional-7",
        name: "Notaio Ricci - Studio Notarile",
        description: "Rogiti, successioni e atti notarili",
        suggestedPersonality: "formale",
        agentType: "reactive_lead"
      },
      {
        id: "professional-8",
        name: "Cons. Fontana - Business Coach",
        description: "Coaching aziendale e sviluppo manageriale",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "professional-9",
        name: "Dott. Greco - Veterinario",
        description: "Visite veterinarie e emergenze animali",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "professional-10",
        name: "Studio HR - Ricerca Personale",
        description: "Selezione del personale e head hunting",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "automotive",
    title: "Automotive",
    description: "Concessionarie auto, autofficine, noleggio e servizi automotive",
    icon: "🚗",
    ideas: [
      {
        id: "auto-1",
        name: "Luca - Vendita Auto Nuove",
        description: "Preventivi auto nuove e test drive",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "auto-2",
        name: "Marco - Usato Garantito",
        description: "Gestione vendita auto usate con garanzia",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "auto-3",
        name: "Giovanni - Service Auto",
        description: "Prenotazioni tagliandi e manutenzione",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "auto-4",
        name: "Francesca - Noleggio Lungo Termine",
        description: "Preventivi NLT e offerte flotte aziendali",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "auto-5",
        name: "Antonio - Ricambi & Accessori",
        description: "Vendita ricambi originali e aftermarket",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "auto-6",
        name: "Simona - Assicurazioni Auto",
        description: "Preventivi assicurativi e polizze auto",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "auto-7",
        name: "Roberto - Carrozzeria",
        description: "Preventivi riparazioni carrozzeria e sinistri",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "auto-8",
        name: "Claudia - Elettrauto",
        description: "Diagnosi elettronica e riparazioni elettriche",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "auto-9",
        name: "Paolo - Car Detailing",
        description: "Servizi lavaggio premium e lucidatura",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "auto-10",
        name: "Elena - Permute Valutazioni",
        description: "Valutazione auto usate per permuta",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "bellezza-benessere",
    title: "Bellezza & Benessere",
    description: "Parrucchieri, centri estetici, spa e trattamenti bellezza",
    icon: "💅",
    ideas: [
      {
        id: "beauty-1",
        name: "Martina - Hair Stylist",
        description: "Prenotazioni parrucchiere e consulenza look",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-2",
        name: "Cristina - Centro Estetico",
        description: "Trattamenti viso e corpo, epilazione",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-3",
        name: "Veronica - Nail Artist",
        description: "Manicure, pedicure e nail art",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-4",
        name: "Sabrina - Barber Shop",
        description: "Prenotazioni barbiere e grooming maschile",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-5",
        name: "Daniela - Massaggi & Relax",
        description: "Massaggi rilassanti, hot stone e aromaterapia",
        suggestedPersonality: "amico_fidato",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-6",
        name: "Ilaria - Make-up Artist",
        description: "Trucco sposa, eventi e corsi make-up",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-7",
        name: "Monica - Solarium & Abbronzatura",
        description: "Sedute solarium e spray tan",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-8",
        name: "Serena - Trattamenti Viso",
        description: "Pulizia viso, peeling e trattamenti anti-età",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-9",
        name: "Roberta - Depilazione Laser",
        description: "Epilazione laser permanente",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "beauty-10",
        name: "Gaia - Beauty Packages",
        description: "Pacchetti benessere e gift card spa",
        suggestedPersonality: "entusiasta",
        agentType: "proactive_setter"
      }
    ]
  },
  {
    id: "formazione",
    title: "Formazione & Educazione",
    description: "Scuole, corsi, formazione professionale e tutoring",
    icon: "📚",
    ideas: [
      {
        id: "education-1",
        name: "Prof. Marini - Ripetizioni",
        description: "Lezioni private matematica, fisica e materie scientifiche",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "education-2",
        name: "Teacher Emma - Inglese",
        description: "Corsi di inglese individuali e di gruppo",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "education-3",
        name: "Maestro Rossi - Scuola Musica",
        description: "Lezioni pianoforte, chitarra e strumenti musicali",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "education-4",
        name: "Coach Alberti - Scuola Guida",
        description: "Iscrizioni patenti e prenotazione lezioni guida",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "education-5",
        name: "Dott. Santini - Formazione IT",
        description: "Corsi programmazione, web development e cybersecurity",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "education-6",
        name: "Prof.ssa Galli - Test Prep",
        description: "Preparazione test universitari e concorsi pubblici",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "education-7",
        name: "Istruttore Neri - Scuola Danza",
        description: "Corsi danza classica, moderna e hip-hop",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "education-8",
        name: "Chef Bruno - Corsi Cucina",
        description: "Lezioni di cucina e pasticceria",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "education-9",
        name: "Trainer Conti - Corsi Aziendali",
        description: "Formazione corporate e team building",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "education-10",
        name: "Dott.ssa Poli - Doposcuola",
        description: "Supporto compiti e aiuto studio bambini/ragazzi",
        suggestedPersonality: "amico_fidato",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "turismo",
    title: "Turismo & Viaggi",
    description: "Agenzie viaggi, hotel, tour operator e servizi turistici",
    icon: "✈️",
    ideas: [
      {
        id: "travel-1",
        name: "Giulia - Agenzia Viaggi",
        description: "Pacchetti vacanze e preventivi su misura",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "travel-2",
        name: "Receptionist Hotel Luna",
        description: "Prenotazioni camere e servizi hotel",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "travel-3",
        name: "Marco - Tour Operator",
        description: "Tour organizzati e viaggi di gruppo",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "travel-4",
        name: "Sofia - B&B Manager",
        description: "Gestione prenotazioni bed & breakfast",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "travel-5",
        name: "Luca - Guida Turistica",
        description: "Visite guidate e esperienze locali",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "travel-6",
        name: "Francesca - Crociere",
        description: "Preventivi e prenotazioni crociere",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "travel-7",
        name: "Andrea - Rent Car",
        description: "Noleggio auto turistico e transfer aeroportuali",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "travel-8",
        name: "Chiara - Last Minute",
        description: "Offerte last minute e voli low cost",
        suggestedPersonality: "entusiasta",
        agentType: "proactive_setter"
      },
      {
        id: "travel-9",
        name: "Matteo - Escursioni",
        description: "Attività outdoor, trekking e avventura",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "travel-10",
        name: "Elena - Viaggi Nozze",
        description: "Pacchetti luna di miele personalizzati",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "finanza",
    title: "Servizi Finanziari",
    description: "Banche, assicurazioni, consulenza finanziaria e investimenti",
    icon: "💰",
    ideas: [
      {
        id: "finance-1",
        name: "Consulente Banca Rossi",
        description: "Apertura conti correnti e servizi bancari",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "finance-2",
        name: "Agente Assicurativo",
        description: "Preventivi assicurazioni vita, casa e infortuni",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "finance-3",
        name: "Dott. Investimenti",
        description: "Consulenza investimenti e gestione patrimoni",
        suggestedPersonality: "formale",
        agentType: "reactive_lead"
      },
      {
        id: "finance-4",
        name: "Mediatore Creditizio",
        description: "Ricerca migliori mutui e prestiti personali",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "finance-5",
        name: "Promotore Finanziario",
        description: "Fondi comuni, azioni e obbligazioni",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "finance-6",
        name: "Esperto Previdenza",
        description: "Fondi pensione e previdenza complementare",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "finance-7",
        name: "Cambiavalute Pro",
        description: "Servizi cambio valuta e money transfer",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "finance-8",
        name: "Analista Finanziario",
        description: "Analisi di mercato e raccomandazioni investimenti",
        suggestedPersonality: "formale",
        agentType: "reactive_lead"
      },
      {
        id: "finance-9",
        name: "Crypto Advisor",
        description: "Consulenza criptovalute e blockchain",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "finance-10",
        name: "Recovery Credits",
        description: "Recupero crediti e gestione posizioni debitorie",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "eventi-intrattenimento",
    title: "Eventi & Intrattenimento",
    description: "Organizzazione eventi, wedding planner, DJ e servizi per feste",
    icon: "🎉",
    ideas: [
      {
        id: "events-1",
        name: "Sara - Wedding Planner",
        description: "Organizzazione matrimoni chiavi in mano",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "events-2",
        name: "Marco - DJ Service",
        description: "Prenotazioni DJ per feste ed eventi",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "events-3",
        name: "Giulia - Party Planner",
        description: "Organizzazione feste private e aziendali",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "events-4",
        name: "Andrea - Catering Eventi",
        description: "Servizi catering per cerimonie e meeting",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "events-5",
        name: "Chiara - Fotografia Matrimoni",
        description: "Book fotografici matrimoni e servizi video",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "events-6",
        name: "Luca - Animazione Feste",
        description: "Animatori per compleanni bambini e baby dance",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "events-7",
        name: "Elena - Location Manager",
        description: "Prenotazioni ville e location per eventi",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "events-8",
        name: "Roberto - Live Music",
        description: "Band e musicisti dal vivo per eventi",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "events-9",
        name: "Francesca - Allestimenti",
        description: "Decorazioni floreali e allestimenti scenici",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "events-10",
        name: "Paolo - Team Building",
        description: "Organizzazione eventi aziendali e incentive",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "casa-edilizia",
    title: "Casa & Edilizia",
    description: "Ristrutturazioni, imbianchini, idraulici e servizi per la casa",
    icon: "🏠",
    ideas: [
      {
        id: "home-1",
        name: "Stefano - Ristrutturazioni",
        description: "Preventivi ristrutturazioni complete appartamenti",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "home-2",
        name: "Mario - Imbianchino",
        description: "Tinteggiature interne ed esterne",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "home-3",
        name: "Giuseppe - Idraulico Pronto",
        description: "Interventi idraulici urgenti e manutenzione",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "home-4",
        name: "Alessandro - Elettricista",
        description: "Impianti elettrici e domotica",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "home-5",
        name: "Davide - Piastrellista",
        description: "Posa pavimenti e rivestimenti bagno/cucina",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "home-6",
        name: "Claudio - Falegname",
        description: "Mobili su misura e lavori in legno",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "home-7",
        name: "Franco - Fabbro",
        description: "Serrature, cancelli e inferriate",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "home-8",
        name: "Simone - Climatizzazione",
        description: "Installazione e manutenzione condizionatori",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "home-9",
        name: "Massimo - Giardinaggio",
        description: "Manutenzione giardini e potature",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "home-10",
        name: "Vincenzo - Pulizie Casa",
        description: "Servizi pulizie domestiche e sanificazione",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      }
    ]
  },
  {
    id: "marketing-digital",
    title: "Marketing & Digital",
    description: "Agenzie marketing, web design, social media e consulenza digitale",
    icon: "📱",
    ideas: [
      {
        id: "digital-1",
        name: "Laura - Social Media Manager",
        description: "Gestione profili social e content creation",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "digital-2",
        name: "Matteo - Web Designer",
        description: "Creazione siti web e landing page",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "digital-3",
        name: "Alessia - SEO Specialist",
        description: "Ottimizzazione SEO e posizionamento Google",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      },
      {
        id: "digital-4",
        name: "Fabio - Google Ads Expert",
        description: "Campagne pubblicitarie Google e Facebook",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "digital-5",
        name: "Cristina - Copywriter",
        description: "Scrittura testi persuasivi e storytelling",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "digital-6",
        name: "Diego - Video Marketing",
        description: "Realizzazione video promozionali e advertising",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "digital-7",
        name: "Valentina - Email Marketing",
        description: "Campagne DEM e automation marketing",
        suggestedPersonality: "professionale",
        agentType: "reactive_lead"
      },
      {
        id: "digital-8",
        name: "Simone - Graphic Designer",
        description: "Design grafico, loghi e brand identity",
        suggestedPersonality: "amichevole",
        agentType: "reactive_lead"
      },
      {
        id: "digital-9",
        name: "Martina - Influencer Marketing",
        description: "Campagne con influencer e brand ambassador",
        suggestedPersonality: "entusiasta",
        agentType: "reactive_lead"
      },
      {
        id: "digital-10",
        name: "Andrea - E-commerce Manager",
        description: "Gestione negozi online e marketplace",
        suggestedPersonality: "consulente_esperto",
        agentType: "reactive_lead"
      }
    ]
  }
];
