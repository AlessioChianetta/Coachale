-- Add phase_activations field to sales_conversation_training table
-- This tracks WHY a phase was activated with evidence and keywords matched

ALTER TABLE sales_conversation_training
ADD COLUMN IF NOT EXISTS phase_activations JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN sales_conversation_training.phase_activations IS 
'Tracks when and why each phase was activated, including: phaseId, phaseName, timestamp, trigger (messageId, matchedQuestion, keywordsMatched, similarity, excerpt), reasoning';

-- The checkpoints_completed field is already JSONB so it can support the new extended structure
-- No ALTER needed - we just update the TypeScript types and the tracker logic

COMMENT ON COLUMN sales_conversation_training.checkpoints_completed IS
'Tracks completed checkpoints with structured evidence: checkpointId, status (completed|pending|failed), completedAt, verifications array with requirement, status, and evidence (messageId, excerpt, matchedKeywords, timestamp)';

-- Add messageId support to existing fullTranscript entries (handled at application level)
COMMENT ON COLUMN sales_conversation_training.full_transcript IS
'Full conversation transcript with messageId for evidence linking: messageId, role, content, timestamp, phase, checkpoint';
