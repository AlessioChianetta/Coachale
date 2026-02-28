import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  TrendingUp,
  Headphones,
  Palette,
  Star,
  BarChart3,
  Briefcase,
  Settings,
  Search,
  Plus,
  Minus,
  FileText,
  Loader2,
  Bot,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Phone,
  TrendingUp,
  Headphones,
  Palette,
  Star,
  BarChart3,
  Briefcase,
  Settings,
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  pink: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800" },
  blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800" },
  teal: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  green: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
};

const AI_AGENTS = [
  { id: "alessia", name: "Alessia", displayName: "Alessia – Voice Consultant", color: "pink", icon: "Phone", description: "Chiamate AI proattive e follow-up vocale" },
  { id: "millie", name: "Millie", displayName: "Millie – Financial Analyst", color: "blue", icon: "TrendingUp", description: "Analisi finanziaria e report automatici" },
  { id: "echo", name: "Echo", displayName: "Echo – Client Listener", color: "purple", icon: "Headphones", description: "Monitoraggio sentiment e ascolto attivo" },
  { id: "nova", name: "Nova", displayName: "Nova – Content Creator", color: "orange", icon: "Palette", description: "Creazione contenuti e marketing" },
  { id: "stella", name: "Stella", displayName: "Stella – Engagement Specialist", color: "yellow", icon: "Star", description: "Engagement clienti e nurturing" },
  { id: "marco", name: "Marco", displayName: "Marco – Executive Assistant", color: "green", icon: "Briefcase", description: "Assistente esecutivo e organizzazione" },
  { id: "personalizza", name: "Personalizza", displayName: "Personalizza – Custom Agent", color: "indigo", icon: "Settings", description: "Agente personalizzabile" },
];

interface AgentAssignmentSummary {
  agent_id: string;
  count: string;
}

interface AssignedDocument {
  id: string;
  document_id: string;
  title: string;
  file_name: string;
  file_type: string;
  category: string;
  status: string;
}

interface KnowledgeDocumentBasic {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  category: string;
  status: string;
}

export default function AgentKnowledgeSection() {
  const [selectedAgent, setSelectedAgent] = useState<typeof AI_AGENTS[number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summaryResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/agent-assignments/summary"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/knowledge/agent-assignments/summary", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch agent assignment summary");
      return response.json();
    },
  });

  const summaryData: AgentAssignmentSummary[] = summaryResponse?.data || [];

  const getAgentDocCount = (agentId: string): number => {
    const entry = summaryData.find((s) => s.agent_id === agentId);
    return entry ? parseInt(entry.count, 10) : 0;
  };

  const { data: assignedDocsResponse, isLoading: isLoadingAssigned } = useQuery({
    queryKey: ["/api/consultant/knowledge/agent-assignments", selectedAgent?.id, "documents"],
    queryFn: async () => {
      if (!selectedAgent) return null;
      const response = await fetch(`/api/consultant/knowledge/agent-assignments/${selectedAgent.id}/documents`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assigned documents");
      return response.json();
    },
    enabled: !!selectedAgent,
  });

  const assignedDocs: AssignedDocument[] = assignedDocsResponse?.data || [];

  const { data: allDocsResponse, isLoading: isLoadingAllDocs } = useQuery({
    queryKey: ["/api/consultant/knowledge/documents", "all-for-assignment"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/knowledge/documents?limit=500", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
    enabled: !!selectedAgent,
  });

  const allDocs: KnowledgeDocumentBasic[] = allDocsResponse?.data || [];

  const availableDocs = useMemo(() => {
    const assignedIds = new Set(assignedDocs.map((d) => d.document_id));
    let filtered = allDocs.filter((d) => !assignedIds.has(d.id) && d.status === "indexed");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) => d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allDocs, assignedDocs, searchQuery]);

  const assignMutation = useMutation({
    mutationFn: async ({ agentId, documentIds }: { agentId: string; documentIds: string[] }) => {
      const response = await fetch("/api/consultant/knowledge/agent-assignments/bulk", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId, document_ids: documentIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign documents");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/agent-assignments"] });
      toast({ title: "Documento assegnato", description: "Il documento è stato assegnato all'agente." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async ({ agentId, documentIds }: { agentId: string; documentIds: string[] }) => {
      const response = await fetch("/api/consultant/knowledge/agent-assignments/bulk", {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId, document_ids: documentIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unassign documents");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/agent-assignments"] });
      toast({ title: "Documento rimosso", description: "Il documento è stato rimosso dall'agente." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleAssign = (documentId: string) => {
    if (!selectedAgent) return;
    assignMutation.mutate({ agentId: selectedAgent.id, documentIds: [documentId] });
  };

  const handleUnassign = (documentId: string) => {
    if (!selectedAgent) return;
    unassignMutation.mutate({ agentId: selectedAgent.id, documentIds: [documentId] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Agenti AI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gestisci i documenti della Knowledge Base assegnati a ciascun agente autonomo
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AI_AGENTS.map((agent) => {
            const IconComponent = ICON_MAP[agent.icon];
            const colors = COLOR_MAP[agent.color] || COLOR_MAP.indigo;
            const docCount = getAgentDocCount(agent.id);

            return (
              <div
                key={agent.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${colors.border} ${colors.bg} transition-colors`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${colors.text} bg-white/60 dark:bg-black/20`}>
                    {IconComponent && <IconComponent className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{agent.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge variant="secondary" className="text-xs">
                    {docCount} {docCount === 1 ? "documento" : "documenti"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setSearchQuery("");
                    }}
                  >
                    Gestisci
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={!!selectedAgent} onOpenChange={(open) => { if (!open) setSelectedAgent(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Documenti assegnati a {selectedAgent?.name}
              </DialogTitle>
              <DialogDescription>
                Aggiungi o rimuovi documenti dalla Knowledge Base di questo agente
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Documenti Assegnati</h4>
                {isLoadingAssigned ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Caricamento...</span>
                  </div>
                ) : assignedDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
                    Nessun documento assegnato a questo agente
                  </p>
                ) : (
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {assignedDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleUnassign(doc.document_id)}
                            disabled={unassignMutation.isPending}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <h4 className="text-sm font-semibold mb-2">Aggiungi Documenti</h4>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca documenti..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {isLoadingAllDocs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Caricamento documenti...</span>
                  </div>
                ) : availableDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
                    {searchQuery ? "Nessun documento trovato" : "Tutti i documenti sono già assegnati"}
                  </p>
                ) : (
                  <ScrollArea className="max-h-[250px]">
                    <div className="space-y-2">
                      {availableDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0 text-primary hover:text-primary"
                            onClick={() => handleAssign(doc.id)}
                            disabled={assignMutation.isPending}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
