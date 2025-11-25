
-- Migration to add CASCADE delete behavior to exercise_assignments foreign key
-- This will automatically delete assignments when an exercise is deleted

-- Drop the existing foreign key constraint
ALTER TABLE exercise_assignments 
DROP CONSTRAINT IF EXISTS exercise_assignments_exercise_id_exercises_id_fk;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE exercise_assignments 
ADD CONSTRAINT exercise_assignments_exercise_id_exercises_id_fk 
FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;

-- Also update the schema file constraint for consistency
