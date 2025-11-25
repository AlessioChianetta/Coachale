-- Migration to add CASCADE delete behavior to exercise_submissions foreign key
-- This will automatically delete submissions when an assignment is deleted

-- Drop the existing foreign key constraint
ALTER TABLE exercise_submissions 
DROP CONSTRAINT IF EXISTS exercise_submissions_assignment_id_exercise_assignments_id_fk;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE exercise_submissions 
ADD CONSTRAINT exercise_submissions_assignment_id_exercise_assignments_id_fk 
FOREIGN KEY (assignment_id) REFERENCES exercise_assignments(id) ON DELETE CASCADE;