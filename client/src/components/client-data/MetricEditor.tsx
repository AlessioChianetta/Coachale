import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calculator,
  Plus,
  Trash2,
  Play,
  Save,
  AlertCircle,
  CheckCircle,
  Code,
  Lightbulb,
} from "lucide-react";

interface MetricDefinition {
  id?: string;
  name: string;
  description: string;
  dslExpression: string;
  category: string;
  createdAt?: string;
}

interface MetricEditorProps {
  datasetId: string;
  columns: { name: string; displayName: string; dataType: string }[];
  existingMetric?: MetricDefinition;
  onSave?: (metric: MetricDefinition) => void;
  onCancel?: () => void;
}

const aggregationFunctions = [
  { value: "SUM", label: "Somma", description: "Calcola la somma totale" },
  { value: "AVG", label: "Media", description: "Calcola la media aritmetica" },
  { value: "COUNT", label: "Conteggio", description: "Conta il numero di elementi" },
  { value: "MIN", label: "Minimo", description: "Trova il valore minimo" },
  { value: "MAX", label: "Massimo", description: "Trova il valore massimo" },
  { value: "DISTINCT_COUNT", label: "Conteggio Distinti", description: "Conta valori unici" },
];

const operators = ["+", "-", "*", "/", "(", ")"];

const exampleMetrics = [
  {
    name: "Margine Lordo",
    dsl: "(SUM(ricavi) - SUM(costi)) / SUM(ricavi) * 100",
    description: "Percentuale di margine lordo sul totale ricavi",
  },
  {
    name: "Ticket Medio",
    dsl: "SUM(vendite) / COUNT(transazioni)",
    description: "Valore medio per transazione",
  },
  {
    name: "Tasso Conversione",
    dsl: "COUNT(ordini_completati) / COUNT(visitatori) * 100",
    description: "Percentuale di conversione visite in ordini",
  },
];

export function MetricEditor({
  datasetId,
  columns,
  existingMetric,
  onSave,
  onCancel,
}: MetricEditorProps) {
  const { toast } = useToast();
  const [metric, setMetric] = useState<MetricDefinition>(
    existingMetric || {
      name: "",
      description: "",
      dslExpression: "",
      category: "custom",
    }
  );
  const [testResult, setTestResult] = useState<{ success: boolean; value?: any; error?: string } | null>(null);

  const testMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/client-data/datasets/${datasetId}/query`, {
        dsl: metric.dslExpression,
      }),
    onSuccess: (data: any) => {
      if (data.success) {
        setTestResult({
          success: true,
          value: data.data?.rows?.[0] || data.data?.aggregations || "Nessun risultato",
        });
        toast({
          title: "Test completato",
          description: "La metrica è stata calcolata con successo",
        });
      } else {
        setTestResult({ success: false, error: data.error });
      }
    },
    onError: (error: Error) => {
      setTestResult({ success: false, error: error.message });
      toast({
        title: "Errore nel test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInsertFunction = (func: string) => {
    setMetric((prev) => ({
      ...prev,
      dslExpression: prev.dslExpression + `${func}()`,
    }));
  };

  const handleInsertColumn = (colName: string) => {
    const cursorPos = metric.dslExpression.length;
    const before = metric.dslExpression.slice(0, cursorPos);
    const openParen = before.lastIndexOf("(");
    const closeParen = before.lastIndexOf(")");

    if (openParen > closeParen) {
      setMetric((prev) => ({
        ...prev,
        dslExpression: before.slice(0, openParen + 1) + colName + before.slice(openParen + 1),
      }));
    } else {
      setMetric((prev) => ({
        ...prev,
        dslExpression: prev.dslExpression + colName,
      }));
    }
  };

  const handleInsertOperator = (op: string) => {
    setMetric((prev) => ({
      ...prev,
      dslExpression: prev.dslExpression + ` ${op} `,
    }));
  };

  const handleApplyExample = (example: typeof exampleMetrics[0]) => {
    setMetric((prev) => ({
      ...prev,
      name: example.name,
      description: example.description,
      dslExpression: example.dsl,
    }));
  };

  const handleSave = () => {
    if (!metric.name.trim()) {
      toast({
        title: "Nome richiesto",
        description: "Inserisci un nome per la metrica",
        variant: "destructive",
      });
      return;
    }
    if (!metric.dslExpression.trim()) {
      toast({
        title: "Formula richiesta",
        description: "Inserisci una formula per la metrica",
        variant: "destructive",
      });
      return;
    }
    onSave?.(metric);
  };

  const numericColumns = columns.filter((col) =>
    ["number", "currency", "percentage"].includes(col.dataType)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-600" />
          {existingMetric ? "Modifica Metrica" : "Nuova Metrica"}
        </CardTitle>
        <CardDescription>
          Crea formule personalizzate per analizzare i tuoi dati
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome Metrica</Label>
            <Input
              value={metric.name}
              onChange={(e) => setMetric((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Es. Margine Lordo"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={metric.category}
              onValueChange={(value) => setMetric((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Personalizzata</SelectItem>
                <SelectItem value="financial">Finanziaria</SelectItem>
                <SelectItem value="sales">Vendite</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="operations">Operazioni</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrizione</Label>
          <Input
            value={metric.description}
            onChange={(e) => setMetric((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrivi cosa calcola questa metrica"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Formula DSL
          </Label>
          <Textarea
            value={metric.dslExpression}
            onChange={(e) => setMetric((prev) => ({ ...prev, dslExpression: e.target.value }))}
            placeholder="Es. SUM(vendite) / COUNT(ordini)"
            className="font-mono text-sm h-24"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Funzioni</Label>
            <div className="flex flex-wrap gap-1">
              {aggregationFunctions.map((func) => (
                <Button
                  key={func.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertFunction(func.value)}
                  title={func.description}
                >
                  {func.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Colonne Numeriche</Label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {numericColumns.map((col) => (
                <Badge
                  key={col.name}
                  variant="outline"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleInsertColumn(col.name)}
                >
                  {col.displayName}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Operatori</Label>
            <div className="flex flex-wrap gap-1">
              {operators.map((op) => (
                <Button
                  key={op}
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertOperator(op)}
                  className="w-8 font-mono"
                >
                  {op}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Esempi di Metriche
          </p>
          <div className="grid grid-cols-3 gap-2">
            {exampleMetrics.map((example, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyExample(example)}
                className="text-left p-2 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <p className="text-sm font-medium">{example.name}</p>
                <p className="text-xs text-slate-500 truncate">{example.dsl}</p>
              </button>
            ))}
          </div>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              testResult.success
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-red-50 dark:bg-red-900/20"
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${testResult.success ? "text-emerald-700" : "text-red-700"}`}>
                {testResult.success ? "Test Riuscito" : "Errore nel Test"}
              </p>
              <p className="text-sm mt-1">
                {testResult.success
                  ? typeof testResult.value === "object"
                    ? JSON.stringify(testResult.value)
                    : testResult.value
                  : testResult.error}
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Annulla
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={!metric.dslExpression.trim() || testMutation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            {testMutation.isPending ? "Test in corso..." : "Testa Formula"}
          </Button>
        </div>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="h-4 w-4 mr-2" />
          Salva Metrica
        </Button>
      </CardFooter>
    </Card>
  );
}
