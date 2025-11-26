
-- Script per associare automaticamente le lezioni della libreria 
-- alle lezioni universitarie del Metodo Hybrid basandosi sul titolo

-- Per ogni lezione universitaria, trova la corrispondente lezione della libreria
-- e aggiorna il campo library_document_id

UPDATE university_lessons ul
SET library_document_id = (
    SELECT ld.id
    FROM library_documents ld
    WHERE ld.title = ul.title
    AND ld.is_published = true
    LIMIT 1
)
WHERE ul.library_document_id IS NULL
AND EXISTS (
    SELECT 1
    FROM library_documents ld
    WHERE ld.title = ul.title
    AND ld.is_published = true
);

-- Verifica i risultati
SELECT 
    ul.id as lesson_id,
    ul.title as university_lesson_title,
    ld.id as library_document_id,
    ld.title as library_lesson_title,
    um.title as module_title,
    ut.title as trimester_title
FROM university_lessons ul
LEFT JOIN library_documents ld ON ul.library_document_id = ld.id
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
WHERE uy.title LIKE '%Metodo Hybrid%'
ORDER BY ut.sort_order, um.sort_order, ul.sort_order;
