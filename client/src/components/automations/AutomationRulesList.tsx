import { useState } from "react";
import {
  useFollowupRules,
  useToggleFollowupRule,
  useDeleteFollowupRule,
} from "@/hooks/useFollowupApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Clock, Zap, Brain, Pencil, Trash2, Settings } from "lucide-react";
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

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <Card>
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Settings className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nessuna regola configurata</h3>
          <p className="text-muted-foreground mb-6">
            Crea la tua prima regola di automazione!
          </p>
          <Button onClick={onCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuova Regola
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationRulesList() {
  const { data: rules, isLoading } = useFollowupRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);

  const handleCreateNew = () => {
    setEditingRule(null);
    setDialogOpen(true);
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
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const rulesList = (rules as FollowupRule[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuova Regola
        </Button>
      </div>

      {rulesList.length === 0 ? (
        <EmptyState onCreateNew={handleCreateNew} />
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
    </div>
  );
}
