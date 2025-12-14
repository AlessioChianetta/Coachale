import { useState } from "react";
import { useWhatsAppTemplates, useGenerateTemplateWithAI, useCreateWhatsAppTemplate } from "@/hooks/useFollowupApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, ExternalLink, Check, AlertCircle, Clock, Sparkles, Loader2, Save, Eye } from "lucide-react";
import { Link } from "wouter";

interface WhatsAppTemplate {
  id: string;
  templateName: string;
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final";
  description: string | null;
  updatedAt: string;
  activeVersion?: {
    twilioApprovalStatus: "not_synced" | "pending" | "approved" | "rejected" | null;
  } | null;
}

interface GeneratedTemplate {
  templateName: string;
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final";
  description: string;
  bodyText: string;
  variables: Array<{ variableKey: string; position: number }>;
  extractedVariables: string[];
}

function getTemplateTypeBadge(type: string) {
  switch (type) {
    case "opening":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Opening</Badge>;
    case "followup_gentle":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Gentle</Badge>;
    case "followup_value":
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Value</Badge>;
    case "followup_final":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Final</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
}

function getTemplateTypeLabel(type: string) {
  switch (type) {
    case "opening":
      return "Primo Contatto";
    case "followup_gentle":
      return "Follow-up Gentile";
    case "followup_value":
      return "Follow-up Valore";
    case "followup_final":
      return "Follow-up Finale";
    default:
      return type;
  }
}

function getSyncStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Approvato
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          In Attesa
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Rifiutato
        </Badge>
      );
    case "not_synced":
    default:
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Non sincronizzato
        </Badge>
      );
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TemplateCard({ template }: { template: WhatsAppTemplate }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{template.templateName}</CardTitle>
          {getTemplateTypeBadge(template.templateType)}
        </div>
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Twilio:</span>
            {getSyncStatusBadge(template.activeVersion?.twilioApprovalStatus)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ultimo aggiornamento:</span>
            <span>{formatDate(template.updatedAt)}</span>
          </div>
          <Link href={`/consultant/whatsapp/custom-templates?id=${template.id}`}>
            <Button variant="outline" size="sm" className="w-full mt-2 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Visualizza
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-9 w-full mt-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nessun template trovato</h3>
          <p className="text-muted-foreground mb-6">
            Vai alla sezione Template WhatsApp per crearne uno nuovo.
          </p>
          <Link href="/consultant/whatsapp/custom-templates">
            <Button className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Crea Template
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AITemplateWizard() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const { toast } = useToast();
  
  const generateMutation = useGenerateTemplateWithAI();
  const createMutation = useCreateWhatsAppTemplate();

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 10) {
      toast({
        title: "Descrizione troppo breve",
        description: "Inserisci una descrizione di almeno 10 caratteri.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync(description);
      if (result.success && result.data) {
        setGeneratedTemplate(result.data);
        toast({
          title: "Template generato!",
          description: "Controlla l'anteprima e salva il template.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore nella generazione",
        description: error.message || "Si è verificato un errore. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!generatedTemplate) return;

    try {
      await createMutation.mutateAsync({
        templateName: generatedTemplate.templateName,
        templateType: generatedTemplate.templateType,
        description: generatedTemplate.description,
        bodyText: generatedTemplate.bodyText,
        variables: generatedTemplate.variables,
      });
      
      toast({
        title: "Template salvato!",
        description: "Il template è stato creato con successo.",
      });
      
      setOpen(false);
      setDescription("");
      setGeneratedTemplate(null);
    } catch (error: any) {
      toast({
        title: "Errore nel salvataggio",
        description: error.message || "Si è verificato un errore. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setDescription("");
    setGeneratedTemplate(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Crea Template con AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Genera Template con AI
          </DialogTitle>
          <DialogDescription>
            Descrivi il tipo di template che desideri e l'AI lo genererà per te.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrivi il template che vuoi creare</Label>
            <Textarea
              id="description"
              placeholder="Es: Un messaggio di follow-up per ricordare un appuntamento, oppure un messaggio di benvenuto per nuovi lead..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={generateMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Sii specifico nella descrizione per ottenere risultati migliori.
            </p>
          </div>

          {!generatedTemplate && (
            <Button 
              onClick={handleGenerate} 
              disabled={generateMutation.isPending || description.length < 10}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Genera Template
                </>
              )}
            </Button>
          )}

          {generatedTemplate && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4" />
                Anteprima Template Generato
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nome:</span>
                  <span className="font-medium">{generatedTemplate.templateName}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  {getTemplateTypeBadge(generatedTemplate.templateType)}
                </div>
                
                {generatedTemplate.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">Descrizione:</span>
                    <p className="text-sm mt-1">{generatedTemplate.description}</p>
                  </div>
                )}
                
                <div>
                  <span className="text-sm text-muted-foreground">Messaggio:</span>
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm whitespace-pre-wrap">{generatedTemplate.bodyText}</p>
                  </div>
                </div>

                {generatedTemplate.extractedVariables.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Variabili utilizzate:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {generatedTemplate.extractedVariables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {`{${v}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {generatedTemplate && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setGeneratedTemplate(null)}
                disabled={createMutation.isPending}
              >
                Rigenera
              </Button>
              <Button 
                onClick={handleSave}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Template
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesGrid() {
  const { data, isLoading } = useWhatsAppTemplates();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const templates = (data?.data as WhatsAppTemplate[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <AITemplateWizard />
        <Link href="/consultant/whatsapp/custom-templates">
          <Button className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Gestisci Template
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
