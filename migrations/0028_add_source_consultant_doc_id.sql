-- Add sourceConsultantDocId to whatsapp_agent_knowledge_items for tracking imported documents from consultant KB
ALTER TABLE "whatsapp_agent_knowledge_items" 
ADD COLUMN IF NOT EXISTS "source_consultant_doc_id" varchar REFERENCES "consultant_knowledge_documents"("id") ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS "whatsapp_agent_knowledge_source_doc_idx" ON "whatsapp_agent_knowledge_items"("source_consultant_doc_id");
