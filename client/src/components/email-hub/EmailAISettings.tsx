import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { 
  Sparkles, 
  Save, 
  Loader2, 
  X, 
  Plus,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Shield,
  Languages,
} from "lucide-react";

interface EmailAISettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

interface AISettings {
  id: string;
  aiTone: string;
  confidenceThreshold: number;
  autoReplyMode: string;
  signature: string | null;
  customInstructions: string | null;
  aiLanguage: string | null;
  escalationKeywords: string[] | null;
  stopOnRisk: boolean | null;
  bookingLink: string | null;
}

export function EmailAISettings({
  open,
  onOpenChange,
  accountId,
  accountName,
}: EmailAISettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState("");

  const [formData, setFormData] = useState<{
    aiTone: string;
    confidenceThreshold: number;
    autoReplyMode: string;
    signature: string;
    customInstructions: string;
    aiLanguage: string;
    escalationKeywords: string[];
    stopOnRisk: boolean;
    bookingLink: string;
  }>({
    aiTone: "professional",
    confidenceThreshold: 0.8,
    autoReplyMode: "review",
    signature: "",
    customInstructions: "",
    aiLanguage: "it",
    escalationKeywords: [],
    stopOnRisk: true,
    bookingLink: "",
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["email-ai-settings", accountId],
    queryFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/ai-settings`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento impostazioni");
      return response.json();
    },
    enabled: open && !!accountId,
  });

  useEffect(() => {
    if (settingsData?.data) {
      const s = settingsData.data as AISettings;
      setFormData({
        aiTone: s.aiTone || "professional",
        confidenceThreshold: s.confidenceThreshold ?? 0.8,
        autoReplyMode: s.autoReplyMode || "review",
        signature: s.signature || "",
        customInstructions: s.customInstructions || "",
        aiLanguage: s.aiLanguage || "it",
        escalationKeywords: s.escalationKeywords || [],
        stopOnRisk: s.stopOnRisk ?? true,
        bookingLink: s.bookingLink || "",
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/ai-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel salvataggio");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Impostazioni salvate",
        description: "Le preferenze AI sono state aggiornate",
      });
      queryClient.invalidateQueries({ queryKey: ["email-ai-settings", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.escalationKeywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        escalationKeywords: [...prev.escalationKeywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      escalationKeywords: prev.escalationKeywords.filter(k => k !== keyword),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Impostazioni AI - {accountName}
          </DialogTitle>
          <DialogDescription>
            Configura come l'AI genera le risposte per questo account email
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Tono e Stile
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tono delle risposte</Label>
                    <Select
                      value={formData.aiTone}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, aiTone: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formale (Lei)</SelectItem>
                        <SelectItem value="professional">Professionale</SelectItem>
                        <SelectItem value="friendly">Amichevole (Tu)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      Lingua risposte
                    </Label>
                    <Select
                      value={formData.aiLanguage}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, aiLanguage: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="auto">Automatico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modalita risposta automatica</Label>
                  <Select
                    value={formData.autoReplyMode}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, autoReplyMode: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Disattivato - Nessuna bozza automatica</SelectItem>
                      <SelectItem value="review">Revisione - Genera bozza, attendi approvazione</SelectItem>
                      <SelectItem value="auto">Automatico - Invia se confidenza alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Soglia di confidenza: {Math.round(formData.confidenceThreshold * 100)}%</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.confidenceThreshold >= 0.9 ? "Molto alta" : 
                       formData.confidenceThreshold >= 0.7 ? "Alta" : 
                       formData.confidenceThreshold >= 0.5 ? "Media" : "Bassa"}
                    </span>
                  </div>
                  <Slider
                    value={[formData.confidenceThreshold]}
                    onValueChange={([val]) => setFormData(prev => ({ ...prev, confidenceThreshold: val }))}
                    min={0.3}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI inviera automaticamente solo se la confidenza supera questa soglia
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Sicurezza e Escalation
                </h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Blocca su rischio rilevato</Label>
                    <p className="text-xs text-muted-foreground">
                      Ferma l'invio automatico se l'AI rileva sentiment negativo o urgenza alta
                    </p>
                  </div>
                  <Switch
                    checked={formData.stopOnRisk}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, stopOnRisk: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Parole chiave per escalation
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="es. reclamo, avvocato, urgente..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleAddKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.escalationKeywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="gap-1">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {formData.escalationKeywords.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Nessuna parola chiave configurata
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se l'email contiene queste parole, l'AI non rispondera automaticamente
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prenotazioni
                </h3>

                <div className="space-y-2">
                  <Label>Link prenotazione appuntamento</Label>
                  <Input
                    placeholder="https://calendly.com/tuo-link"
                    value={formData.bookingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, bookingLink: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI includera questo link quando suggerisce un appuntamento
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Istruzioni personalizzate</h3>
                
                <div className="space-y-2">
                  <Label>Istruzioni aggiuntive per l'AI</Label>
                  <Textarea
                    placeholder="Es: Ricorda sempre di menzionare la nostra offerta speciale. Non promettere sconti oltre il 10%. Suggerisci sempre una chiamata per preventivi complessi..."
                    value={formData.customInstructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, customInstructions: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Queste istruzioni verranno incluse in ogni risposta generata dall'AI
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Firma email</Label>
                  <Textarea
                    placeholder="Cordiali saluti,&#10;Mario Rossi&#10;Consulente Senior&#10;Tel: +39 123 456 7890"
                    value={formData.signature}
                    onChange={(e) => setFormData(prev => ({ ...prev, signature: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saveMutation.isPending}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salva Impostazioni
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
