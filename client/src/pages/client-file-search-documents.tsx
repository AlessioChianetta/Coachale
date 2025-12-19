import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Search,
  Database,
  BookOpen,
  MessageSquare,
  ClipboardList,
  GraduationCap,
  User,
  Users,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSearch,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface FileSearchDocument {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  syncedAt: string | null;
  contentSize: number | null;
  isFromConsultant: boolean;
  storeDisplayName: string;
}

interface DocumentsResponse {
  success: boolean;
  documents: FileSearchDocument[];
  summary: {
    total: number;
    bySourceType: Record<string, number>;
    consultantDocs: number;
    clientDocs: number;
  };
  stores: Array<{
    id: string;
    displayName: string;
    ownerType: string;
    documentCount: number;
  }>;
}

const SOURCE_TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  library: { label: "Libreria", icon: BookOpen, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  knowledge_base: { label: "Knowledge Base", icon: Database, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" },
  exercise: { label: "Esercizio", icon: ClipboardList, color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" },
  consultation: { label: "Consulenza", icon: MessageSquare, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  university: { label: "Università", icon: GraduationCap, color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300" },
  manual: { label: "Manuale", icon: FileText, color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  indexed: { label: "Indicizzato", icon: CheckCircle2, color: "text-green-500" },
  processing: { label: "In elaborazione", icon: Clock, color: "text-amber-500" },
  pending: { label: "In attesa", icon: Loader2, color: "text-blue-500" },
  failed: { label: "Errore", icon: AlertCircle, color: "text-red-500" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientFileSearchDocuments() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const { data: response, isLoading, error } = useQuery<DocumentsResponse>({
    queryKey: ["/api/file-search/client/documents"],
    queryFn: async () => {
      const res = await fetch("/api/file-search/client/documents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const documents = response?.documents || [];
  const summary = response?.summary || { total: 0, bySourceType: {}, consultantDocs: 0, clientDocs: 0 };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === "all" || doc.sourceType === sourceFilter;
    const matchesOwner =
      ownerFilter === "all" ||
      (ownerFilter === "consultant" && doc.isFromConsultant) ||
      (ownerFilter === "client" && !doc.isFromConsultant);
    return matchesSearch && matchesSource && matchesOwner;
  });

  const groupedDocuments = filteredDocuments.reduce((acc, doc) => {
    const type = doc.sourceType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, FileSearchDocument[]>);

  const sourceTypes = Object.keys(SOURCE_TYPE_CONFIG);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <FileSearch className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
                        Documenti AI
                      </h1>
                      <p className="text-violet-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        Documenti disponibili per l'Assistente AI
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Totale</p>
                    <p className="text-lg sm:text-xl font-bold">{summary.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Consulente</p>
                    <p className="text-lg sm:text-xl font-bold">{summary.consultantDocs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">I Miei</p>
                    <p className="text-lg sm:text-xl font-bold">{summary.clientDocs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Categorie</p>
                    <p className="text-lg sm:text-xl font-bold">{Object.keys(summary.bySourceType).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm mb-4 sm:mb-6">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca documenti..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    {sourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SOURCE_TYPE_CONFIG[type]?.label || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Origine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="consultant">Consulente</SelectItem>
                    <SelectItem value="client">I miei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="ml-3 text-muted-foreground">Caricamento documenti...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Errore nel caricamento dei documenti</p>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <FileSearch className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {searchTerm || sourceFilter !== "all" || ownerFilter !== "all"
                    ? "Nessun documento corrisponde ai filtri"
                    : "Nessun documento indicizzato"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  L'Assistente AI non ha ancora documenti su cui basare le risposte
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedDocuments).map(([type, docs]) => {
                const config = SOURCE_TYPE_CONFIG[type] || { label: type, icon: FileText, color: "bg-gray-100 text-gray-800" };
                const Icon = config.icon;
                
                return (
                  <Card key={type} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-base sm:text-lg">
                          {config.label}
                          <Badge variant="secondary" className="ml-2">{docs.length}</Badge>
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40%]">Nome</TableHead>
                              <TableHead className="hidden sm:table-cell">Stato</TableHead>
                              <TableHead className="hidden md:table-cell">Dimensione</TableHead>
                              <TableHead className="hidden sm:table-cell">Origine</TableHead>
                              <TableHead>Sincronizzato</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {docs.map((doc) => {
                              const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                              const StatusIcon = statusConfig.icon;
                              
                              return (
                                <TableRow key={doc.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <span className="truncate max-w-[200px] sm:max-w-[300px]" title={doc.name}>
                                        {doc.name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      <span className="text-xs">{statusConfig.label}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                    {formatFileSize(doc.contentSize)}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant={doc.isFromConsultant ? "outline" : "secondary"} className="text-xs">
                                      {doc.isFromConsultant ? (
                                        <><Users className="w-3 h-3 mr-1" />Consulente</>
                                      ) : (
                                        <><User className="w-3 h-3 mr-1" />Mio</>
                                      )}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-xs sm:text-sm">
                                    {formatDate(doc.syncedAt)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <AIAssistant />
    </div>
  );
}
