import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  Columns,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SemanticMapping {
  id: number;
  physicalColumn: string;
  logicalRole: string;
  confidence: number;
  status: "pending" | "confirmed" | "rejected";
  autoApproved: boolean;
  isCritical: boolean;
  displayName: string;
}

interface SemanticMappingResult {
  datasetId: number;
  analyticsEnabled: boolean;
  mappings: SemanticMapping[];
  pendingCritical: string[];
  missingRequired: string[];
}

interface SemanticMappingConfirmationProps {
  datasetId: number;
  onConfirmed?: () => void;
}

export function SemanticMappingConfirmation({
  datasetId,
  onConfirmed,
}: SemanticMappingConfirmationProps) {
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: SemanticMappingResult }>({
    queryKey: [`/api/client-data/datasets/${datasetId}/semantic-mappings`],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/datasets/${datasetId}/semantic-mappings`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error("Errore nel caricamento");
      return response.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (confirmations: Array<{ physicalColumn: string }>) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/client-data/datasets/${datasetId}/semantic-mappings/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ confirmations }),
      });
      if (!response.ok) throw new Error("Errore nella conferma");
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/client-data/datasets/${datasetId}/semantic-mappings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client-data/datasets`] });
      toast({
        title: "Mapping confermato",
        description: result.data.analyticsEnabled
          ? "Analytics abilitato! Ora puoi analizzare i tuoi dati."
          : `${result.data.confirmed} colonne confermate.`,
      });
      if (result.data.analyticsEnabled && onConfirmed) {
        onConfirmed();
      }
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile confermare il mapping. Riprova.",
        variant: "destructive",
      });
    },
  });

  const mappingResult = data?.data;
  const pendingMappings = mappingResult?.mappings.filter((m) => m.status === "pending" && m.isCritical) || [];
  const confirmedMappings = mappingResult?.mappings.filter((m) => m.status === "confirmed") || [];

  const toggleMapping = (physicalColumn: string) => {
    const newSelected = new Set(selectedMappings);
    if (newSelected.has(physicalColumn)) {
      newSelected.delete(physicalColumn);
    } else {
      newSelected.add(physicalColumn);
    }
    setSelectedMappings(newSelected);
  };

  const selectAll = () => {
    setSelectedMappings(new Set(pendingMappings.map((m) => m.physicalColumn)));
  };

  const handleConfirm = () => {
    if (selectedMappings.size === 0) return;
    const confirmations = Array.from(selectedMappings).map((physicalColumn) => ({ physicalColumn }));
    confirmMutation.mutate(confirmations);
  };

  const handleConfirmAll = () => {
    const confirmations = pendingMappings.map((m) => ({ physicalColumn: m.physicalColumn }));
    confirmMutation.mutate(confirmations);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500">Errore nel caricamento del mapping</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mappingResult?.analyticsEnabled && pendingMappings.length === 0) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Mapping confermato! Puoi analizzare i tuoi dati.
        </AlertDescription>
      </Alert>
    );
  }

  if (pendingMappings.length === 0 && mappingResult?.mappings.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nessuna colonna rilevata automaticamente. Carica un nuovo dataset con colonne standard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Columns className="h-5 w-5" />
              Conferma Mapping Colonne
            </CardTitle>
            <CardDescription className="mt-1">
              Conferma le colonne rilevate automaticamente per abilitare l'analisi
            </CardDescription>
          </div>
          {pendingMappings.length > 0 && (
            <Button onClick={handleConfirmAll} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Conferma Tutti
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {pendingMappings.length > 0 && (
          <div className="space-y-3">
            {pendingMappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedMappings.has(mapping.physicalColumn)}
                    onCheckedChange={() => toggleMapping(mapping.physicalColumn)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{mapping.physicalColumn}</span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <Badge variant="outline" className="bg-white">
                        {mapping.displayName}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Confidenza: {(mapping.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                  Da Confermare
                </Badge>
              </div>
            ))}

            {selectedMappings.size > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  size="lg"
                >
                  {confirmMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Conferma {selectedMappings.size} Selezionate
                </Button>
              </div>
            )}
          </div>
        )}

        {confirmedMappings.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Colonne Confermate</h4>
            <div className="flex flex-wrap gap-2">
              {confirmedMappings.map((mapping) => (
                <Badge key={mapping.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {mapping.physicalColumn} → {mapping.displayName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
