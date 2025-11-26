
-- Inserimento Template "Metodo Orbitale - Da 0 a 1.000.000 - Anno 1"
-- Struttura: 4 Trimestri (Q1-Q4), 4 Moduli, 53 Lezioni

DO $$
DECLARE
    template_id_var VARCHAR;
    trim_q1_id VARCHAR;
    trim_q2_id VARCHAR;
    trim_q3_id VARCHAR;
    trim_q4_id VARCHAR;
    mod_q1_id VARCHAR;
    mod_q2_id VARCHAR;
    mod_q3_id VARCHAR;
    mod_q4_id VARCHAR;
BEGIN
    -- 1. Crea il Template principale
    INSERT INTO university_templates (name, description, is_active, created_by)
    VALUES (
        'Metodo Orbitale - Da 0 a 1.000.000 - Anno 1',
        'Il tuo percorso per diventare libero finanziariamente - Anno 1 - 53 lezioni in 4 trimestri',
        true,
        (SELECT id FROM users WHERE role = 'consultant' LIMIT 1)
    )
    RETURNING id INTO template_id_var;

    -- 2. Crea i 4 Trimestri (Q1-Q4)
    INSERT INTO template_trimesters (template_id, title, description, sort_order)
    VALUES (
        template_id_var,
        'Q1 - Anno 1: Le Fondamenta',
        'Il mindset del denaro e la fotografia della tua situazione attuale - 13 lezioni',
        1
    )
    RETURNING id INTO trim_q1_id;

    INSERT INTO template_trimesters (template_id, title, description, sort_order)
    VALUES (
        template_id_var,
        'Q2 - Anno 1: Costruzione della Ricchezza',
        'Costruiamo ricchezza per sempre - 13 lezioni',
        2
    )
    RETURNING id INTO trim_q2_id;

    INSERT INTO template_trimesters (template_id, title, description, sort_order)
    VALUES (
        template_id_var,
        'Q3 - Anno 1: Ottimizzazione e Vita da Comandante',
        'Progettiamo, ottimizziamo e comandiamo le finanze - 14 lezioni',
        3
    )
    RETURNING id INTO trim_q3_id;

    INSERT INTO template_trimesters (template_id, title, description, sort_order)
    VALUES (
        template_id_var,
        'Q4 - Anno 1: Eredità e Comando Perpetuo',
        'Navighiamo nella tua futura eredità - 13 lezioni',
        4
    )
    RETURNING id INTO trim_q4_id;

    -- 3. Crea i Moduli (uno per trimestre)
    INSERT INTO template_modules (template_trimester_id, title, description, sort_order)
    VALUES (
        trim_q1_id,
        'Modulo Q1: Le Fondamenta',
        'Il mindset del denaro e la fotografia della tua situazione attuale',
        1
    )
    RETURNING id INTO mod_q1_id;

    INSERT INTO template_modules (template_trimester_id, title, description, sort_order)
    VALUES (
        trim_q2_id,
        'Modulo Q2: Costruzione della Ricchezza',
        'Costruiamo ricchezza per sempre',
        1
    )
    RETURNING id INTO mod_q2_id;

    INSERT INTO template_modules (template_trimester_id, title, description, sort_order)
    VALUES (
        trim_q3_id,
        'Modulo Q3: Ottimizzazione e Vita da Comandante',
        'Progettiamo, ottimizziamo e comandiamo',
        1
    )
    RETURNING id INTO mod_q3_id;

    INSERT INTO template_modules (template_trimester_id, title, description, sort_order)
    VALUES (
        trim_q4_id,
        'Modulo Q4: Eredità e Comando Perpetuo',
        'Navighiamo nella tua futura eredità',
        1
    )
    RETURNING id INTO mod_q4_id;

    -- 4. Q1 - LE FONDAMENTA (13 lezioni: Cap 0-12)
    INSERT INTO template_lessons (template_module_id, title, description, sort_order, library_document_id)
    VALUES 
    (mod_q1_id, 'Capitolo 0 Introduzione, COMANDA LE TUE FINANZE', 'Aiuto imprenditori, liberi professionisti e dipendenti a creare, gestire e proteggere il proprio denaro', 1,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 0 Introduzione, COMANDA LE TUE FINANZE' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 1: La Causa - Il Tuo "Perché" Strategico', 'Trova la tua stella polare finanziaria!', 2,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 1: La Causa - Il Tuo "Perché" Strategico' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 2: La Mappa del Tesoro - Diagnosi del Tuo Patrimonio Netto', 'La Verità dei Numeri: Misura la Tua Ricchezza Reale', 3,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 2: La Mappa del Tesoro - Diagnosi del Tuo Patrimonio Netto' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 3: Intelligence Finanziaria - Padroneggiare i Flussi di Cassa', 'Segui i Soldi: Diventa l''Agente Segreto delle Tue Finanze', 4,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 3: Intelligence Finanziaria - Padroneggiare i Flussi di Cassa' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 4: Il Piano di Comando - Dall''Anarchia al Controllo', 'Prendi il Timone: Assegna una Missione a Ogni Euro', 5,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 4: Il Piano di Comando - Dall''Anarchia al Controllo' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 5: Le Catene Invisibili - Dichiarazione di Guerra al Debito Tossico', 'Libera il Tuo Futuro: Annienta i Debiti Nocivi', 6,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 5: Le Catene Invisibili - Dichiarazione di Guerra al Debito Tossico' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 6: Lo Scudo Infrangibile - Costruire la Tua Riserva d''Emergenza', 'La Fortezza Anti-Imprevisti: Il Tuo Airbag Finanziario', 7,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 6: Lo Scudo Infrangibile - Costruire la Tua Riserva d''Emergenza' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 7: Il Fossato della Fortezza - Un Uso Strategico delle Assicurazioni', 'Proteggi il Regno: Assicurati Solo per le Catastrofi', 8,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 7: Il Fossato della Fortezza - Un Uso Strategico delle Assicurazioni' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 8: Il Tuo Asset Invisibile - Padroneggiare il Merito Creditizio', 'La Tua Reputazione Finanziaria: La Chiave d''Oro per le Opportunità', 9,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 8: Il Tuo Asset Invisibile - Padroneggiare il Merito Creditizio' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 9: Le Forze Gemelle - Interesse Composto e Inflazione', 'Il Creatore e il Distruttore: Comprendi le Leggi del Tempo', 10,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 9: Le Forze Gemelle - Interesse Composto e Inflazione' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 10: L''Identità dell''Investitore - Strategia, Rischio e Azzardo', 'Chi Sei nel Gioco dei Soldi? Scegli la Tua Strategia', 11,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 10: L''Identità dell''Investitore - Strategia, Rischio e Azzardo' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 11: I Mattoni della Ricchezza - Azioni e Obbligazioni', 'Il Motore e i Freni: Costruisci il Tuo Portafoglio', 12,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 11: I Mattoni della Ricchezza - Azioni e Obbligazioni' AND is_published = true LIMIT 1)),
    
    (mod_q1_id, 'Capitolo 12: L''Unico Pranzo Gratis della Finanza - La Magia della Diversificazione', 'Non Mettere Tutte le Uova Nello Stesso Paniere (e Perché)', 13,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 12: L''Unico Pranzo Gratis della Finanza - La Magia della Diversificazione' AND is_published = true LIMIT 1));

    -- 5. Q2 - COSTRUZIONE DELLA RICCHEZZA (13 lezioni: Cap 13-25)
    INSERT INTO template_lessons (template_module_id, title, description, sort_order, library_document_id)
    VALUES 
    (mod_q2_id, 'Capitolo 13: Lo Strumento Definitivo - Gli ETF e la Rivoluzione Passiva', 'Il Tuo Passaporto per il Mercato Globale (a Basso Costo)', 1,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 13: Lo Strumento Definitivo - Gli ETF e la Rivoluzione Passiva' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 14: Il Tuo Negozio di Investimenti - Scegliere il Broker Giusto (e Non Farsi Fregare)', 'Apri la Tua "Ferramenta" Finanziaria: La Guida alla Scelta', 2,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 14: Il Tuo Negozio di Investimenti - Scegliere il Broker Giusto (e Non Farsi Fregare)' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 15: Il Pilota Automatico per Investire - La Superiorità Strategica del Piano di Accumulo (PAC)', 'Metti il Turbo alla Disciplina: Investi Senza Pensarci', 3,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 15: Il Pilota Automatico per Investire - La Superiorità Strategica del Piano di Accumulo (PAC)' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 16: La Macchina del Tempo Finanziaria - Progettare la Tua Pensione', 'Parla con il Tuo Io Futuro: Costruisci Oggi la Tua Serenità', 4,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 16: La Macchina del Tempo Finanziaria - Progettare la Tua Pensione' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 17: La Guerra nella Tua Mente - Sconfiggere i Nemici Psicologici dell''Investitore', 'Il Tuo Peggior Nemico Sei Tu: Domina le Tue Emozioni', 5,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 17: La Guerra nella Tua Mente - Sconfiggere i Nemici Psicologici dell''Investitore' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 18: La Verità sul Mattone - L''Investimento Immobiliare tra Mito e Realtà', 'Il Sogno Italiano Sotto la Lente: Pro e Contro dell''Immobiliare', 6,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 18: La Verità sul Mattone - L''Investimento Immobiliare tra Mito e Realtà' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 19: Il Tuo Socio Silenzioso - Capire le Tasse sugli Investimenti (senza mal di testa)', 'Non Aver Paura del Fisco: Conosci le Regole del Gioco', 7,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 19: Il Tuo Socio Silenzioso - Capire le Tasse sugli Investimenti (senza mal di testa)' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 20: L''Arte dell''Efficienza - Strategie Fiscali per Massimizzare i Rendimenti Netti', 'Metti il Turbo ai Guadagni: Paga le Tasse in Modo Intelligente', 8,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 20: L''Arte dell''Efficienza - Strategie Fiscali per Massimizzare i Rendimenti Netti' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 21: Il Tuo Asset da un Milione di Euro - Massimizzare la Carriera', 'Il Tuo Lavoro è Oro: Trasformalo in un Motore di Ricchezza', 9,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 21: Il Tuo Asset da un Milione di Euro - Massimizzare la Carriera' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 22: La Diversificazione del Reddito - Creare la Tua Prima Entrata Extra (Side Hustle)', 'Non Dipendere da un Solo Padrone: Costruisci la Tua Rete di Sicurezza', 10,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 22: La Diversificazione del Reddito - Creare la Tua Prima Entrata Extra (Side Hustle)' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 23: Il Salto Quantico - Da Side Hustle a Vero Business', 'Fai Crescere la Tua Creatura: Struttura e Scala la Tua Attività', 11,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 23: Il Salto Quantico - Da Side Hustle a Vero Business' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 24: Il Denaro nelle Relazioni - Costruire un Impero di Squadra', 'Finanza a Due: Trasforma il Partner nel Tuo Migliore Alleato', 12,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 24: Il Denaro nelle Relazioni - Costruire un Impero di Squadra' AND is_published = true LIMIT 1)),
    
    (mod_q2_id, 'Capitolo 25: L''Eredità più Grande - Educazione Finanziaria per i Figli', 'Non Solo Soldi, Ma Saggezza: Prepara i Tuoi Figli al Futuro', 13,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 25: L''Eredità più Grande - Educazione Finanziaria per i Figli' AND is_published = true LIMIT 1));

    -- 6. Q3 - OTTIMIZZAZIONE E VITA DA COMANDANTE (14 lezioni: Cap 26-39)
    INSERT INTO template_lessons (template_module_id, title, description, sort_order, library_document_id)
    VALUES 
    (mod_q3_id, 'Capitolo 26: La Filosofia F.I.R.E. - Ingegneria Inversa della Libertà', 'Accelera Verso la Libertà: Compra il Tuo Tempo, Non Solo Cose', 1,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 26: La Filosofia F.I.R.E. - Ingegneria Inversa della Libertà' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 27: Il Numero della Libertà - Calcolare il Tuo Traguardo per l''Indipendenza Finanziaria', 'Quanto Costa la Tua Libertà? Dai un Numero al Tuo Sogno', 2,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 27: Il Numero della Libertà - Calcolare il Tuo Traguardo per l''Indipendenza Finanziaria' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 28: Manuale di Sopravvivenza per l''Inverno Finanziario (Come Affrontare un Mercato al Ribasso)', 'Tempesta in Arrivo? Resta al Timone e Non Mollare', 3,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 28: Manuale di Sopravvivenza per l''Inverno Finanziario (Come Affrontare un Mercato al Ribasso)' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 29: La Trappola dell''Euforia - Gestire un Mercato al Rialzo (e Non Diventare il Tuo Peggior Nemico)', 'Sole Splendente? Non Farti Accecare dall''Arroganza', 4,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 29: La Trappola dell''Euforia - Gestire un Mercato al Rialzo (e Non Diventare il Tuo Peggior Nemico)' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 30: La Manutenzione della Macchina - Rivedere e Ribilanciare il Tuo Portafoglio', 'Il Tagliando del Tuo Motore: Mantieni l''Equilibrio Perfetto', 5,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 30: La Manutenzione della Macchina - Rivedere e Ribilanciare il Tuo Portafoglio' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 31: La Variabile Dominante - Padroneggiare l''Orizzonte Temporale', 'Il Tempo è il Capitano: Scegli la Rotta Giusta per Ogni Viaggio', 6,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 31: La Variabile Dominante - Padroneggiare l''Orizzonte Temporale' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 32: L''Ultima Frontiera - Usare i Soldi per Comprare la Felicità (Sì, è Possibile)', 'Il Vero Scopo dei Soldi: Investi nella Tua Gioia di Vivere', 7,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 32: L''Ultima Frontiera - Usare i Soldi per Comprare la Felicità (Sì, è Possibile)' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 33: La Tua Costituzione Personale - Creare il Tuo Manifesto Finanziario', 'Nero su Bianco: Incidi i Tuoi Principi Guida Inattaccabili', 8,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 33: La Tua Costituzione Personale - Creare il Tuo Manifesto Finanziario' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 34: L''Eredità del Comando - Pianificazione Successoria e Responsabilità', 'Proteggi Chi Ami: Prendi il Controllo Anche del "Dopo"', 9,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 34: L''Eredità del Comando - Pianificazione Successoria e Responsabilità' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 35: Il Cerchio si Chiude - La Ricchezza che si Ottiene Donando', 'Abbondanza Chiama Abbondanza: Il Potere Strategico della Generosità', 10,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 35: Il Cerchio si Chiude - La Ricchezza che si Ottiene Donando' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 36: La Dieta dell''Informazione - Navigare le Notizie Finanziarie Senza Impazzire', 'Spegni il Rumore, Accendi il Cervello: Filtra le Notizie Inutili', 11,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 36: La Dieta dell''Informazione - Navigare le Notizie Finanziarie Senza Impazzire' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 37: Affilare la Lama - L''Impegno per una Formazione Finanziaria Continua', 'Il Tuo Allenamento Non Finisce Mai: Resta Curioso, Resta Competente', 12,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 37: Affilare la Lama - L''Impegno per una Formazione Finanziaria Continua' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 38: Il GPS per la Vita - Assemblare il Tuo Piano Finanziario Completo', 'La Mappa Definitiva: Metti Tutti i Pezzi Insieme', 13,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 38: Il GPS per la Vita - Assemblare il Tuo Piano Finanziario Completo' AND is_published = true LIMIT 1)),
    
    (mod_q3_id, 'Capitolo 39: L''Arte della Celebrazione e il Ritmo del Successo', 'Pausa e Applausi: Ricarica le Batterie per la Lunga Corsa', 14,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 39: L''Arte della Celebrazione e il Ritmo del Successo' AND is_published = true LIMIT 1));

    -- 7. Q4 - EREDITÀ E COMANDO PERPETUO (13 lezioni: Cap 40-52)
    INSERT INTO template_lessons (template_module_id, title, description, sort_order, library_document_id)
    VALUES 
    (mod_q4_id, 'Capitolo 40: La Fine dell''Inizio - Trasformare Questo percorso in una Vita di Ricchezza', 'Hai Imparato a Pilotare: Ora Inizia il Tuo Viaggio Infinito', 1,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 40: La Fine dell''Inizio - Trasformare Questo percorso in una Vita di Ricchezza' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 41: Oltre il Numero - La Vita Dopo l''Indipendenza Finanziaria', 'La Vetta è Raggiunta, e Adesso? Progetta la Tua Libertà', 2,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 41: Oltre il Numero - La Vita Dopo l''Indipendenza Finanziaria' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 42: La Fase di Decumulo - Come Prelevare dal Tuo Portafoglio in Modo Intelligente', 'Vivere di Rendita: Strategie per Far Durare il Tuo Tesoro', 3,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 42: La Fase di Decumulo - Come Prelevare dal Tuo Portafoglio in Modo Intelligente' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 43: L''Arte del Lavoro Opzionale - Ridefinire il Successo e lo Scopo', 'Lavorare per Scelta, Non per Forza: Trova il Tuo Nuovo Significato', 4,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 43: L''Arte del Lavoro Opzionale - Ridefinire il Successo e lo Scopo' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 44: Il Patrimonio Olistico - Investire in Salute, Relazioni e Conoscenza', 'La Vera Ricchezza Non è Solo Denaro: Coltiva Ogni Tuo Capitale', 5,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 44: Il Patrimonio Olistico - Investire in Salute, Relazioni e Conoscenza' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 45: Resilienza a Lungo Termine - Adattare il Piano ai Grandi Cambiamenti della Vita', 'La Vita Accade: Ricalibra la Rotta Senza Perdere la Bussola', 6,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 45: Resilienza a Lungo Termine - Adattare il Piano ai Grandi Cambiamenti della Vita' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 46: Costruire una "Dinastia" - La Gestione Patrimoniale Intergenerazionale', 'Oltre Te Stesso: Lascia un''Eredità Che Duri nel Tempo', 7,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 46: Costruire una "Dinastia" - La Gestione Patrimoniale Intergenerazionale' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 47: Il Viaggio Infinito - La Tua Eredità di Saggezza', 'La Fine è Solo l''Inizio: Continua a Imparare, Continua a Crescere', 8,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 47: Il Viaggio Infinito - La Tua Eredità di Saggezza' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 48: Glossario Strategico - Il Tuo Dizionario per il Comando Finanziario', 'Parla la Lingua del Successo: I Termini Chiave a Portata di Mano', 9,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 48: Glossario Strategico - Il Tuo Dizionario per il Comando Finanziario' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 49: Il Comando è Tuo', 'Hai la Mappa, Hai la Bussola: Prendi il Timone del Tuo Destino', 10,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 49: Il Comando è Tuo' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 50: Il Progetto Definitivo - Creare il Tuo Piano Finanziario Completo (Il Tuo GPS per la Vita)', 'Di Nuovo la Mappa Definitiva: Metti Tutti i Pezzi Insieme (Ripasso Cap. 38)', 11,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 50: Il Progetto Definitivo - Creare il Tuo Piano Finanziario Completo (Il Tuo GPS per la Vita)' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 51: L''Arte della Celebrazione - Il Ritmo Sostenibile del Successo', 'Di Nuovo Pausa e Applausi: Ricarica le Batterie (Ripasso Cap. 39)', 12,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 51: L''Arte della Celebrazione - Il Ritmo Sostenibile del Successo' AND is_published = true LIMIT 1)),
    
    (mod_q4_id, 'Capitolo 52: La Fine dell''Inizio - Il Tuo Comando Perpetuo', 'Il Volo è Appena Cominciato: Guida la Tua Macchina Verso il Futuro', 13,
        (SELECT id FROM library_documents WHERE title = 'Capitolo 52: La Fine dell''Inizio - Il Tuo Comando Perpetuo' AND is_published = true LIMIT 1));

    RAISE NOTICE 'Template "Metodo Orbitale - Anno 1" creato con successo!';
    RAISE NOTICE 'Template ID: %', template_id_var;
    RAISE NOTICE 'Totale lezioni: 53 (13+13+14+13 in Q1-Q4)';

END $$;

-- Verifica risultati
SELECT 
    ut.name as template_name,
    tt.title as trimester_title,
    tm.title as module_title,
    COUNT(tl.id) as lesson_count,
    COUNT(tl.library_document_id) FILTER (WHERE tl.library_document_id IS NOT NULL) as lessons_with_library_link
FROM university_templates ut
INNER JOIN template_trimesters tt ON tt.template_id = ut.id
INNER JOIN template_modules tm ON tm.template_trimester_id = tt.id
LEFT JOIN template_lessons tl ON tl.template_module_id = tm.id
WHERE ut.name LIKE '%Anno 1%'
GROUP BY ut.name, tt.title, tm.title, tt.sort_order
ORDER BY tt.sort_order;
