import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, AlertTriangle } from "lucide-react";

interface NurturingKnowledgeItem {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface KnowledgeBaseSelectorProps {
  selectedDocIds: string[];
  onSelectionChange: (docIds: string[]) => void;
  maxTokens?: number;
}

function estimateTokens(content: string): number {
  return Math.ceil((content?.length || 0) / 4);
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "default";
    case "docx":
      return "secondary";
    default:
      return "outline";
  }
}

export function KnowledgeBaseSelector({
  selectedDocIds,
  onSelectionChange,
  maxTokens = 50000,
}: KnowledgeBaseSelectorProps) {
  const [documents, setDocuments] = useState<NurturingKnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        setIsLoading(true);
        setError(null);
        // Usa l'API corretta dei documenti Knowledge Base
        const response = await fetch("/api/consultant/knowledge/documents", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Errore nel caricamento dei documenti");
        }
        const result = await response.json();
        // I documenti sono nella root della risposta, non in result.data
        const docs = Array.isArray(result) ? result : (result.data || []);
        // Mappa i campi per compatibilità
        setDocuments(docs.map((doc: any) => ({
          id: doc.id,
          title: doc.title || doc.displayName || "Documento",
          type: doc.fileType || doc.type || "text",
          content: doc.content || doc.summary || "",
          createdAt: doc.createdAt,
        })));
      } catch (err: any) {
        setError(err.message || "Errore sconosciuto");
      } finally {
        setIsLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const totalSelectedTokens = useMemo(() => {
    return documents
      .filter((doc) => selectedDocIds.includes(doc.id))
      .reduce((sum, doc) => sum + estimateTokens(doc.content), 0);
  }, [documents, selectedDocIds]);

  const isOverLimit = totalSelectedTokens > maxTokens;

  const handleToggle = (docId: string) => {
    if (selectedDocIds.includes(docId)) {
      onSelectionChange(selectedDocIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedDocIds, docId]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documenti Knowledge Base
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">~{totalSelectedTokens.toLocaleString()} tokens</Badge>
            {isOverLimit && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Supera limite 50k tokens
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive text-sm">{error}</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessun documento nella Knowledge Base
          </div>
        ) : (
          <ScrollArea className="h-[240px]">
            <div className="space-y-2 pr-4">
              {documents.map((doc) => {
                const tokens = estimateTokens(doc.content);
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggle(doc.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(doc.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                    </div>
                    <Badge variant={getTypeBadgeVariant(doc.type)} className="text-xs uppercase">
                      {doc.type || "text"}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ~{tokens.toLocaleString()} tokens
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default KnowledgeBaseSelector;
