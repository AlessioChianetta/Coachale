
-- Migration: Insert Metodo Hybrid Template Structure
-- This creates Anno 1 - Metodo Hybrid with Trimester 1 and Trimester 2

DO $$
DECLARE
  template_id UUID;
  trim_id UUID;
  mod_id UUID;
  consultant_id UUID;
BEGIN
  -- Get the first consultant ID
  SELECT id INTO consultant_id FROM users WHERE role = 'consultant' LIMIT 1;

  -- ============================================================================
  -- TEMPLATE ANNO 1 - METODO HYBRID
  -- ============================================================================
  INSERT INTO university_templates (id, name, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Anno 1 – Metodo Hybrid', 'Costruisci la tua attività da zero: fondamenta strategiche e vendita ad alto livello', true, consultant_id)
  RETURNING id INTO template_id;

  -- ============================================================================
  -- Q1: Le Fondamenta della Tua Attività
  -- ============================================================================
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q1 – Le Fondamenta della Tua Attività', 'Costruire le basi strategiche per un business di successo', 1)
  RETURNING id INTO trim_id;

  -- Modulo 1: Le fondamenta della tua attività
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 1: Le Fondamenta della Tua Attività', 'Definire nicchia, offerta e proposta di valore unica', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Ipotizziamo la nicchia di mercato', 'Identificare e validare il tuo mercato target ideale', 1),
  (mod_id, 'Lezione 2: Architettura di un''Offerta Premium', 'Strutturare un''offerta ad alto valore percepito', 2),
  (mod_id, 'Lezione 3: Creazione della Tua Proposta di Valore Unica', 'Differenziarti dalla concorrenza con una UVP forte', 3);

  -- ============================================================================
  -- Q2: Metodo Turbo - Diventa Invincibile a Vendere
  -- ============================================================================
  INSERT INTO template_trimesters (id, template_id, title, description, sort_order)
  VALUES (gen_random_uuid(), template_id, 'Q2 – Metodo Turbo: Diventa Invincibile a Vendere', 'Padroneggiare l''arte della vendita ad alto ticket', 2)
  RETURNING id INTO trim_id;

  -- Modulo 1: Mentalità e Fondamenta del Venditore da 1 Milione di Euro
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 1: Mentalità e Fondamenta del Venditore da 1 Milione di Euro', 'Preparazione psicologica e atteggiamento per eccellere', 1)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Introduzione alla vendita e Obiettivi', 'I fondamenti della vendita professionale', 1),
  (mod_id, 'Lezione 2: Il Lavoro Interiore e la Mentalità dell''Aiuto', 'Sviluppare il mindset del venditore di successo', 2),
  (mod_id, 'Lezione 3: La Pratica Deliberata: Come Diventare un Professionista', 'Tecniche di allenamento per la maestria', 3),
  (mod_id, 'Lezione 4: L''Ambiente del Successo: Preparazione Fisica e Mentale', 'Creare le condizioni ottimali per performare', 4);

  -- Modulo 2: La Psicologia della Vendita e il Posizionamento d'Autorità
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 2: La Psicologia della Vendita e il Posizionamento d''Autorità', 'Principi psicologici e posizionamento come autorità', 2)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Vendere la Trasformazione: Il Concetto del "Ponte"', 'Come vendere il risultato finale, non il processo', 1),
  (mod_id, 'Lezione 2: La Postura del "Dottore": Diagnosticare, non Curare', 'Approccio consultivo alla vendita', 2),
  (mod_id, 'Lezione 3: Lo "Status Delta": Cos''è e Perché è Fondamentale', 'Comprendere e creare il gap di status', 3),
  (mod_id, 'Lezione 4: Come Creare e Mantenere lo Status Delta', 'Tecniche pratiche per mantenere l''autorità', 4);

  -- Modulo 3: Comunicazione Persuasiva: Tonalità e Linguaggio del Corpo
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 3: Comunicazione Persuasiva: Tonalità e Linguaggio del Corpo', 'Tecniche di comunicazione non verbale per vendere', 3)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: I Segreti della Comunicazione Non Verbale', 'Padroneggiare il linguaggio del corpo', 1),
  (mod_id, 'Lezione 2: Le 7 Tonalità Chiave della Persuasione', 'Usare la voce come strumento di vendita', 2);

  -- Modulo 4: Preparazione Strategica e Strumenti del Mestiere
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 4: Preparazione Strategica e Strumenti del Mestiere', 'Preparazione e strumenti essenziali del venditore', 4)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: L''Interdipendenza tra Marketing e Vendite: La Regola delle 7 Ore', 'Sinergia tra marketing e vendite', 1),
  (mod_id, 'Lezione 2: Gli Strumenti Essenziali del Venditore', 'Tool e risorse per vendere efficacemente', 2),
  (mod_id, 'Lezione 3: La Preparazione del Lead: Come "Riscaldare" il Cliente Prima della Chiamata', 'Strategie di pre-call warming', 3);

  -- Modulo 5: La Chiamata di Vendita (Parte 1) - La Diagnosi
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 5: La Chiamata di Vendita (Parte 1) - La Diagnosi', 'Le prime fasi della chiamata di vendita perfetta', 5)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Fasi 1 & 2 - L''Apertura Perfetta', 'Come iniziare la chiamata con impatto', 1),
  (mod_id, 'Lezione 2: Fasi 3 & 4 - Indagare la Motivazione Reale', 'Scoprire il vero motivo d''acquisto', 2),
  (mod_id, 'Lezione 3: Fase 5 & 6 - "Stretch the Gap": Fissare il Problema e Definire il Desiderio', 'Amplificare il gap tra situazione attuale e desiderata', 3),
  (mod_id, 'Lezione 4: Fasi 7, 8 & 9 - Qualifica Finale e Transizione', 'Qualificare il prospect e passare all''offerta', 4);

  -- Modulo 6: La Chiamata di Vendita (Parte 2) - Presentazione e Ancoraggio del Valore
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 6: La Chiamata di Vendita (Parte 2) - Presentazione e Ancoraggio del Valore', 'Presentare l''offerta e ancorare il valore', 6)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Presentare il Metodo, i Casi di Studio e la Storia Aziendale', 'Costruire credibilità e fiducia', 1),
  (mod_id, 'Lezione 2: Dalle Caratteristiche ai Benefici: Spiegare l''Offerta in Dettaglio', 'Tradurre features in benefici tangibili', 2),
  (mod_id, 'Lezione 3: Lo "Stack" del Valore: Ancorare il Prezzo Prima di Rivelarlo', 'Tecnica dello stack per giustificare il prezzo', 3);

  -- Modulo 7: La Chiusura: Gestione delle Obiezioni e "Looping"
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 7: La Chiusura: Gestione delle Obiezioni e "Looping"', 'Chiudere la vendita e gestire le resistenze', 7)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Fase 11 - Presentare il Prezzo e Giustificare il ROI', 'Come presentare il prezzo con sicurezza', 1),
  (mod_id, 'Lezione 2: Fase 12 - Il "Looping" con Incentivi, Urgenza e Scarsità', 'Tecniche di looping per chiudere', 2),
  (mod_id, 'Lezione 3: L''Inversione del Rischio e la Strategia del Deposito', 'Rimuovere il rischio percepito', 3),
  (mod_id, 'Lezione 4: Gestire il Pagamento e le Obiezioni Finali', 'Finalizzare la transazione', 4);

  -- Modulo 8: Il Post-Vendita e il Follow-up Strategico
  INSERT INTO template_modules (id, template_trimester_id, title, description, sort_order)
  VALUES (gen_random_uuid(), trim_id, 'Modulo 8: Il Post-Vendita e il Follow-up Strategico', 'Massimizzare il valore del cliente nel tempo', 8)
  RETURNING id INTO mod_id;

  INSERT INTO template_lessons (template_module_id, title, description, sort_order) VALUES
  (mod_id, 'Lezione 1: Prevenire il "Rimorso dell''Acquirente"', 'Consolidare la vendita post-acquisto', 1),
  (mod_id, 'Lezione 2: Procedure Post-Chiamata e Follow-up per la Chiusura', 'Sistemi di follow-up efficaci', 2),
  (mod_id, 'Lezione 3: Il Follow-up Strategico per Chi Non Chiude Subito', 'Nurturing dei prospect non ancora pronti', 3),
  (mod_id, 'Lezione 4: La Campagna di Nurturing a Lungo Termine', 'Costruire relazioni durature', 4);

END $$;
