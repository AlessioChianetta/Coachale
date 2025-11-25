
-- Migration: Insert Newsletter Template Structure
-- This creates 3 separate templates for the 3-year financial education program

DO $$
DECLARE
  template_id UUID;
  trim_id UUID;
  mod_id UUID;
  consultant_id UUID;
BEGIN
  -- Get the first consultant ID (you may want to modify this to match your actual consultant)
  SELECT id INTO consultant_id FROM users WHERE role = 'consultant' LIMIT 1;

  -- ============================================================================
  -- TEMPLATE ANNO 1 - COSTRUZIONE DELLE FONDAMENTA
  -- ============================================================================
  INSERT INTO university_templates (id, name, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Anno 1 – Costruzione delle Fondamenta', 'Il primo anno del percorso finanziario: mindset, gestione del denaro quotidiano e creazione delle basi solide', true, consultant_id)
  RETURNING id INTO template_id;

  -- Q1: Le Fondamenta della Sicurezza (Settimane 1-13)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q1 – Le Fondamenta della Sicurezza', 'Costruire le fondamenta mentali e fotografare la situazione attuale', 1)
  RETURNING id INTO trim_id;

  -- Modulo 1: Mindset e Diagnosi Finanziaria (Settimane 1-4)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 1: Mindset e Diagnosi Finanziaria', 'Il mindset del denaro e la fotografia della tua situazione attuale', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Benvenuto/a! Il mindset del denaro', 'Perché gestire i soldi non è solo per ricchi', 1),
  (mod_id, 'La fotografia del tuo patrimonio', 'Cos''è il Net Worth e come calcolare il tuo punto di partenza', 2),
  (mod_id, 'Dove vanno i tuoi soldi?', 'La magia del tracciamento delle spese (senza impazzire)', 3),
  (mod_id, 'Il tuo primo budget, senza stress', 'Metodi semplici (50/30/20, budget a base zero)', 4);

  -- Modulo 2: Gestione Debiti e Fondo Emergenza (Settimane 5-8)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 2: Gestione Debiti e Fondo Emergenza', 'Liberarsi dai debiti e creare sicurezza finanziaria', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'I nemici silenziosi: i debiti', 'Come mappare i debiti (buoni vs cattivi) e creare un piano', 1),
  (mod_id, 'La prima linea di difesa: il Fondo di Emergenza', 'A cosa serve e come iniziare a costruirlo', 2),
  (mod_id, 'Automatizza la tua ricchezza', 'Il concetto di "Paga te stesso prima di tutto"', 3),
  (mod_id, 'Ottimizza le spese fisse', 'Analisi di bollette, abbonamenti e assicurazioni', 4);

  -- Modulo 3: Ottimizzazione e Psicologia (Settimane 9-13)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 3: Ottimizzazione e Psicologia', 'Ridurre le spese e ottimizzare la fiscalità', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'La spesa intelligente', 'Strategie pratiche per risparmiare su cibo e beni di consumo', 1),
  (mod_id, 'Conti correnti e carte', 'Strumenti a costo zero per gestire il denaro', 2),
  (mod_id, 'Psicologia del denaro', 'Identificare e superare le credenze limitanti', 3),
  (mod_id, 'Obiettivi a breve termine', 'Dalla teoria alla pratica', 4),
  (mod_id, 'Primo Check-up Trimestrale', 'Verifica progressi e aggiustamenti', 5);

  -- Q2: Costruire il Futuro (Settimane 14-26)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q2 – Costruire il Futuro', 'Iniziare a far lavorare i soldi per te', 2)
  RETURNING id INTO trim_id;

  -- Modulo 4: Introduzione agli Investimenti (Settimane 14-17)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 4: Introduzione agli Investimenti', 'Definire obiettivi e strategie di risparmio', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'L''Interesse Composto', 'Il tuo alleato numero uno per la ricchezza', 1),
  (mod_id, 'L''inflazione', 'Il ladro invisibile e come proteggersi', 2),
  (mod_id, 'Cosa significa davvero "investire"', 'Differenza tra risparmiare e far crescere il denaro', 3),
  (mod_id, 'Rischio e Rendimento', 'La relazione fondamentale da capire', 4);

  -- Modulo 5: Strumenti di Investimento (Settimane 18-22)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 5: Strumenti di Investimento', 'Introduzione al mondo degli investimenti', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Azioni e Obbligazioni', 'Le basi del mercato finanziario', 1),
  (mod_id, 'La magia della diversificazione', 'Non mettere tutte le uova nello stesso paniere', 2),
  (mod_id, 'ETF e Fondi Comuni', 'Il tuo primo investimento pratico', 3),
  (mod_id, 'Come scegliere un Broker', 'Criteri e caratteristiche essenziali', 4),
  (mod_id, 'Il PAC', 'Piano di Accumulo Capitale, la strategia per principianti', 5);

  -- Modulo 6: Pianificazione Pensionistica e Strategie (Settimane 23-26)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 6: Pianificazione Pensionistica e Strategie', 'Costruire un portafoglio bilanciato', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Investire per la pensione', 'Iniziare da giovani per raccogliere da vecchi', 1),
  (mod_id, 'Errori da evitare', 'Bias comportamentali e trappole mentali', 2),
  (mod_id, 'Immobiliare', 'Pro e contro dell''investimento in mattoni', 3),
  (mod_id, 'Check-up di Metà Anno', 'Analisi portafoglio e obiettivi', 4);

  -- Q3: Ottimizzare e Proteggere (Settimane 27-39)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q3 – Ottimizzare e Proteggere', 'Proteggere e far crescere il patrimonio', 3)
  RETURNING id INTO trim_id;

  -- Modulo 7: Efficienza Fiscale e Protezione (Settimane 27-30)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 7: Efficienza Fiscale e Protezione', 'Gestire la fiscalità in modo efficiente', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Le tasse sui tuoi investimenti', 'Cosa devi sapere', 1),
  (mod_id, 'Strategie di efficienza fiscale', 'Ottimizzare legalmente il carico fiscale', 2),
  (mod_id, 'Assicurazioni', 'Proteggersi dagli imprevisti senza sprecare denaro', 3),
  (mod_id, 'Il tuo bene più prezioso', 'Investire nella carriera e nelle competenze', 4);

  -- Modulo 8: Nuove Entrate e Relazioni Finanziarie (Settimane 31-35)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 8: Nuove Entrate e Relazioni Finanziarie', 'Proteggere il patrimonio da rischi e imprevisti', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Side Hustle', 'Creare entrate extra parallelamente al lavoro principale', 1),
  (mod_id, 'Dal Side Hustle al Business', 'Quando e come fare il salto', 2),
  (mod_id, 'Credito e merito creditizio', 'Come funziona e perché è importante', 3),
  (mod_id, 'Gestire il denaro in famiglia/coppia', 'Comunicazione e strategie condivise', 4),
  (mod_id, 'Insegnare il valore del denaro ai figli', 'Educazione finanziaria familiare', 5);

  -- Modulo 9: Psicologia Avanzata e Pianificazione Successoria (Settimane 36-39)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 9: Psicologia Avanzata e Pianificazione Successoria', 'Controllare e aggiustare il piano finanziario', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'FOMO e FUD negli investimenti', 'Gestire le emozioni nei mercati', 1),
  (mod_id, 'L''importanza di un testamento', 'Pianificare il trasferimento del patrimonio', 2),
  (mod_id, 'Leggere le notizie finanziarie', 'Come informarsi senza farsi condizionare', 3),
  (mod_id, 'Terzo Check-up Trimestrale', 'Revisione completa del percorso', 4);

  -- Q4: Visione a Lungo Termine (Settimane 40-52)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q4 – Visione a Lungo Termine', 'Pianificare il lungo termine e consolidare le competenze', 4)
  RETURNING id INTO trim_id;

  -- Modulo 10: Gestione Portafoglio Avanzata (Settimane 40-45)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 10: Gestione Portafoglio Avanzata', 'Strategie di investimento più sofisticate', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Ribilanciare il portafoglio', 'Quando e come farlo correttamente', 1),
  (mod_id, 'L''orizzonte temporale', 'Adattare la strategia agli obiettivi di vita', 2),
  (mod_id, 'Il concetto di FIRE', 'Financial Independence, Retire Early', 3),
  (mod_id, 'Il tuo "numero" per l''indipendenza finanziaria', 'Calcolare quanto serve', 4),
  (mod_id, 'Bear Market', 'Come comportarsi quando il mercato scende', 5),
  (mod_id, 'Bull Market', 'Opportunità e pericoli del mercato al rialzo', 6);

  -- Modulo 11: Filosofia Finanziaria e Pianificazione Annuale (Settimane 46-52)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 11: Filosofia Finanziaria e Pianificazione Annuale', 'Rivedere il percorso e pianificare il futuro', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'L''arte di spendere con intenzione', 'Il denaro come strumento di libertà', 1),
  (mod_id, 'Manifesto Finanziario personale', 'I tuoi principi e valori col denaro', 2),
  (mod_id, 'Filantropia e dare indietro', 'L''importanza di contribuire alla comunità', 3),
  (mod_id, 'Formazione continua', 'Libri, podcast e risorse per crescere', 4),
  (mod_id, 'Piano finanziario completo', 'Mettere insieme tutti i pezzi', 5),
  (mod_id, 'Celebrare i successi', 'Riconoscere i progressi fatti', 6),
  (mod_id, 'Pianificare l''anno che verrà', 'Obiettivi e strategie per l''Anno 2', 7);

  -- ============================================================================
  -- TEMPLATE ANNO 2 - OTTIMIZZAZIONE E SCALING
  -- ============================================================================
  INSERT INTO university_templates (id, name, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Anno 2 – Ottimizzazione e Scaling', 'Il secondo anno: ottimizzazione del portafoglio, strategie avanzate e crescita patrimoniale', true, consultant_id)
  RETURNING id INTO template_id;

  -- Q1: Ottimizzazione Reddito e Business (Settimane 1-13)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q1 – Ottimizzazione Reddito e Business', 'Raffinare e migliorare il portafoglio esistente', 1)
  RETURNING id INTO trim_id;

  -- Modulo 1: Strategie Avanzate di Pricing (Settimane 1-3)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 1: Strategie Avanzate di Pricing', 'Tecniche avanzate di analisi', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Psicologia del pricing', 'Come posizionare i tuoi servizi/prodotti', 1),
  (mod_id, 'Value-based pricing vs cost-based', 'La differenza che fa la differenza', 2),
  (mod_id, 'Testing e ottimizzazione prezzi', 'Esperimenti controllati per massimizzare profitti', 3);

  -- Modulo 2: Automatizzazione del Business (Settimane 4-6)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 2: Automatizzazione del Business', 'Tecniche di ribilanciamento del portafoglio', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Processi e sistemi', 'Creare flussi di lavoro automatici', 1),
  (mod_id, 'Tool e software per l''automazione', 'Scegliere e implementare', 2),
  (mod_id, 'Delegare efficacemente', 'Quando e come esternalizzare', 3);

  -- Modulo 3: Scaling delle Entrate (Settimane 7-9)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 3: Scaling delle Entrate', 'Massimizzare l''efficienza fiscale', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Modelli di business scalabili', 'Passare da tempo per denaro a prodotti/servizi scalabili', 1),
  (mod_id, 'Marketing automation', 'Far crescere il fatturato senza crescere il tempo', 2),
  (mod_id, 'Upsell e cross-sell', 'Massimizzare il valore per cliente', 3);

  -- Modulo 4: Diversificazione delle Fonti di Reddito (Settimane 10-13)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 4: Diversificazione delle Fonti di Reddito', 'Creare flussi di reddito multipli', 4)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Creare 3-5 flussi di reddito', 'Strategia pratica', 1),
  (mod_id, 'Reddito attivo vs passivo', 'Bilanciare i due tipi', 2),
  (mod_id, 'Monetizzare competenze ed expertise', 'Consulenze, corsi, contenuti', 3),
  (mod_id, 'Check-up Q1 Anno 2', 'Analisi redditi e ottimizzazioni', 4);

  -- Q2: Investimenti Avanzati (Settimane 14-26)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q2 – Investimenti Avanzati', 'Esplorare asset class alternative', 2)
  RETURNING id INTO trim_id;

  -- Modulo 5: Asset Allocation Avanzata (Settimane 14-17)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 5: Asset Allocation Avanzata', 'Investimenti immobiliari strategici', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Strategie di allocazione per patrimoni crescenti', 'Come allocare il capitale in crescita', 1),
  (mod_id, 'Bilanciamento geografico', 'Investire oltre i confini nazionali', 2),
  (mod_id, 'Esposizione settoriale', 'Tematiche e trend di lungo periodo', 3),
  (mod_id, 'Copertura valutaria', 'Gestire il rischio cambio', 4);

  -- Modulo 6: Obbligazioni e Reddito Fisso (Settimane 18-21)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 6: Obbligazioni e Reddito Fisso', 'Investimenti in aziende non quotate', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Obbligazioni corporate e governative', 'Differenze e opportunità', 1),
  (mod_id, 'Duration e yield', 'Concetti chiave del reddito fisso', 2),
  (mod_id, 'Costruire una scala obbligazionaria', 'Strategia pratica', 3),
  (mod_id, 'Obbligazioni indicizzate all''inflazione', 'Protezione dal potere d''acquisto', 4);

  -- Modulo 7: Alternative Investments (Settimane 22-26)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 7: Alternative Investments', 'Criptovalute e blockchain', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Oro e metalli preziosi', 'Quando e quanto allocare', 1),
  (mod_id, 'Materie prime', 'Commodities come classe d''investimento', 2),
  (mod_id, 'Real estate avanzato', 'REIT e crowdfunding immobiliare', 3),
  (mod_id, 'Criptovalute e blockchain', 'Opportunità e rischi', 4),
  (mod_id, 'Check-up Q2 Anno 2', 'Revisione portafoglio avanzato', 5);

  -- Q3: Reddito Passivo e Rendite (Settimane 27-39)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q3 – Reddito Passivo e Rendite', 'Protezione sofisticata del patrimonio', 3)
  RETURNING id INTO trim_id;

  -- Modulo 8: Dividend Growth Investing (Settimane 27-30)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 8: Dividend Growth Investing', 'Strumenti di copertura', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Filosofia del dividend investing', 'Perché i dividendi contano', 1),
  (mod_id, 'Dividend Aristocrats e Kings', 'Selezionare le migliori società', 2),
  (mod_id, 'DRIP', 'Dividend Reinvestment Plans per accelerare la crescita', 3),
  (mod_id, 'Analisi fondamentale per dividendi', 'Payout ratio, yield, crescita', 4);

  -- Modulo 9: Costruzione Portafoglio Dividendi (Settimane 31-34)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 9: Costruzione Portafoglio Dividendi', 'Organizzazione giuridica del patrimonio', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Diversificazione settoriale nel portafoglio dividendi', 'Bilanciare i settori', 1),
  (mod_id, 'ETF dividendi vs selezione titoli individuali', 'Scegliere l''approccio migliore', 2),
  (mod_id, 'Calendario dividendi', 'Ottimizzare il flusso di cassa mensile', 3),
  (mod_id, 'Tax efficiency nel dividend investing', 'Ottimizzazione fiscale', 4);

  -- Modulo 10: Immobiliare da Reddito e Altre Rendite (Settimane 35-39)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 10: Immobiliare da Reddito e Altre Rendite', 'Diversificazione geografica', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Immobiliare da reddito', 'Affitti e buy-to-let', 1),
  (mod_id, 'Gestione proprietà in affitto', 'Strategie e best practices', 2),
  (mod_id, 'Royalties e licensing', 'Monetizzare proprietà intellettuale', 3),
  (mod_id, 'Peer-to-peer lending', 'Opportunità e rischi', 4),
  (mod_id, 'Check-up Q3 Anno 2', 'Analisi flussi di reddito passivo', 5);

  -- Q4: Ottimizzazione Fiscale Avanzata (Settimane 40-52)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q4 – Ottimizzazione Fiscale Avanzata', 'Creare flussi di reddito aggiuntivi', 4)
  RETURNING id INTO trim_id;

  -- Modulo 11: Tax Loss Harvesting e Strategie Fiscali (Settimane 40-44)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 11: Tax Loss Harvesting e Strategie Fiscali', 'Costruire flussi di reddito automatici', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Tax loss harvesting', 'Ottimizzare le minusvalenze', 1),
  (mod_id, 'Regime amministrato vs dichiarativo', 'Pro e contro', 2),
  (mod_id, 'Donazioni e deduzioni fiscali', 'Strategie di ottimizzazione', 3),
  (mod_id, 'Fondi pensione e previdenza complementare', 'Vantaggi fiscali', 4),
  (mod_id, 'Timing fiscale', 'Quando realizzare plusvalenze', 5);

  -- Modulo 12: Strutture Patrimoniali e Successorie (Settimane 45-49)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 12: Strutture Patrimoniali e Successorie', 'Investire in un''attività', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Trust e holding familiari', 'Quando considerarli', 1),
  (mod_id, 'Protezione patrimoniale', 'Strumenti legali e finanziari', 2),
  (mod_id, 'Pianificazione successoria avanzata', 'Ridurre imposte di successione', 3),
  (mod_id, 'Fondazioni e enti', 'Veicoli per filantropia strutturata', 4),
  (mod_id, 'Asset protection internazionale', 'Diversificazione giurisdizionale', 5);

  -- Modulo 13: Chiusura Anno 2 (Settimane 50-52)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 13: Chiusura Anno 2', 'Recap e pianificazione', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Bilancio Anno 2', 'Progressi e risultati', 1),
  (mod_id, 'Ottimizzazioni finali', 'Aggiustamenti di portafoglio', 2),
  (mod_id, 'Strategia Anno 3', 'Verso la libertà finanziaria', 3);

  -- ============================================================================
  -- TEMPLATE ANNO 3 - LIBERTÀ FINANZIARIA E LEGACY
  -- ============================================================================
  INSERT INTO university_templates (id, name, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Anno 3 – Libertà Finanziaria e Legacy', 'Il terzo anno: padronanza completa e pianificazione del lascito', true, consultant_id)
  RETURNING id INTO template_id;

  -- Q1: Autonomia Finanziaria (Settimane 1-13)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q1 – Autonomia Finanziaria', 'Pensare come un investitore istituzionale', 1)
  RETURNING id INTO trim_id;

  -- Modulo 1: Calcolo e Raggiungimento della Libertà Finanziaria (Settimane 1-4)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 1: Calcolo e Raggiungimento della Libertà Finanziaria', 'Comprendere i cicli economici', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Calcolare il numero esatto per la libertà finanziaria', 'Formula e personalizzazione', 1),
  (mod_id, 'La regola del 4%', 'Validità e aggiustamenti necessari', 2),
  (mod_id, 'Sequence of returns risk', 'Il rischio del timing nel ritiro', 3),
  (mod_id, 'Strategie di withdrawal', 'Come prelevare senza intaccare il capitale', 4);

  -- Modulo 2: Early Retirement Strategies (Settimane 5-8)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 2: Early Retirement Strategies', 'Strategie tattiche di allocazione', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'FIRE variations', 'Lean, Fat, Barista, Coast FIRE', 1),
  (mod_id, 'Healthcare in early retirement', 'Gestire costi sanitari senza lavoro', 2),
  (mod_id, 'Psicologia dell''early retirement', 'Prepararsi mentalmente', 3),
  (mod_id, 'Attività post-retirement', 'Dare significato alla libertà finanziaria', 4);

  -- Modulo 3: Diversificazione Geografica (Settimane 9-13)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 3: Diversificazione Geografica', 'Investire sui fattori di rischio', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Investimenti internazionali', 'Oltre i mercati domestici', 1),
  (mod_id, 'Conti bancari esteri', 'Quando e perché aprirli', 2),
  (mod_id, 'Tax residency e domicilio fiscale', 'Ottimizzazione geografica', 3),
  (mod_id, 'Geo-arbitrage', 'Vivere in paesi a costo minore', 4),
  (mod_id, 'Check-up Q1 Anno 3', 'Verifica percorso verso indipendenza', 5);

  -- Q2: Business Scalabile e Exit (Settimane 14-26)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q2 – Business Scalabile e Exit', 'Family office e governance familiare', 2)
  RETURNING id INTO trim_id;

  -- Modulo 4: Delega e Team Building (Settimane 14-17)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 4: Delega e Team Building', 'Gestire il patrimonio familiare', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Costruire un team di eccellenza', 'Hiring e cultura aziendale', 1),
  (mod_id, 'Leadership e gestione', 'Guidare senza micromanagement', 2),
  (mod_id, 'KPI e metriche aziendali', 'Monitorare performance', 3),
  (mod_id, 'Delega strategica', 'Liberare il tuo tempo', 4);

  -- Modulo 5: Sistemi e Processi (Settimane 18-21)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 5: Sistemi e Processi', 'Regole e strutture decisionali', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Documentare processi aziendali', 'SOP e playbook', 1),
  (mod_id, 'Software e tool per scalare', 'Tech stack ottimale', 2),
  (mod_id, 'Customer success e retention', 'Mantenere i clienti', 3),
  (mod_id, 'Automazione vendite e marketing', 'Funnel automatizzati', 4);

  -- Modulo 6: Exit Strategy (Settimane 22-26)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 6: Exit Strategy', 'Trasmettere i valori finanziari', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Valutare la tua azienda', 'Multipli e metodi di valutazione', 1),
  (mod_id, 'Preparare l''azienda alla vendita', 'Due diligence readiness', 2),
  (mod_id, 'Trovare acquirenti', 'M&A e marketplace', 3),
  (mod_id, 'Negoziazione vendita', 'Deal structure e earn-out', 4),
  (mod_id, 'Check-up Q2 Anno 3', 'Stato business e exit planning', 5);

  -- Q3: Investimenti Sofisticati (Settimane 27-39)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q3 – Investimenti Sofisticati', 'Investire con uno scopo', 3)
  RETURNING id INTO trim_id;

  -- Modulo 7: Private Equity (Settimane 27-30)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 7: Private Equity', 'Donare in modo efficace', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Introduzione al private equity', 'Come funziona', 1),
  (mod_id, 'Accesso al private equity', 'Fondi e piattaforme', 2),
  (mod_id, 'Due diligence in private equity', 'Valutare opportunità', 3),
  (mod_id, 'Risk/return nel private equity', 'Aspettative realistiche', 4);

  -- Modulo 8: Venture Capital (Settimane 31-34)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 8: Venture Capital', 'Investimenti a impatto sociale', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Angel investing', 'Investire in startup', 1),
  (mod_id, 'Portfolio approach nel VC', 'Strategia 10x', 2),
  (mod_id, 'Equity crowdfunding', 'Opportunità e piattaforme', 3),
  (mod_id, 'Valutare startup', 'Pitch deck, traction, team', 4);

  -- Modulo 9: Hedge Funds e Alternative Avanzati (Settimane 35-39)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 9: Hedge Funds e Alternative Avanzati', 'Pianificare il lascito', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Hedge funds', 'Strategie e accesso', 1),
  (mod_id, 'Managed futures e CTA', 'Diversificazione strategica', 2),
  (mod_id, 'Art e collectibles', 'Investimenti alternativi tangibili', 3),
  (mod_id, 'Farmland e timberland', 'Investimenti reali a lungo termine', 4),
  (mod_id, 'Check-up Q3 Anno 3', 'Portfolio sofisticato', 5);

  -- Q4: Legacy e Impatto (Settimane 40-52)
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q4 – Legacy e Impatto', 'Creare un impatto duraturo', 4)
  RETURNING id INTO trim_id;

  -- Modulo 10: Family Office Personale (Settimane 40-43)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 10: Family Office Personale', 'Gestione patrimoniale completa', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Cos''è un family office', 'Virtual vs single family office', 1),
  (mod_id, 'Wealth management integrato', 'Coordinare professionisti', 2),
  (mod_id, 'Governance familiare', 'Decision making e coinvolgimento generazioni', 3),
  (mod_id, 'Educazione finanziaria degli eredi', 'Preparare la successione', 4);

  -- Modulo 11: Filantropia Strategica (Settimane 44-47)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 11: Filantropia Strategica', 'Dare indietro in modo strutturato', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Impact investing', 'Investire con impatto sociale', 1),
  (mod_id, 'Donor-advised funds', 'Strumenti di donazione', 2),
  (mod_id, 'Fondazioni private', 'Creare e gestire', 3),
  (mod_id, 'Measuring impact', 'Metriche di impatto sociale', 4);

  -- Modulo 12: Trasmissione Valori e Mentorship (Settimane 48-52)
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 12: Trasmissione Valori e Mentorship', 'Completamento del percorso', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Codificare valori familiari', 'Mission e vision familiare', 1),
  (mod_id, 'Mentorship e dare indietro', 'Diventare guida per altri', 2),
  (mod_id, 'Continuous learning', 'Restare aggiornati ed evolversi', 3),
  (mod_id, 'Bilancio finale', 'Celebrare il percorso triennale', 4),
  (mod_id, 'Oltre l''università', 'Mantenimento e crescita continua', 5);

END $$;
