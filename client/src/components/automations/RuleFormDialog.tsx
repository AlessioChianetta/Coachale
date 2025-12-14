import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateFollowupRule } from "@/hooks/useFollowupApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Brain, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const ruleFormSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  description: z.string().optional(),
  triggerType: z.enum(["time_based", "event_based", "ai_decision"]),
  hoursWithoutReply: z.coerce.number().min(1).optional(),
  fallbackMessage: z.string().optional(),
  maxAttempts: z.coerce.number().min(1).max(10).default(3),
  cooldownHours: z.coerce.number().min(1).max(168).default(24),
  priority: z.coerce.number().min(1).max(10).default(5),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

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
  fallbackMessage?: string;
}

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: () => void;
  editingRule: FollowupRule | null;
}

const PRESET_RULES = [
  {
    id: "24h",
    name: "Ricontatto dopo 24 ore",
    description: "Se il lead non risponde entro 24 ore, invio un messaggio di follow-up",
    icon: Clock,
    triggerType: "time_based" as const,
    hoursWithoutReply: 24,
    maxAttempts: 3,
    cooldownHours: 24,
  },
  {
    id: "48h",
    name: "Ricontatto dopo 48 ore",
    description: "Aspetto 48 ore prima di ricontattare - approccio più soft",
    icon: Clock,
    triggerType: "time_based" as const,
    hoursWithoutReply: 48,
    maxAttempts: 2,
    cooldownHours: 48,
  },
  {
    id: "ai",
    name: "Decisione intelligente",
    description: "L'AI decide quando è il momento giusto per ricontattare in base al contesto",
    icon: Brain,
    triggerType: "ai_decision" as const,
    hoursWithoutReply: undefined,
    maxAttempts: 3,
    cooldownHours: 12,
  },
];

export function RuleFormDialog({ open, onOpenChange, editingRule }: RuleFormDialogProps) {
  const createMutation = useCreateFollowupRule();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      triggerType: "time_based",
      hoursWithoutReply: 24,
      fallbackMessage: "",
      maxAttempts: 3,
      cooldownHours: 24,
      priority: 5,
    },
  });

  useEffect(() => {
    if (editingRule) {
      setSelectedPreset(null);
      setShowAdvanced(true);
      form.reset({
        name: editingRule.name,
        description: editingRule.description || "",
        triggerType: editingRule.triggerType,
        hoursWithoutReply: editingRule.triggerCondition?.hoursWithoutReply || 24,
        fallbackMessage: editingRule.fallbackMessage || "",
        maxAttempts: editingRule.maxAttempts,
        cooldownHours: editingRule.cooldownHours,
        priority: editingRule.priority,
      });
    } else {
      setSelectedPreset(null);
      setShowAdvanced(false);
      form.reset({
        name: "",
        description: "",
        triggerType: "time_based",
        hoursWithoutReply: 24,
        fallbackMessage: "",
        maxAttempts: 3,
        cooldownHours: 24,
        priority: 5,
      });
    }
  }, [editingRule, form, open]);

  const handlePresetSelect = (presetId: string) => {
    const preset = PRESET_RULES.find(p => p.id === presetId);
    if (!preset) return;
    
    setSelectedPreset(presetId);
    form.setValue("name", preset.name);
    form.setValue("description", preset.description);
    form.setValue("triggerType", preset.triggerType);
    form.setValue("hoursWithoutReply", preset.hoursWithoutReply || 24);
    form.setValue("maxAttempts", preset.maxAttempts);
    form.setValue("cooldownHours", preset.cooldownHours);
  };

  const onSubmit = async (values: RuleFormValues) => {
    const triggerCondition: Record<string, any> = {};

    if (values.triggerType === "time_based" && values.hoursWithoutReply) {
      triggerCondition.hoursWithoutReply = values.hoursWithoutReply;
    }

    const payload = {
      name: values.name,
      description: values.description || null,
      triggerType: values.triggerType,
      triggerCondition,
      fallbackMessage: values.fallbackMessage || null,
      maxAttempts: values.maxAttempts,
      cooldownHours: values.cooldownHours,
      priority: values.priority,
    };

    await createMutation.mutateAsync(payload);
    onOpenChange();
    form.reset();
    setSelectedPreset(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editingRule ? "Modifica Regola" : "Crea una nuova automazione"}
          </DialogTitle>
          <DialogDescription className="text-base">
            Scegli quando vuoi ricontattare automaticamente i lead che non rispondono.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {!editingRule && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Cosa vuoi che faccia il sistema?
                </p>
                <div className="grid gap-3">
                  {PRESET_RULES.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <Card 
                        key={preset.id}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-md",
                          isSelected 
                            ? "border-2 border-blue-500 bg-blue-50" 
                            : "border border-gray-200 hover:border-blue-300"
                        )}
                        onClick={() => handlePresetSelect(preset.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className={cn(
                                "font-medium",
                                isSelected ? "text-blue-700" : "text-gray-900"
                              )}>
                                {preset.name}
                              </h4>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {preset.description}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="text-blue-500">
                                <Zap className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {(selectedPreset || editingRule) && (
              <>
                <FormField
                  control={form.control}
                  name="fallbackMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Messaggio da inviare</FormLabel>
                      <FormDescription>
                        Scrivi il messaggio che vuoi inviare quando il lead non risponde.
                        Lascia vuoto per usare i template WhatsApp configurati.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          placeholder="Ciao! Volevo sapere se hai avuto modo di riflettere sulla nostra conversazione..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between text-gray-500 hover:text-gray-700"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>Impostazioni avanzate</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome della regola</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("triggerType") === "time_based" && (
                      <FormField
                        control={form.control}
                        name="hoursWithoutReply"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ore di attesa prima del ricontatto</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={168} {...field} />
                            </FormControl>
                            <FormDescription>
                              Quante ore aspettare prima di ricontattare (1-168)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="maxAttempts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tentativi massimi</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={10} {...field} />
                            </FormControl>
                            <FormDescription>
                              Quante volte riprovare
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cooldownHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pausa tra tentativi</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={168} {...field} />
                            </FormControl>
                            <FormDescription>
                              Ore tra un tentativo e l'altro
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onOpenChange}>
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || (!selectedPreset && !editingRule)}
              >
                {createMutation.isPending
                  ? "Salvataggio..."
                  : editingRule
                    ? "Salva modifiche"
                    : "Attiva automazione"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
