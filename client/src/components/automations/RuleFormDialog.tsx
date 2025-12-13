import { useEffect } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function RuleFormDialog({ open, onOpenChange, editingRule }: RuleFormDialogProps) {
  const createMutation = useCreateFollowupRule();

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

  const watchTriggerType = form.watch("triggerType");

  useEffect(() => {
    if (editingRule) {
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
  }, [editingRule, form]);

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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Modifica Regola" : "Nuova Regola di Automazione"}
          </DialogTitle>
          <DialogDescription>
            Configura le impostazioni per la regola di follow-up automatico.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome regola *</FormLabel>
                  <FormControl>
                    <Input placeholder="es. Follow-up 24h" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrizione opzionale della regola..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di trigger</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo trigger" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="time_based">Basato sul tempo</SelectItem>
                      <SelectItem value="event_based">Basato su evento</SelectItem>
                      <SelectItem value="ai_decision">Decisione AI</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchTriggerType === "time_based" && (
              <FormField
                control={form.control}
                name="hoursWithoutReply"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ore senza risposta</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={168} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="fallbackMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Messaggio fallback</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Messaggio da inviare se nessun template è disponibile..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="maxAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max tentativi</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cooldownHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cooldown (ore)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={168} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorità (1-10)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onOpenChange}>
                Annulla
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Salvataggio..."
                  : editingRule
                    ? "Salva modifiche"
                    : "Crea regola"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
