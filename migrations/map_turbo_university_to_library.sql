
-- Mappa le lezioni universitarie di "Anno 1 - Metodo Turbo" ai documenti della libreria
-- basandosi sulla corrispondenza dei titoli

UPDATE university_lessons ul
SET library_document_id = (
    SELECT ld.id
    FROM library_documents ld
    WHERE LOWER(TRIM(ld.title)) = LOWER(TRIM(ul.title))
    AND ld.is_published = true
    LIMIT 1
)
FROM university_modules um
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE ul.module_id = um.id
AND uy.title LIKE '%Metodo Turbo%'
AND ul.library_document_id IS NULL
AND EXISTS (
    SELECT 1
    FROM library_documents ld
    WHERE LOWER(TRIM(ld.title)) = LOWER(TRIM(ul.title))
    AND ld.is_published = true
);

-- Verifica risultati
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

-- Mostra riepilogo
SELECT 
    COUNT(*) FILTER (WHERE ul.library_document_id IS NOT NULL) as lezioni_mappate,
    COUNT(*) FILTER (WHERE ul.library_document_id IS NULL) as lezioni_non_mappate,
    COUNT(*) as totale_lezioni
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE uy.title LIKE '%Metodo Turbo%';
