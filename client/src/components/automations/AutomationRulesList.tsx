import { useState } from "react";
import {
  useFollowupRules,
  useToggleFollowupRule,
  useDeleteFollowupRule,
  useGenerateRuleWithAI,
  useCreateFollowupRule,
} from "@/hooks/useFollowupApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Clock, Zap, Brain, Pencil, Trash2, Settings, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { RuleFormDialog } from "./RuleFormDialog";

interface FollowupRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: "time_based" | "event_based" | "ai_decision";
  triggerCondition: Record<string, any>;
  maxAttempts: number;
  cooldownHours: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

function getTriggerIcon(type: string) {
  switch (type) {
    case "time_based":
      return <Clock className="h-4 w-4" />;
    case "event_based":
      return <Zap className="h-4 w-4" />;
    case "ai_decision":
      return <Brain className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

function getTriggerLabel(type: string) {
  switch (type) {
    case "time_based":
      return "Basato sul tempo";
    case "event_based":
      return "Basato su evento";
    case "ai_decision":
      return "Decisione AI";
    default:
      return type;
  }
}

function getTriggerConditionSummary(rule: FollowupRule) {
  const condition = rule.triggerCondition;
  if (rule.triggerType === "time_based" && condition?.hoursWithoutReply) {
    return `Dopo ${condition.hoursWithoutReply} ore senza risposta`;
  }
  if (rule.triggerType === "event_based" && condition?.eventType) {
    return `Evento: ${condition.eventType}`;
  }
  if (rule.triggerType === "ai_decision") {
    return "Decisione automatica AI";
  }
  return "Condizione personalizzata";
}

function RuleCard({
  rule,
  onEdit,
}: {
  rule: FollowupRule;
  onEdit: (rule: FollowupRule) => void;
}) {
  const toggleMutation = useToggleFollowupRule();
  const deleteMutation = useDeleteFollowupRule();

  return (
    <Card className={`${!rule.isActive ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {rule.name}
              <Badge variant="secondary" className="flex items-center gap-1">
                {getTriggerIcon(rule.triggerType)}
                <span className="text-xs">{getTriggerLabel(rule.triggerType)}</span>
              </Badge>
            </CardTitle>
            {rule.description && (
              <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
            )}
          </div>
          <Switch
            checked={rule.isActive}
            onCheckedChange={() => toggleMutation.mutate(rule.id)}
            disabled={toggleMutation.isPending}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{getTriggerConditionSummary(rule)}</span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Priorità:</span>
              <Badge variant="outline">{rule.priority}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Max tentativi:</span>
              <span className="font-medium">{rule.maxAttempts}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Cooldown:</span>
              <span className="font-medium">{rule.cooldownHours}h</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(rule)}
              className="flex items-center gap-1"
            >
              <Pencil className="h-4 w-4" />
              Modifica
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa regola?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione non può essere annullata. La regola "{rule.name}" verrà
                    eliminata permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onCreateNew, onCreateWithAI }: { onCreateNew: () => void; onCreateWithAI: () => void }) {
  return (
    <Card>
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Settings className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nessuna regola configurata</h3>
          <p className="text-muted-foreground mb-6">
            Crea la tua prima regola di automazione!
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={onCreateNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuova Regola
            </Button>
            <Button onClick={onCreateWithAI} variant="secondary" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Crea con AI
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface GeneratedRule {
  name: string;
  description: string;
  triggerType: "time_based" | "event_based" | "ai_decision";
  triggerCondition: Record<string, any>;
  fallbackMessage: string;
  maxAttempts: number;
  cooldownHours: number;
  priority: number;
}

function AIWizardDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<"input" | "preview">("input");
  const [description, setDescription] = useState("");
  const [generatedRule, setGeneratedRule] = useState<GeneratedRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useGenerateRuleWithAI();
  const createMutation = useCreateFollowupRule();

  const handleGenerate = async () => {
    setError(null);
    try {
      const result = await generateMutation.mutateAsync(description);
      if (result.success && result.data) {
        setGeneratedRule(result.data);
        setStep("preview");
      } else {
        setError("Errore nella risposta AI");
      }
    } catch (err: any) {
      setError(err.message || "Errore durante la generazione");
    }
  };

  const handleSave = async () => {
    if (!generatedRule) return;
    
    try {
      await createMutation.mutateAsync({
        name: generatedRule.name,
        description: generatedRule.description,
        triggerType: generatedRule.triggerType,
        triggerCondition: generatedRule.triggerCondition,
        fallbackMessage: generatedRule.fallbackMessage,
        maxAttempts: generatedRule.maxAttempts,
        cooldownHours: generatedRule.cooldownHours,
        priority: generatedRule.priority,
      });
      handleClose();
    } catch (err: any) {
      setError(err.message || "Errore durante il salvataggio");
    }
  };

  const handleClose = () => {
    setStep("input");
    setDescription("");
    setGeneratedRule(null);
    setError(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep("input");
    setError(null);
  };

  const updateGeneratedRule = (field: keyof GeneratedRule, value: any) => {
    if (generatedRule) {
      setGeneratedRule({ ...generatedRule, [field]: value });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === "input" ? "Crea Regola con AI" : "Regola Generata"}
          </DialogTitle>
          <DialogDescription>
            {step === "input" 
              ? "Descrivi in linguaggio naturale la regola di follow-up che vuoi creare."
              : "Verifica e modifica i campi generati dall'AI, poi salva la regola."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ai-description">Descrivi la tua regola</Label>
              <Textarea
                id="ai-description"
                placeholder="Es: Voglio mandare un reminder dopo 24 ore se il lead non risponde, con massimo 3 tentativi e alta priorità"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Suggerimenti: specifica il tempo di attesa, il numero di tentativi, la priorità e il tipo di messaggio.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
          </div>
        ) : generatedRule && (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Regola generata con successo!</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-name">Nome regola</Label>
              <Input
                id="rule-name"
                value={generatedRule.name}
                onChange={(e) => updateGeneratedRule("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Descrizione</Label>
              <Textarea
                id="rule-description"
                value={generatedRule.description}
                onChange={(e) => updateGeneratedRule("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo di trigger</Label>
              <Select
                value={generatedRule.triggerType}
                onValueChange={(value) => updateGeneratedRule("triggerType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_based">Basato sul tempo</SelectItem>
                  <SelectItem value="event_based">Basato su evento</SelectItem>
                  <SelectItem value="ai_decision">Decisione AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedRule.triggerType === "time_based" && (
              <div className="space-y-2">
                <Label htmlFor="hours-without-reply">Ore senza risposta</Label>
                <Input
                  id="hours-without-reply"
                  type="number"
                  min={1}
                  max={168}
                  value={generatedRule.triggerCondition?.hoursWithoutReply || 24}
                  onChange={(e) => updateGeneratedRule("triggerCondition", { hoursWithoutReply: parseInt(e.target.value) || 24 })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fallback-message">Messaggio fallback</Label>
              <Textarea
                id="fallback-message"
                value={generatedRule.fallbackMessage}
                onChange={(e) => updateGeneratedRule("fallbackMessage", e.target.value)}
                rows={2}
                placeholder="Messaggio da inviare se nessun template è disponibile..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-attempts">Max tentativi</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={1}
                  max={10}
                  value={generatedRule.maxAttempts}
                  onChange={(e) => updateGeneratedRule("maxAttempts", parseInt(e.target.value) || 3)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown-hours">Cooldown (ore)</Label>
                <Input
                  id="cooldown-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={generatedRule.cooldownHours}
                  onChange={(e) => updateGeneratedRule("cooldownHours", parseInt(e.target.value) || 24)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priorità (1-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  max={10}
                  value={generatedRule.priority}
                  onChange={(e) => updateGeneratedRule("priority", parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "input" ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annulla
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={description.trim().length < 10 || generateMutation.isPending}
                className="flex items-center gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generazione...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Genera Regola
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                Indietro
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={createMutation.isPending}
                className="flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva Regola"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationRulesList() {
  const { data: rules, isLoading } = useFollowupRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);

  const handleCreateNew = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleCreateWithAI = () => {
    setAiDialogOpen(true);
  };

  const handleEdit = (rule: FollowupRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const rulesList = (rules as FollowupRule[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={handleCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuova Regola
        </Button>
        <Button onClick={handleCreateWithAI} variant="secondary" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Crea con AI
        </Button>
      </div>

      {rulesList.length === 0 ? (
        <EmptyState onCreateNew={handleCreateNew} onCreateWithAI={handleCreateWithAI} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rulesList.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingRule={editingRule}
      />

      <AIWizardDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
      />
    </div>
  );
}
