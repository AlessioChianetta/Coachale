-- Script diagnostico per analizzare le lezioni universitarie e della libreria

-- 1. Mostra tutte le lezioni universitarie esistenti
SELECT 
    ul.id as lesson_id,
    ul.title as university_lesson_title,
    um.title as module_title,
    ut.title as trimester_title,
    uy.title as year_title
FROM university_lessons ul
INNER JOIN university_modules um ON ul.module_id = um.id
INNER JOIN university_trimesters ut ON um.trimester_id = ut.id
INNER JOIN university_years uy ON ut.year_id = uy.id
ORDER BY uy.sort_order, ut.sort_order, um.sort_order, ul.sort_order;

-- 2. Mostra tutte le lezioni della libreria pubblicate
SELECT 
    ld.id as library_id,
    ld.title as library_title,
    lc.name as category_name,
    ls.name as subcategory_name
FROM library_documents ld
LEFT JOIN library_categories lc ON ld.category_id = lc.id
LEFT JOIN library_subcategories ls ON ld.subcategory_id = ls.id
WHERE ld.is_published = true
ORDER BY lc.name, ls.name, ld.sort_order;

-- 3. Conta le lezioni universitarie per anno
SELECT 
    uy.title as year_title,
    COUNT(ul.id) as total_lessons,
    COUNT(ul.library_document_id) as lessons_with_library_link
FROM university_years uy
INNER JOIN university_trimesters ut ON ut.year_id = uy.id
INNER JOIN university_modules um ON um.trimester_id = ut.id
INNER JOIN university_lessons ul ON ul.module_id = um.id
GROUP BY uy.id, uy.title
ORDER BY uy.sort_order;