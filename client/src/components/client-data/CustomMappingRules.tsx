import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2, Edit, ArrowRight, Sparkles, RefreshCw } from "lucide-react";

const LOGICAL_ROLE_OPTIONS = [
  { value: "document_id", label: "ID Documento" },
  { value: "line_id", label: "ID Riga" },
  { value: "revenue_amount", label: "Importo Fatturato" },
  { value: "price", label: "Prezzo Unitario" },
  { value: "cost", label: "Costo" },
  { value: "quantity", label: "Quantità" },
  { value: "product_id", label: "ID Prodotto" },
  { value: "product_name", label: "Nome Prodotto" },
  { value: "category", label: "Categoria" },
  { value: "customer_id", label: "ID Cliente" },
  { value: "customer_name", label: "Nome Cliente" },
  { value: "supplier_id", label: "ID Fornitore" },
  { value: "supplier_name", label: "Nome Fornitore" },
  { value: "order_date", label: "Data" },
  { value: "payment_method", label: "Metodo Pagamento" },
  { value: "status", label: "Stato" },
  { value: "warehouse", label: "Magazzino" },
  { value: "tax_rate", label: "Aliquota IVA" },
  { value: "is_sellable", label: "È Vendibile" },
];

const MATCH_TYPE_OPTIONS = [
  { value: "contains", label: "Contiene" },
  { value: "exact", label: "Esatto" },
  { value: "startswith", label: "Inizia con" },
  { value: "endswith", label: "Finisce con" },
];

interface CustomMappingRule {
  id: number;
  consultantId: string;
  columnPattern: string;
  logicalRole: string;
  matchType: "exact" | "contains" | "startswith" | "endswith";
  caseSensitive: boolean;
  priority: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  columnPattern: string;
  logicalRole: string;
  matchType: "exact" | "contains" | "startswith" | "endswith";
  caseSensitive: boolean;
  priority: number;
  description: string;
}

const defaultFormData: RuleFormData = {
  columnPattern: "",
  logicalRole: "",
  matchType: "contains",
  caseSensitive: false,
  priority: 0,
  description: "",
};

export function CustomMappingRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomMappingRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; data: CustomMappingRule[] }>({
    queryKey: ["/api/client-data/mapping-rules"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/client-data/mapping-rules", {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error("Errore nel caricamento");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/client-data/mapping-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Errore nella creazione");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-data/mapping-rules"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast({
        title: "Regola creata",
        description: "La regola di mapping è stata salvata.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare la regola. Riprova.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RuleFormData }) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/mapping-rules/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Errore nell'aggiornamento");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-data/mapping-rules"] });
      setIsDialogOpen(false);
      setEditingRule(null);
      setFormData(defaultFormData);
      toast({
        title: "Regola aggiornata",
        description: "Le modifiche sono state salvate.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la regola. Riprova.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/mapping-rules/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error("Errore nell'eliminazione");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-data/mapping-rules"] });
      toast({
        title: "Regola eliminata",
        description: "La regola è stata rimossa.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la regola. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.columnPattern || !formData.logicalRole) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci il pattern della colonna e il ruolo.",
        variant: "destructive",
      });
      return;
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (rule: CustomMappingRule) => {
    setEditingRule(rule);
    setFormData({
      columnPattern: rule.columnPattern,
      logicalRole: rule.logicalRole,
      matchType: rule.matchType,
      caseSensitive: rule.caseSensitive,
      priority: rule.priority,
      description: rule.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenNew = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const rules = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-violet-600" />
              Regole di Mapping Personalizzate
            </CardTitle>
            <CardDescription className="mt-1">
              Definisci regole automatiche per mappare i nomi colonna ai ruoli logici
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenNew} size="sm" className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Regola
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingRule ? "Modifica Regola" : "Nuova Regola di Mapping"}
                  </DialogTitle>
                  <DialogDescription>
                    Quando una colonna corrisponde al pattern, verrà mappata automaticamente al ruolo selezionato.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="columnPattern">Pattern Colonna</Label>
                    <Input
                      id="columnPattern"
                      placeholder="es. prezzo_finale, totale, importo..."
                      value={formData.columnPattern}
                      onChange={(e) => setFormData({ ...formData, columnPattern: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">
                      Il testo da cercare nel nome della colonna
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo Corrispondenza</Label>
                      <Select
                        value={formData.matchType}
                        onValueChange={(value: "exact" | "contains" | "startswith" | "endswith") =>
                          setFormData({ ...formData, matchType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATCH_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Ruolo Logico</Label>
                      <Select
                        value={formData.logicalRole}
                        onValueChange={(value) => setFormData({ ...formData, logicalRole: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona ruolo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {LOGICAL_ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrizione (opzionale)</Label>
                    <Input
                      id="description"
                      placeholder="es. Per export da gestionale XYZ"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 bg-violet-50 p-3 rounded-lg">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span>
                      Esempio: se il pattern è "prezzo_finale" e il tipo è "contiene", qualsiasi colonna
                      con "prezzo_finale" nel nome (es. "prezzo_finale_netto") verrà mappata automaticamente.
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingRule ? "Salva Modifiche" : "Crea Regola"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Settings2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nessuna regola definita</p>
            <p className="text-sm mt-1">
              Crea regole personalizzate per mappare automaticamente le colonne dei tuoi clienti.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const roleInfo = LOGICAL_ROLE_OPTIONS.find((r) => r.value === rule.logicalRole);
              const matchInfo = MATCH_TYPE_OPTIONS.find((m) => m.value === rule.matchType);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded border">
                        {rule.columnPattern}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {matchInfo?.label || rule.matchType}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <Badge className="bg-violet-100 text-violet-800 border-violet-200">
                      {roleInfo?.label || rule.logicalRole}
                    </Badge>
                    {rule.description && (
                      <span className="text-xs text-gray-500 truncate">
                        {rule.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(rule)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
