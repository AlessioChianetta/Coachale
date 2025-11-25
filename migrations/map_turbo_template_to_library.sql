
-- Associa le lezioni del template "Anno 1 - Metodo Turbo" ai documenti della libreria
-- Questo garantisce che quando il template viene riutilizzato, le associazioni vengono copiate

-- 1. Trova il template "Anno 1 – Metodo Turbo"
DO $$
DECLARE
    template_id_var VARCHAR;
BEGIN
    SELECT id INTO template_id_var 
    FROM university_templates 
    WHERE name LIKE '%Metodo Turbo%' 
    LIMIT 1;

    -- Q1 - Le Fondamenta della Tua Attività
    -- Modulo 1: Le Fondamenta della Tua Attività
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = '1. Ipotizziamo la nicchia di mercato' AND is_published = true LIMIT 1
    )
    WHERE tl.title = '1. Ipotizziamo la nicchia di mercato'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = '2. Architettura di un''Offerta Premium' AND is_published = true LIMIT 1
    )
    WHERE tl.title = '2. Architettura di un''Offerta Premium'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = '3. Creazione della Tua Proposta di Valore Unica' AND is_published = true LIMIT 1
    )
    WHERE tl.title = '3. Creazione della Tua Proposta di Valore Unica'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Q2 - Metodo Turbo: Diventa Invincibile a Vendere
    -- Modulo 1: Mentalità e Fondamenta del Venditore da 1 Milione di Euro
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: Introduzione alla vendita e Obiettivi' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: Introduzione alla vendita e Obiettivi'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Il Lavoro Interiore e la Mentalità dell''Aiuto' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Il Lavoro Interiore e la Mentalità dell''Aiuto'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: Le Leve Psicologiche della Vendita' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: Le Leve Psicologiche della Vendita'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 4: I 9 Principi di Persuasione di Robert Cialdini' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 4: I 9 Principi di Persuasione di Robert Cialdini'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Continua con tutti gli altri moduli e lezioni...
    -- (aggiungo tutte le associazioni rimanenti)

    -- Modulo 2: La Psicologia della Vendita e il Posizionamento d'Autorità
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: La Definizione della Tua "Dieta Mediatica"' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: La Definizione della Tua "Dieta Mediatica"'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Creare le "Fondamenta della Credibilità"' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Creare le "Fondamenta della Credibilità"'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: Social Proof e Gestione delle Obiezioni Preventive' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: Social Proof e Gestione delle Obiezioni Preventive'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 4: Costruire un Sistema di Referral e Posizionamento' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 4: Costruire un Sistema di Referral e Posizionamento'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 3: Comunicazione Persuasiva: Tonalità e Linguaggio del Corpo
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: Tonalità e Linguaggio del Corpo' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: Tonalità e Linguaggio del Corpo'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Padroneggiare l''Arte del Mirroring e del Rapport' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Padroneggiare l''Arte del Mirroring e del Rapport'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 4: Preparazione Strategica e Strumenti del Mestiere
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: Il "Gancio" Killer per Catturare l''Attenzione' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: Il "Gancio" Killer per Catturare l''Attenzione'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Sfruttare il Calendario per la Vendita Strategica' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Sfruttare il Calendario per la Vendita Strategica'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: Tool e Tecnologie per Ottimizzare il Processo' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: Tool e Tecnologie per Ottimizzare il Processo'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 5: La Chiamata di Vendita (Parte 1) - La Diagnosi
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: L''Apertura della Chiamata: Le Prime Parole che Determinano Tutto' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: L''Apertura della Chiamata: Le Prime Parole che Determinano Tutto'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: La Fase di Scoperta: Fare le Domande che Contano' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: La Fase di Scoperta: Fare le Domande che Contano'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: La Diagnosi della Situazione Attuale' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: La Diagnosi della Situazione Attuale'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 4: Costruire il "Divario del Dolore" e Creare Urgenza' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 4: Costruire il "Divario del Dolore" e Creare Urgenza'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 6: La Chiamata di Vendita (Parte 2) - Presentazione e Ancoraggio del Valore
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: La Presentazione della Soluzione: Creare il Futuro Ideale' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: La Presentazione della Soluzione: Creare il Futuro Ideale'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: L''Ancoraggio del Valore: Il Prezzo è Relativo' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: L''Ancoraggio del Valore: Il Prezzo è Relativo'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: La Discussione del Prezzo: Presentare con Sicurezza' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: La Discussione del Prezzo: Presentare con Sicurezza'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 7: La Chiusura: Gestione delle Obiezioni e "Looping"
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: Le Obiezioni come Opportunità: Mindset e Framework' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: Le Obiezioni come Opportunità: Mindset e Framework'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Gestire le Obiezioni più Comuni (Prezzo, Tempo, "Ci Devo Pensare")' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Gestire le Obiezioni più Comuni (Prezzo, Tempo, "Ci Devo Pensare")'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: La Tecnica del "Looping": Tornare alla Diagnosi' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: La Tecnica del "Looping": Tornare alla Diagnosi'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 4: La Chiusura: Assumere la Vendita e Confermare l''Impegno' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 4: La Chiusura: Assumere la Vendita e Confermare l''Impegno'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    -- Modulo 8: Il Post-Vendita e il Follow-up Strategico
    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 1: Il Periodo Critico: I Primi 48 Ore Dopo la Chiusura' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 1: Il Periodo Critico: I Primi 48 Ore Dopo la Chiusura'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 2: Costruire un Sistema di Onboarding Eccezionale' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 2: Costruire un Sistema di Onboarding Eccezionale'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 3: Follow-up per Vendite Non Concluse: Il Sistema di "Nurturing"' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 3: Follow-up per Vendite Non Concluse: Il Sistema di "Nurturing"'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

    UPDATE template_lessons tl
    SET library_document_id = (
        SELECT id FROM library_documents WHERE title = 'Lezione 4: Da Cliente a "Evangelista": Costruire Clienti per Tutta la Vita' AND is_published = true LIMIT 1
    )
    WHERE tl.title = 'Lezione 4: Da Cliente a "Evangelista": Costruire Clienti per Tutta la Vita'
    AND tl.template_module_id IN (
        SELECT tm.id FROM template_modules tm
        INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
        WHERE tt.template_id = template_id_var
    );

END $$;

-- Verifica risultati
SELECT 
    tl.id as template_lesson_id,
    tl.title as template_lesson_title,
    ld.id as library_document_id,
    ld.title as library_lesson_title,
    tm.title as module_title,
    tt.title as trimester_title,
    ut.name as template_name
FROM template_lessons tl
INNER JOIN template_modules tm ON tl.template_module_id = tm.id
INNER JOIN template_trimesters tt ON tm.template_trimester_id = tt.id
INNER JOIN university_templates ut ON tt.template_id = ut.id
LEFT JOIN library_documents ld ON tl.library_document_id = ld.id
WHERE ut.name LIKE '%Metodo Turbo%'
ORDER BY tt.sort_order, tm.sort_order, tl.sort_order;
