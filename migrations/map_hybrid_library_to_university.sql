
-- Script per associare le lezioni della libreria del Metodo Hybrid/Turbo alle lezioni universitarie
-- Basato sulla corrispondenza dei titoli

-- Prima verifica: conta quante lezioni universitarie esistono per il Metodo Turbo
SELECT 
    COUNT(*) as total_lessons,
    uy.title as year_title
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE uy.title LIKE '%Metodo Turbo%'
GROUP BY uy.title;

-- Mapping delle 3 lezioni principali del Metodo Hybrid (se esistono)
UPDATE university_lessons ul
SET library_document_id = '87424409-e692-4294-b978-01ffdc6b826c'
WHERE ul.title LIKE '%Ipotizziamo la nicchia di mercato%'
AND ul.library_document_id IS NULL;

UPDATE university_lessons ul
SET library_document_id = '7954040f-2365-45b5-a989-824e0ebbbb06'
WHERE ul.title LIKE '%Architettura di un%Offerta Premium%'
AND ul.library_document_id IS NULL;

UPDATE university_lessons ul
SET library_document_id = '132478b3-7dea-499b-b6ce-9a52dbdf6822'
WHERE ul.title LIKE '%Creazione della Tua Proposta di Valore Unica%'
AND ul.library_document_id IS NULL;

-- Mapping automatico per tutte le altre lezioni che hanno lo stesso titolo
UPDATE university_lessons ul
SET library_document_id = (
    SELECT ld.id
    FROM library_documents ld
    WHERE LOWER(TRIM(ld.title)) = LOWER(TRIM(ul.title))
    AND ld.is_published = true
    LIMIT 1
)
WHERE ul.library_document_id IS NULL
AND EXISTS (
    SELECT 1
    FROM library_documents ld
    WHERE LOWER(TRIM(ld.title)) = LOWER(TRIM(ul.title))
    AND ld.is_published = true
);

-- Verifica i risultati per il Metodo Turbo
SELECT 
    ul.id as lesson_id,
    ul.title as university_lesson_title,
    ld.id as library_document_id,
    ld.title as library_lesson_title,
    um.title as module_title,
    ut.title as trimester_title,
    uy.title as year_title
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
LEFT JOIN library_documents ld ON ul.library_document_id = ld.id
WHERE uy.title LIKE '%Metodo Turbo%'
ORDER BY uy.sort_order, ut.sort_order, um.sort_order, ul.sort_order;

-- Mostra un riepilogo delle associazioni
SELECT 
    COUNT(*) FILTER (WHERE ul.library_document_id IS NOT NULL) as lezioni_associate,
    COUNT(*) FILTER (WHERE ul.library_document_id IS NULL) as lezioni_non_associate,
    COUNT(*) as totale_lezioni
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE uy.title LIKE '%Metodo Turbo%' OR uy.title LIKE '%Metodo Hybrid%';
