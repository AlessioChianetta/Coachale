-- Add AI analysis result to sales_conversation_training table
-- This allows saving Gemini 2.5 Pro analysis directly to individual conversations

ALTER TABLE sales_conversation_training
ADD COLUMN ai_analysis_result JSONB DEFAULT NULL;

COMMENT ON COLUMN sales_conversation_training.ai_analysis_result IS 
'Gemini 2.5 Pro AI analysis result for this specific conversation. Contains insights, problems, suggestions, strengths, score, and analyzedAt timestamp.';
