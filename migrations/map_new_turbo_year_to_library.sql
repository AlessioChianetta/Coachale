
-- Mappa automaticamente le lezioni del nuovo anno "Anno 1 - Metodo Turbo" 
-- per il cliente 8a7f6b63-b41e-4071-bf44-28d71df1f4d8
-- ai documenti della libreria basandosi sulla corrispondenza dei titoli

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
AND uy.id = '114e081b-f4aa-4d9d-9672-70dfb8fd0fb4'
AND ul.library_document_id IS NULL
AND EXISTS (
    SELECT 1
    FROM library_documents ld
    WHERE LOWER(TRIM(ld.title)) = LOWER(TRIM(ul.title))
    AND ld.is_published = true
);

-- Verifica risultati
SELECT 
    COUNT(*) FILTER (WHERE ul.library_document_id IS NOT NULL) as lezioni_mappate,
    COUNT(*) FILTER (WHERE ul.library_document_id IS NULL) as lezioni_non_mappate,
    COUNT(*) as totale_lezioni
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE uy.id = '114e081b-f4aa-4d9d-9672-70dfb8fd0fb4';
