import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  User, 
  Target, 
  Award, 
  Users, 
  TrendingUp,
  BookOpen,
  Star,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload as FileUpIcon,
  Loader2,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Library
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import type { WhatsappAgentKnowledgeItem } from "@shared/schema";

interface ImportCandidate {
  id: string;
  title: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  createdAt: string | null;
  category: string;
}

interface AgentBrandVoiceProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  agentId?: string | null;
}

interface KnowledgeItemDraft {
  id?: string;
  title: string;
  type: "text" | "pdf" | "docx" | "txt";
  content?: string;
  file?: File;
  fileName?: string;
  isNew?: boolean;
  isSaving?: boolean;
}

interface UploadingFile {
  file: File;
  title: string;
  type: "pdf" | "docx" | "txt";
  progress: number;
  status: "uploading" | "processing" | "success" | "error";
  error?: string;
}

export default function AgentBrandVoice({ formData, onChange, errors, agentId }: AgentBrandVoiceProps) {
  const { toast } = useToast();
  const [valueInput, setValueInput] = useState("");
  const [businessInfoOpen, setBusinessInfoOpen] = useState(true);
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  
  const [knowledgeItems, setKnowledgeItems] = useState<WhatsappAgentKnowledgeItem[]>([]);
  const [knowledgeDrafts, setKnowledgeDrafts] = useState<KnowledgeItemDraft[]>([]);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleAddValue = () => {
    if (valueInput.trim()) {
      const currentValues = formData.values || [];
      onChange("values", [...currentValues, valueInput.trim()]);
      setValueInput("");
    }
  };

  const handleRemoveValue = (index: number) => {
    const currentValues = formData.values || [];
    onChange("values", currentValues.filter((_: any, i: number) => i !== index));
  };

  const handleAddSoftware = () => {
    const currentSoftware = formData.softwareCreated || [];
    onChange("softwareCreated", [...currentSoftware, { emoji: "💻", name: "", description: "" }]);
  };

  const handleUpdateSoftware = (index: number, field: string, value: string) => {
    const currentSoftware = [...(formData.softwareCreated || [])];
    currentSoftware[index] = { ...currentSoftware[index], [field]: value };
    onChange("softwareCreated", currentSoftware);
  };

  const handleRemoveSoftware = (index: number) => {
    const currentSoftware = formData.softwareCreated || [];
    onChange("softwareCreated", currentSoftware.filter((_: any, i: number) => i !== index));
  };

  const handleAddBook = () => {
    const currentBooks = formData.booksPublished || [];
    onChange("booksPublished", [...currentBooks, { title: "", year: "" }]);
  };

  const handleUpdateBook = (index: number, field: string, value: string) => {
    const currentBooks = [...(formData.booksPublished || [])];
    currentBooks[index] = { ...currentBooks[index], [field]: value };
    onChange("booksPublished", currentBooks);
  };

  const handleRemoveBook = (index: number) => {
    const currentBooks = formData.booksPublished || [];
    onChange("booksPublished", currentBooks.filter((_: any, i: number) => i !== index));
  };

  const handleAddCaseStudy = () => {
    const currentCases = formData.caseStudies || [];
    onChange("caseStudies", [...currentCases, { client: "", result: "" }]);
  };

  const handleUpdateCaseStudy = (index: number, field: string, value: string) => {
    const currentCases = [...(formData.caseStudies || [])];
    currentCases[index] = { ...currentCases[index], [field]: value };
    onChange("caseStudies", currentCases);
  };

  const handleRemoveCaseStudy = (index: number) => {
    const currentCases = formData.caseStudies || [];
    onChange("caseStudies", currentCases.filter((_: any, i: number) => i !== index));
  };

  const handleAddService = () => {
    const currentServices = formData.servicesOffered || [];
    onChange("servicesOffered", [...currentServices, { name: "", description: "", price: "" }]);
  };

  const handleUpdateService = (index: number, field: string, value: string) => {
    const currentServices = [...(formData.servicesOffered || [])];
    currentServices[index] = { ...currentServices[index], [field]: value };
    onChange("servicesOffered", currentServices);
  };

  const handleRemoveService = (index: number) => {
    const currentServices = formData.servicesOffered || [];
    onChange("servicesOffered", currentServices.filter((_: any, i: number) => i !== index));
  };

  // Knowledge Base handlers
  useEffect(() => {
    const fetchKnowledgeItems = async () => {
      if (!agentId) return;
      
      setIsLoadingKnowledge(true);
      try {
        const response = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          const data = await response.json();
          setKnowledgeItems(data.data || []);
        } else {
          console.error("Failed to fetch knowledge items");
        }
      } catch (error) {
        console.error("Error fetching knowledge items:", error);
      } finally {
        setIsLoadingKnowledge(false);
      }
    };

    fetchKnowledgeItems();
  }, [agentId]);

  const handleAddKnowledgeDraft = () => {
    console.log("➕ Adding new knowledge draft");
    const newDraft = {
      title: "",
      type: "text" as const,
      content: "",
      isNew: true,
    };
    console.log("➕ New draft:", newDraft);
    setKnowledgeDrafts([
      ...knowledgeDrafts,
      newDraft,
    ]);
  };

  const handleUpdateDraft = (index: number, field: string | Record<string, any>, value?: any) => {
    console.log("📝 handleUpdateDraft called:", { index, field, value });
    const updated = [...knowledgeDrafts];
    
    // Se field è un oggetto, aggiorna tutti i campi insieme
    if (typeof field === 'object') {
      updated[index] = { ...updated[index], ...field };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    console.log("📝 Updated draft:", updated[index]);
    setKnowledgeDrafts(updated);
  };

  const handleRemoveDraft = (index: number) => {
    setKnowledgeDrafts(knowledgeDrafts.filter((_, i) => i !== index));
  };

  const handleSaveKnowledgeItem = async (index: number) => {
    if (!agentId) {
      toast({
        title: "Errore",
        description: "Devi salvare prima la configurazione dell'agente",
        variant: "destructive",
      });
      return;
    }

    const draft = knowledgeDrafts[index];

    if (!draft.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (draft.type === "text" && !draft.content?.trim()) {
      toast({
        title: "Errore",
        description: "Il contenuto è obbligatorio per elementi di tipo testo",
        variant: "destructive",
      });
      return;
    }

    if (draft.type !== "text" && !draft.file) {
      toast({
        title: "Errore",
        description: "Devi caricare un file",
        variant: "destructive",
      });
      return;
    }

    const updated = [...knowledgeDrafts];
    updated[index] = { ...updated[index], isSaving: true };
    setKnowledgeDrafts(updated);

    try {
      let response;

      if (draft.type === "text") {
        response = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draft.title,
            type: draft.type,
            content: draft.content,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("title", draft.title);
        formData.append("type", draft.type);
        if (draft.file) {
          formData.append("file", draft.file);
        }

        response = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });
      }

      if (response.ok) {
        const data = await response.json();
        setKnowledgeItems([...knowledgeItems, data.data]);
        setKnowledgeDrafts(knowledgeDrafts.filter((_, i) => i !== index));
        toast({
          title: "Successo",
          description: "Elemento salvato con successo",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Impossibile salvare l'elemento",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving knowledge item:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio",
        variant: "destructive",
      });
    } finally {
      const updated = [...knowledgeDrafts];
      if (updated[index]) {
        updated[index] = { ...updated[index], isSaving: false };
        setKnowledgeDrafts(updated);
      }
    }
  };

  const handleDeleteKnowledgeItem = async (itemId: string) => {
    if (!agentId) return;

    if (!confirm("Sei sicuro di voler eliminare questo elemento?")) {
      return;
    }

    try {
      const response = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge/${itemId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setKnowledgeItems(knowledgeItems.filter((item) => item.id !== itemId));
        toast({
          title: "Successo",
          description: "Elemento eliminato con successo",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Impossibile eliminare l'elemento",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting knowledge item:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione",
        variant: "destructive",
      });
    }
  };

  // Quick Upload Handler - Auto-save files with auto-detect type and title
  const handleQuickUpload = async (files: File[]) => {
    if (!agentId) {
      toast({
        title: "Errore",
        description: "Devi salvare prima la configurazione dell'agente",
        variant: "destructive",
      });
      return;
    }

    // Auto-detect type from MIME type
    const getFileType = (mimeType: string): "pdf" | "docx" | "txt" | null => {
      if (mimeType === "application/pdf") return "pdf";
      if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
          mimeType === "application/msword") return "docx";
      if (mimeType === "text/plain") return "txt";
      return null;
    };

    // Auto-generate title from filename (remove extension)
    const generateTitle = (fileName: string): string => {
      return fileName.replace(/\.(pdf|docx|doc|txt)$/i, "");
    };

    // Process each file
    for (const file of files) {
      const fileType = getFileType(file.type);

      if (!fileType) {
        toast({
          title: "File non supportato",
          description: `${file.name}: tipo di file non supportato. Usa PDF, DOCX o TXT.`,
          variant: "destructive",
        });
        continue;
      }

      const title = generateTitle(file.name);
      const uploadingFile: UploadingFile = {
        file,
        title,
        type: fileType,
        progress: 0,
        status: "uploading",
      };

      // Add to uploading list
      setUploadingFiles(prev => [...prev, uploadingFile]);

      try {
        // Create FormData
        const formData = new FormData();
        formData.append("title", title);
        formData.append("type", fileType);
        formData.append("file", file);

        // Update progress to processing
        setUploadingFiles(prev =>
          prev.map(f => f.file === file ? { ...f, progress: 50, status: "processing" } : f)
        );

        // Upload file
        const response = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

          // Update to success
          setUploadingFiles(prev =>
            prev.map(f => f.file === file ? { ...f, progress: 100, status: "success" } : f)
          );

          // Add to knowledge items
          setKnowledgeItems(prev => [...prev, data.data]);

          // Show success toast
          toast({
            title: "✓ File caricato",
            description: `${title} salvato con successo`,
          });

          // Remove from uploading list after 2 seconds
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.file !== file));
          }, 2000);
        } else {
          const error = await response.json();
          
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file
                ? { ...f, status: "error", error: error.error || "Errore durante il caricamento" }
                : f
            )
          );

          toast({
            title: "Errore",
            description: `${file.name}: ${error.error || "Impossibile salvare"}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        
        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === file
              ? { ...f, status: "error", error: "Errore di rete" }
              : f
          )
        );

        toast({
          title: "Errore",
          description: `${file.name}: errore durante il caricamento`,
          variant: "destructive",
        });
      }
    }
  };

  const handleOpenImportDialog = async () => {
    if (!agentId) {
      toast({
        title: "Errore",
        description: "Devi salvare prima la configurazione dell'agente",
        variant: "destructive",
      });
      return;
    }

    setIsImportDialogOpen(true);
    setIsLoadingCandidates(true);
    setSelectedDocIds([]);

    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}/import-candidates`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setImportCandidates(data.data || []);
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Impossibile caricare i documenti",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching import candidates:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il caricamento",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleToggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    if (selectedDocIds.length === importCandidates.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(importCandidates.map(doc => doc.id));
    }
  };

  const handleImportSelected = async () => {
    if (!agentId || selectedDocIds.length === 0) return;

    setIsImporting(true);

    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}/import-from-kb`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentIds: selectedDocIds }),
      });

      if (response.ok) {
        const data = await response.json();
        
        setKnowledgeItems(prev => [...prev, ...(data.data || [])]);
        
        toast({
          title: "✓ Importazione completata",
          description: `${data.importedCount} documento/i importato/i con successo`,
        });
        
        setIsImportDialogOpen(false);
        setSelectedDocIds([]);
        setImportCandidates([]);
      } else {
        const error = await response.json();
        toast({
          title: "Errore",
          description: error.error || "Impossibile importare i documenti",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing documents:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'importazione",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Brand Voice & Credibilità
        </h2>
        <p className="text-muted-foreground">
          Definisci l'identità del tuo brand e costruisci autorità (tutti i campi sono opzionali)
        </p>
      </div>

      <Collapsible open={businessInfoOpen} onOpenChange={setBusinessInfoOpen}>
        <Card className="border-2 border-primary/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Informazioni Business</CardTitle>
                </div>
                {businessInfoOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Nome, descrizione e bio del consulente</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="consultantDisplayName" className="flex items-center gap-2">
                    Nome Display Consulente
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {"{"}
                      {"{"}2{"}"}
                      {"}"}
                    </Badge>
                  </Label>
                  <Input
                    id="consultantDisplayName"
                    value={formData.consultantDisplayName}
                    onChange={(e) => onChange("consultantDisplayName", e.target.value)}
                    placeholder="Es: Marco Rossi"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="businessName" className="flex items-center gap-2">
                    Nome Business
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      {"{"}
                      {"{"}3{"}"}
                      {"}"}
                    </Badge>
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => onChange("businessName", e.target.value)}
                    placeholder="Es: Momentum Coaching"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="businessDescription">Descrizione Business</Label>
                <Textarea
                  id="businessDescription"
                  value={formData.businessDescription}
                  onChange={(e) => onChange("businessDescription", e.target.value)}
                  placeholder="Breve descrizione di cosa fa il tuo business..."
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="consultantBio">Bio Consulente</Label>
                <Textarea
                  id="consultantBio"
                  value={formData.consultantBio}
                  onChange={(e) => onChange("consultantBio", e.target.value)}
                  placeholder="Bio personale del consulente..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={authorityOpen} onOpenChange={setAuthorityOpen}>
        <Card className="border-2 border-blue-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 cursor-pointer hover:from-blue-500/10 hover:to-blue-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <CardTitle>Authority & Posizionamento</CardTitle>
                </div>
                {authorityOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Vision, mission, valori e USP</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="vision">Vision</Label>
                <Textarea
                  id="vision"
                  value={formData.vision}
                  onChange={(e) => onChange("vision", e.target.value)}
                  placeholder="La tua vision per il futuro..."
                  rows={2}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="mission">Mission</Label>
                <Textarea
                  id="mission"
                  value={formData.mission}
                  onChange={(e) => onChange("mission", e.target.value)}
                  placeholder="La tua mission..."
                  rows={2}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Valori</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      placeholder="Aggiungi un valore..."
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddValue())}
                    />
                    <Button type="button" onClick={handleAddValue} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(formData.values || []).map((value: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {value}
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="usp">Unique Selling Proposition (USP)</Label>
                <Textarea
                  id="usp"
                  value={formData.usp}
                  onChange={(e) => onChange("usp", e.target.value)}
                  placeholder="Cosa ti rende unico rispetto ai competitor..."
                  rows={2}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whoWeHelp">Chi Aiutiamo</Label>
                  <Textarea
                    id="whoWeHelp"
                    value={formData.whoWeHelp}
                    onChange={(e) => onChange("whoWeHelp", e.target.value)}
                    placeholder="Il tuo cliente ideale..."
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="whoWeDontHelp">Chi NON Aiutiamo</Label>
                  <Textarea
                    id="whoWeDontHelp"
                    value={formData.whoWeDontHelp}
                    onChange={(e) => onChange("whoWeDontHelp", e.target.value)}
                    placeholder="Clienti non target..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whatWeDo">Cosa Facciamo</Label>
                  <Textarea
                    id="whatWeDo"
                    value={formData.whatWeDo}
                    onChange={(e) => onChange("whatWeDo", e.target.value)}
                    placeholder="I servizi che offri..."
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="howWeDoIt">Come Lo Facciamo</Label>
                  <Textarea
                    id="howWeDoIt"
                    value={formData.howWeDoIt}
                    onChange={(e) => onChange("howWeDoIt", e.target.value)}
                    placeholder="Il tuo metodo/processo..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <Card className="border-2 border-green-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10 cursor-pointer hover:from-green-500/10 hover:to-green-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-500" />
                  <CardTitle>Credenziali & Risultati</CardTitle>
                </div>
                {credentialsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Esperienza, software, libri e case studies</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="yearsExperience">Anni di Esperienza</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    value={formData.yearsExperience}
                    onChange={(e) => onChange("yearsExperience", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="clientsHelped">Clienti Aiutati</Label>
                  <Input
                    id="clientsHelped"
                    type="number"
                    min="0"
                    value={formData.clientsHelped}
                    onChange={(e) => onChange("clientsHelped", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="resultsGenerated">Risultati Generati</Label>
                  <Input
                    id="resultsGenerated"
                    value={formData.resultsGenerated}
                    onChange={(e) => onChange("resultsGenerated", e.target.value)}
                    placeholder="Es: €10M+ fatturato"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Software Creati</Label>
                  <Button type="button" onClick={handleAddSoftware} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.softwareCreated || []).map((software: any, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={software.emoji}
                        onChange={(e) => handleUpdateSoftware(index, "emoji", e.target.value)}
                        placeholder="📱"
                        className="w-16 text-center"
                      />
                      <Input
                        value={software.name}
                        onChange={(e) => handleUpdateSoftware(index, "name", e.target.value)}
                        placeholder="Nome software"
                        className="flex-1"
                      />
                      <Input
                        value={software.description}
                        onChange={(e) => handleUpdateSoftware(index, "description", e.target.value)}
                        placeholder="Breve descrizione"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSoftware(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Libri Pubblicati</Label>
                  <Button type="button" onClick={handleAddBook} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.booksPublished || []).map((book: any, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={book.title}
                        onChange={(e) => handleUpdateBook(index, "title", e.target.value)}
                        placeholder="Titolo del libro"
                        className="flex-1"
                      />
                      <Input
                        value={book.year}
                        onChange={(e) => handleUpdateBook(index, "year", e.target.value)}
                        placeholder="Anno"
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBook(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Case Studies</Label>
                  <Button type="button" onClick={handleAddCaseStudy} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.caseStudies || []).map((caseStudy: any, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={caseStudy.client}
                        onChange={(e) => handleUpdateCaseStudy(index, "client", e.target.value)}
                        placeholder="Nome cliente"
                        className="flex-1"
                      />
                      <Input
                        value={caseStudy.result}
                        onChange={(e) => handleUpdateCaseStudy(index, "result", e.target.value)}
                        placeholder="Risultato ottenuto"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCaseStudy(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 cursor-pointer hover:from-purple-500/10 hover:to-purple-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-500" />
                  <CardTitle>Servizi & Garanzie</CardTitle>
                </div>
                {servicesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Offerta commerciale e garanzie</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Servizi Offerti</Label>
                  <Button type="button" onClick={handleAddService} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.servicesOffered || []).map((service: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg bg-card space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={service.name}
                          onChange={(e) => handleUpdateService(index, "name", e.target.value)}
                          placeholder="Nome servizio"
                          className="flex-1"
                        />
                        <Input
                          value={service.price}
                          onChange={(e) => handleUpdateService(index, "price", e.target.value)}
                          placeholder="Prezzo"
                          className="w-32"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveService(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={service.description}
                        onChange={(e) => handleUpdateService(index, "description", e.target.value)}
                        placeholder="Descrizione servizio"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="guarantees">Garanzie</Label>
                <Textarea
                  id="guarantees"
                  value={formData.guarantees}
                  onChange={(e) => onChange("guarantees", e.target.value)}
                  placeholder="Le garanzie che offri ai tuoi clienti..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
        <Card className="border-2 border-orange-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-orange-500/5 to-orange-500/10 cursor-pointer hover:from-orange-500/10 hover:to-orange-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-orange-500" />
                  <CardTitle>📚 Knowledge Base & Documenti</CardTitle>
                </div>
                {knowledgeOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">
                Documenti e informazioni aggiuntive per l'AI
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              {!agentId && (
                <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                  <p className="text-sm text-muted-foreground">
                    💡 Salva prima la configurazione dell'agente per poter aggiungere elementi alla knowledge base
                  </p>
                </div>
              )}

              {isLoadingKnowledge && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Quick Upload Dropzone - Main Feature */}
              {agentId && (
                <QuickUploadDropzone onFilesDropped={handleQuickUpload} />
              )}

              {/* Files Currently Uploading */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">⏳ Caricamento in corso...</Label>
                  {uploadingFiles.map((uploadFile, index) => (
                    <Card key={index} className="p-4 bg-primary/5 border-primary/20">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {uploadFile.status === "success" && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                              {uploadFile.status === "error" && (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                              {(uploadFile.status === "uploading" || uploadFile.status === "processing") && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                              <p className="font-medium text-sm">{uploadFile.title}</p>
                              <Badge variant="secondary" className="text-xs">
                                {uploadFile.type.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {uploadFile.file.name}
                            </p>
                            {uploadFile.error && (
                              <p className="text-xs text-destructive mt-1">
                                {uploadFile.error}
                              </p>
                            )}
                          </div>
                        </div>
                        {uploadFile.status !== "error" && (
                          <Progress value={uploadFile.progress} className="h-1" />
                        )}
                        {uploadFile.status === "processing" && (
                          <p className="text-xs text-muted-foreground">
                            Estraendo testo dal documento...
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Existing Knowledge Items */}
              {knowledgeItems.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">✓ Elementi Salvati ({knowledgeItems.length})</Label>
                  {knowledgeItems.map((item) => {
                    const getBadgeColor = (type: string) => {
                      switch (type) {
                        case 'pdf': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                        case 'docx': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                        case 'txt': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                        case 'text': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
                        default: return '';
                      }
                    };

                    const formatFileSize = (bytes?: number | null) => {
                      if (!bytes) return null;
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };

                    const formatDate = (date?: Date | null) => {
                      if (!date) return null;
                      const d = new Date(date);
                      return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
                    };

                    return (
                      <Card key={item.id} className="p-4 bg-card/50 hover:bg-card/70 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <h4 className="font-semibold">{item.title}</h4>
                              <Badge variant="secondary" className={`text-xs ${getBadgeColor(item.type)}`}>
                                {item.type.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {item.fileName && (
                                <span className="flex items-center gap-1">
                                  📎 {item.fileName}
                                </span>
                              )}
                              {formatFileSize(item.fileSize) && (
                                <span>• {formatFileSize(item.fileSize)}</span>
                              )}
                              {formatDate(item.createdAt) && (
                                <span>• {formatDate(item.createdAt)}</span>
                              )}
                            </div>
                            {item.content && (
                              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {item.content.substring(0, 200)}{item.content.length > 200 ? '...' : ''}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKnowledgeItem(item.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Draft Items (New/Unsaved) */}
              {knowledgeDrafts.map((draft, index) => (
                <KnowledgeItemEditor
                  key={index}
                  draft={draft}
                  index={index}
                  onUpdate={handleUpdateDraft}
                  onSave={handleSaveKnowledgeItem}
                  onRemove={handleRemoveDraft}
                />
              ))}

              {/* Manual Add Button (for advanced users) */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddKnowledgeDraft}
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  disabled={!agentId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Manualmente
                </Button>
                <Button
                  type="button"
                  onClick={handleOpenImportDialog}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                  disabled={!agentId}
                >
                  <Download className="h-4 w-4 mr-2" />
                  📥 Importa da Knowledge Base
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Importa dalla Knowledge Base
            </DialogTitle>
            <DialogDescription>
              Seleziona i documenti dalla tua Knowledge Base da importare in questo agente.
            </DialogDescription>
          </DialogHeader>

          {isLoadingCandidates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : importCandidates.length === 0 ? (
            <div className="text-center py-12">
              <Library className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nessun documento disponibile per l'importazione.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                I documenti già importati o non ancora indicizzati non vengono mostrati.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedDocIds.length === importCandidates.length && importCandidates.length > 0}
                    onCheckedChange={handleSelectAllDocs}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    Seleziona tutti ({importCandidates.length})
                  </Label>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {selectedDocIds.length} selezionato/i
                </Badge>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {importCandidates.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);

                    const getBadgeColor = (type: string) => {
                      switch (type) {
                        case 'pdf': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                        case 'docx': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                        case 'txt': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                        default: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
                      }
                    };

                    const formatFileSize = (bytes?: number | null) => {
                      if (!bytes) return null;
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };

                    const formatDate = (date?: string | null) => {
                      if (!date) return null;
                      const d = new Date(date);
                      return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
                    };

                    return (
                      <div
                        key={doc.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/50' 
                            : 'bg-card/50 border-border hover:bg-card/70'
                        }`}
                        onClick={() => handleToggleDocSelection(doc.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleDocSelection(doc.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{doc.title}</span>
                              <Badge variant="secondary" className={`text-xs ${getBadgeColor(doc.fileType)}`}>
                                {doc.fileType.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              {doc.fileName && (
                                <span className="truncate max-w-[200px]">📎 {doc.fileName}</span>
                              )}
                              {formatFileSize(doc.fileSize) && (
                                <span>• {formatFileSize(doc.fileSize)}</span>
                              )}
                              {formatDate(doc.createdAt) && (
                                <span>• {formatDate(doc.createdAt)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={isImporting}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleImportSelected}
              disabled={selectedDocIds.length === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Importa {selectedDocIds.length > 0 ? `(${selectedDocIds.length})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for editing individual knowledge items
interface KnowledgeItemEditorProps {
  draft: KnowledgeItemDraft;
  index: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onSave: (index: number) => void;
  onRemove: (index: number) => void;
}

function KnowledgeItemEditor({ draft, index, onUpdate, onSave, onRemove }: KnowledgeItemEditorProps) {
  const { toast } = useToast();

  const onDrop = (acceptedFiles: File[]) => {
    console.log("📁 [DROPZONE] onDrop called");
    console.log(`   Files received: ${acceptedFiles.length}`);
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      console.log("✅ [DROPZONE] File accepted:");
      console.log(`   Name: ${file.name}`);
      console.log(`   Type: ${file.type}`);
      console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
      
      // SINGOLO UPDATE per evitare race condition
      onUpdate(index, {
        file: file,
        fileName: file.name
      });
      console.log("📝 [DROPZONE] File and fileName updated in single call");
      // Auto-save viene gestito dal useEffect
    }
  };

  const onDropRejected = (fileRejections: any[]) => {
    console.log("❌ [DROPZONE] Files rejected:", fileRejections.length);
    fileRejections.forEach((rejection, idx) => {
      console.log(`   File ${idx + 1}: ${rejection.file.name}`);
      console.log(`   Errors:`, rejection.errors);
    });
    
    toast({
      title: "File non accettato",
      description: `Il file deve essere in formato ${draft.type.toUpperCase()}. Controlla il tipo di file e riprova.`,
      variant: "destructive",
    });
  };

  // MIME types corretti per react-dropzone
  const acceptedTypes: Record<string, Record<string, string[]> | undefined> = {
    text: undefined,
    pdf: {
      'application/pdf': ['.pdf']
    },
    docx: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    txt: {
      'text/plain': ['.txt']
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: acceptedTypes[draft.type],
    maxFiles: 1,
    disabled: draft.type === "text",
  });

  return (
    <Card className="p-4 border-2 border-dashed border-primary/30 bg-primary/5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Nuovo Elemento</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={draft.isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Title Input */}
        <div>
          <Label htmlFor={`knowledge-title-${index}`}>Titolo *</Label>
          <Input
            id={`knowledge-title-${index}`}
            value={draft.title}
            onChange={(e) => onUpdate(index, "title", e.target.value)}
            placeholder="Es: Listino Prezzi 2024"
            className="mt-1"
            disabled={draft.isSaving}
          />
        </div>

        {/* Type Select */}
        <div>
          <Label htmlFor={`knowledge-type-${index}`}>Tipo *</Label>
          <Select
            value={draft.type}
            onValueChange={(value: "text" | "pdf" | "docx" | "txt") => {
              console.log("🔄 Type changed:", { index, oldType: draft.type, newType: value });
              // SINGOLO UPDATE con tutti i cambiamenti insieme
              onUpdate(index, {
                type: value,
                file: undefined,
                fileName: undefined,
                content: value === "text" ? (draft.content || "") : undefined
              });
              console.log("✅ Type update completed");
            }}
            disabled={draft.isSaving}
          >
            <SelectTrigger className="mt-1" id={`knowledge-type-${index}`}>
              <SelectValue placeholder="Seleziona tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Testo</span>
                </div>
              </SelectItem>
              <SelectItem value="pdf">
                <div className="flex items-center gap-2">
                  <FileUpIcon className="h-4 w-4" />
                  <span>PDF</span>
                </div>
              </SelectItem>
              <SelectItem value="docx">
                <div className="flex items-center gap-2">
                  <FileUpIcon className="h-4 w-4" />
                  <span>DOCX</span>
                </div>
              </SelectItem>
              <SelectItem value="txt">
                <div className="flex items-center gap-2">
                  <FileUpIcon className="h-4 w-4" />
                  <span>TXT</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content or File Upload */}
        {draft.type === "text" ? (
          <div>
            <Label htmlFor={`knowledge-content-${index}`}>Contenuto *</Label>
            <Textarea
              id={`knowledge-content-${index}`}
              value={draft.content || ""}
              onChange={(e) => onUpdate(index, "content", e.target.value)}
              placeholder="Inserisci il contenuto testuale..."
              rows={5}
              className="mt-1"
              disabled={draft.isSaving}
            />
          </div>
        ) : (
          <div>
            <Label>File Upload *</Label>
            <div
              {...getRootProps()}
              className={`mt-1 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/25 hover:border-primary/50"
              } ${draft.isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center">
                <FileUpIcon className="h-8 w-8 text-muted-foreground mb-2" />
                {draft.fileName ? (
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✓ {draft.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Clicca o trascina per sostituire
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive ? "Rilascia il file qui..." : "Trascina un file qui"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      o clicca per selezionare ({draft.type.toUpperCase()})
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          type="button"
          onClick={() => onSave(index)}
          className="w-full"
          disabled={draft.isSaving}
        >
          {draft.isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvataggio...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salva Elemento
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// Quick Upload Dropzone Component - Main upload interface
interface QuickUploadDropzoneProps {
  onFilesDropped: (files: File[]) => void;
}

function QuickUploadDropzone({ onFilesDropped }: QuickUploadDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesDropped,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt']
    },
    maxFiles: 10,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
        isDragActive
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "border-primary/30 bg-gradient-to-br from-primary/5 to-orange-500/5 hover:border-primary/50 hover:bg-primary/10"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="p-4 rounded-full bg-primary/10">
          <FileUpIcon className="h-8 w-8 text-primary" />
        </div>
        {isDragActive ? (
          <div>
            <p className="text-lg font-semibold text-primary">
              Rilascia i file qui...
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-semibold">
              🎯 Upload Veloce
            </p>
            <p className="text-sm text-muted-foreground">
              Trascina i tuoi documenti qui o clicca per selezionarli
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                PDF
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                DOCX
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                TXT
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Fino a 10 file alla volta • Titolo automatico • Salvataggio immediato
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
