import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import {
  Target,
  MapPin,
  Gem,
  Star,
  Construction,
  Flame,
  Edit,
  Calendar,
  Loader2,
  Sparkles,
  History,
  Activity,
  Telescope,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientState {
  id: string;
  clientId: string;
  consultantId: string;
  currentState: string;
  idealState: string;
  internalBenefit: string | null;
  externalBenefit: string | null;
  mainObstacle: string | null;
  pastAttempts: string | null;
  currentActions: string | null;
  futureVision: string | null;
  motivationDrivers: string | null;
  lastUpdated: string;
  createdAt: string;
}

interface ClientStateDashboardProps {
  clientId: string;
  consultantId: string;
  readonly?: boolean;
}

export default function ClientStateDashboard({ clientId, consultantId, readonly = false }: ClientStateDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(!readonly); // Parte chiuso se readonly (cliente), aperto se consultant

  // Form state
  const [formData, setFormData] = useState({
    currentState: "",
    idealState: "",
    internalBenefit: "",
    externalBenefit: "",
    mainObstacle: "",
    pastAttempts: "",
    currentActions: "",
    futureVision: "",
    motivationDrivers: "",
  });

  // Fetch client state
  const { data: clientState, isLoading } = useQuery<ClientState>({
    queryKey: ["/api/clients/state", clientId, consultantId],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/state`, {
        headers: getAuthHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch client state");
      }

      const result = await response.json();
      return result.data || result;
    },
  });

  // Update client state mutation
  const updateStateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/clients/${clientId}/state`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update client state");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/state"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Stato aggiornato",
        description: "Lo stato del cliente è stato aggiornato con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // AI generate client state mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/state/ai-generate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate client state with AI");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/state"] });
      toast({
        title: "Analisi AI completata",
        description: "Lo stato del cliente è stato generato automaticamente dall'AI usando il contesto completo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore AI",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleOpenEditDialog = () => {
    if (clientState) {
      setFormData({
        currentState: clientState.currentState,
        idealState: clientState.idealState,
        internalBenefit: clientState.internalBenefit || "",
        externalBenefit: clientState.externalBenefit || "",
        mainObstacle: clientState.mainObstacle || "",
        pastAttempts: clientState.pastAttempts || "",
        currentActions: clientState.currentActions || "",
        futureVision: clientState.futureVision || "",
        motivationDrivers: clientState.motivationDrivers || "",
      });
    } else {
      setFormData({
        currentState: "",
        idealState: "",
        internalBenefit: "",
        externalBenefit: "",
        mainObstacle: "",
        pastAttempts: "",
        currentActions: "",
        futureVision: "",
        motivationDrivers: "",
      });
    }
    setIsEditDialogOpen(true);
  };

  const handleUpdateState = () => {
    if (!formData.currentState.trim() || !formData.idealState.trim()) {
      toast({
        title: "Errore",
        description: "Stato attuale e stato ideale sono obbligatori",
        variant: "destructive",
      });
      return;
    }
    updateStateMutation.mutate(formData);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!clientState) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Stato Cliente
              </CardTitle>
              <CardDescription>Traccia lo stato attuale e gli obiettivi del cliente</CardDescription>
            </div>
            {!readonly && (
              <div className="flex gap-2">
                <Button onClick={() => aiGenerateMutation.mutate()} variant="default" className="gap-2" disabled={aiGenerateMutation.isPending}>
                  {aiGenerateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analisi AI in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Genera con AI
                    </>
                  )}
                </Button>
                <Button onClick={handleOpenEditDialog} variant="outline" className="gap-2">
                  <Edit className="w-4 h-4" />
                  Configura Manualmente
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nessuno stato configurato</h3>
          <p className="text-muted-foreground mb-6">
            {readonly
              ? "Il consulente non ha ancora configurato lo stato per questo cliente"
              : "Configura lo stato del cliente per iniziare a tracciare i progressi"}
          </p>
          {!readonly && (
            <Button onClick={handleOpenEditDialog} className="gap-2">
              <Edit className="w-4 h-4" />
              Configura Ora
            </Button>
          )}
        </CardContent>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configura Stato Cliente</DialogTitle>
              <DialogDescription>
                Definisci lo stato attuale, gli obiettivi e la motivazione del cliente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Current State */}
              <div className="space-y-2">
                <Label htmlFor="currentState" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Stato Attuale *
                </Label>
                <Textarea
                  id="currentState"
                  placeholder="Descrivi la situazione attuale del cliente..."
                  value={formData.currentState}
                  onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Ideal State */}
              <div className="space-y-2">
                <Label htmlFor="idealState" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Stato Ideale *
                </Label>
                <Textarea
                  id="idealState"
                  placeholder="Descrivi dove il cliente vuole arrivare..."
                  value={formData.idealState}
                  onChange={(e) => setFormData({ ...formData, idealState: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Internal Benefit */}
              <div className="space-y-2">
                <Label htmlFor="internalBenefit" className="flex items-center gap-2">
                  <Gem className="w-4 h-4" />
                  Beneficio Interno
                </Label>
                <Textarea
                  id="internalBenefit"
                  placeholder="Benefici personali e interni per il cliente..."
                  value={formData.internalBenefit}
                  onChange={(e) => setFormData({ ...formData, internalBenefit: e.target.value })}
                  rows={2}
                />
              </div>

              {/* External Benefit */}
              <div className="space-y-2">
                <Label htmlFor="externalBenefit" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Beneficio Esterno
                </Label>
                <Textarea
                  id="externalBenefit"
                  placeholder="Benefici esterni e visibili per il cliente..."
                  value={formData.externalBenefit}
                  onChange={(e) => setFormData({ ...formData, externalBenefit: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Main Obstacle */}
              <div className="space-y-2">
                <Label htmlFor="mainObstacle" className="flex items-center gap-2">
                  <Construction className="w-4 h-4" />
                  Ostacolo Principale
                </Label>
                <Textarea
                  id="mainObstacle"
                  placeholder="Principale ostacolo che impedisce al cliente di progredire..."
                  value={formData.mainObstacle}
                  onChange={(e) => setFormData({ ...formData, mainObstacle: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Past Attempts */}
              <div className="space-y-2">
                <Label htmlFor="pastAttempts" className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Cosa ha già provato in passato
                </Label>
                <Textarea
                  id="pastAttempts"
                  placeholder="Cosa ha già tentato il cliente in passato..."
                  value={formData.pastAttempts}
                  onChange={(e) => setFormData({ ...formData, pastAttempts: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Current Actions */}
              <div className="space-y-2">
                <Label htmlFor="currentActions" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Cosa sta facendo adesso
                </Label>
                <Textarea
                  id="currentActions"
                  placeholder="Cosa sta facendo attualmente il cliente..."
                  value={formData.currentActions}
                  onChange={(e) => setFormData({ ...formData, currentActions: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Future Vision */}
              <div className="space-y-2">
                <Label htmlFor="futureVision" className="flex items-center gap-2">
                  <Telescope className="w-4 h-4" />
                  Dove vuole essere tra 3-5 anni
                </Label>
                <Textarea
                  id="futureVision"
                  placeholder="Dove il cliente vuole essere tra 3-5 anni..."
                  value={formData.futureVision}
                  onChange={(e) => setFormData({ ...formData, futureVision: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Motivation Drivers */}
              <div className="space-y-2">
                <Label htmlFor="motivationDrivers" className="flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  Cosa la motiva a raggiungere i risultati
                </Label>
                <Textarea
                  id="motivationDrivers"
                  placeholder="Descrivi cosa motiva il cliente..."
                  value={formData.motivationDrivers}
                  onChange={(e) => setFormData({ ...formData, motivationDrivers: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleUpdateState} disabled={updateStateMutation.isPending}>
                {updateStateMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // Display state
  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto hover:bg-transparent w-full justify-start">
                    <div className="flex items-center gap-2 w-full">
                      <Target className="w-5 h-5" />
                      <CardTitle className="flex items-center gap-2">
                        Stato Cliente
                      </CardTitle>
                      {isOpen ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="w-3 h-3" />
                  Ultimo aggiornamento: {format(new Date(clientState.lastUpdated), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
                </CardDescription>
              </div>
              {!readonly && (
                <div className="flex gap-2">
                  <Button onClick={() => aiGenerateMutation.mutate()} variant="default" className="gap-2" disabled={aiGenerateMutation.isPending}>
                    {aiGenerateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Aggiornamento...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Aggiorna con AI
                      </>
                    )}
                  </Button>
                  <Button onClick={handleOpenEditDialog} variant="outline" className="gap-2">
                    <Edit className="w-4 h-4" />
                    Modifica
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Current State */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="w-4 h-4 text-blue-500" />
                Stato Attuale
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{clientState.currentState}</p>
              </div>
            </div>

            {/* Ideal State */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="w-4 h-4 text-green-500" />
                Stato Ideale
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{clientState.idealState}</p>
              </div>
            </div>

            {/* Internal Benefit */}
            {clientState.internalBenefit && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Gem className="w-4 h-4 text-purple-500" />
                  Beneficio Interno
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{clientState.internalBenefit}</p>
                </div>
              </div>
            )}

            {/* External Benefit */}
            {clientState.externalBenefit && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Beneficio Esterno
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{clientState.externalBenefit}</p>
                </div>
              </div>
            )}

            {/* Main Obstacle */}
            {clientState.mainObstacle && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Construction className="w-4 h-4 text-orange-500" />
                  Ostacolo Principale
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{clientState.mainObstacle}</p>
                </div>
              </div>
            )}

            {/* Past Attempts - SEMPRE VISIBILE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History className="w-4 h-4 text-indigo-500" />
                Cosa ha già provato in passato
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{clientState.pastAttempts || 'Non ancora specificato'}</p>
              </div>
            </div>

            {/* Current Actions - SEMPRE VISIBILE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="w-4 h-4 text-teal-500" />
                Cosa sta facendo adesso
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{clientState.currentActions || 'Non ancora specificato'}</p>
              </div>
            </div>

            {/* Future Vision - SEMPRE VISIBILE */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Telescope className="w-4 h-4 text-pink-500" />
                Dove vuole essere tra 3-5 anni
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{clientState.futureVision || 'Non ancora specificato'}</p>
              </div>
            </div>

            {/* Motivation Drivers */}
            {clientState.motivationDrivers && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Flame className="w-4 h-4 text-red-500" />
                  Cosa la motiva a raggiungere i risultati
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{clientState.motivationDrivers}</p>
                </div>
              </div>
            )}
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Stato Cliente</DialogTitle>
            <DialogDescription>
              Aggiorna lo stato attuale, gli obiettivi e la motivazione del cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current State */}
            <div className="space-y-2">
              <Label htmlFor="edit-currentState" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Stato Attuale *
              </Label>
              <Textarea
                id="edit-currentState"
                placeholder="Descrivi la situazione attuale del cliente..."
                value={formData.currentState}
                onChange={(e) => setFormData({ ...formData, currentState: e.target.value })}
                rows={3}
              />
            </div>

            {/* Ideal State */}
            <div className="space-y-2">
              <Label htmlFor="edit-idealState" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Stato Ideale *
              </Label>
              <Textarea
                id="edit-idealState"
                placeholder="Descrivi dove il cliente vuole arrivare..."
                value={formData.idealState}
                onChange={(e) => setFormData({ ...formData, idealState: e.target.value })}
                rows={3}
              />
            </div>

            {/* Internal Benefit */}
            <div className="space-y-2">
              <Label htmlFor="edit-internalBenefit" className="flex items-center gap-2">
                <Gem className="w-4 h-4" />
                Beneficio Interno
              </Label>
              <Textarea
                id="edit-internalBenefit"
                placeholder="Benefici personali e interni per il cliente..."
                value={formData.internalBenefit}
                onChange={(e) => setFormData({ ...formData, internalBenefit: e.target.value })}
                rows={2}
              />
            </div>

            {/* External Benefit */}
            <div className="space-y-2">
              <Label htmlFor="edit-externalBenefit" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Beneficio Esterno
              </Label>
              <Textarea
                id="edit-externalBenefit"
                placeholder="Benefici esterni e visibili per il cliente..."
                value={formData.externalBenefit}
                onChange={(e) => setFormData({ ...formData, externalBenefit: e.target.value })}
                rows={2}
              />
            </div>

            {/* Main Obstacle */}
            <div className="space-y-2">
              <Label htmlFor="edit-mainObstacle" className="flex items-center gap-2">
                <Construction className="w-4 h-4" />
                Ostacolo Principale
              </Label>
              <Textarea
                id="edit-mainObstacle"
                placeholder="Principale ostacolo che impedisce al cliente di progredire..."
                value={formData.mainObstacle}
                onChange={(e) => setFormData({ ...formData, mainObstacle: e.target.value })}
                rows={2}
              />
            </div>

            {/* Past Attempts */}
            <div className="space-y-2">
              <Label htmlFor="edit-pastAttempts" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Cosa ha già provato in passato
              </Label>
              <Textarea
                id="edit-pastAttempts"
                placeholder="Cosa ha già tentato il cliente in passato..."
                value={formData.pastAttempts}
                onChange={(e) => setFormData({ ...formData, pastAttempts: e.target.value })}
                rows={2}
              />
            </div>

            {/* Current Actions */}
            <div className="space-y-2">
              <Label htmlFor="edit-currentActions" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Cosa sta facendo adesso
              </Label>
              <Textarea
                id="edit-currentActions"
                placeholder="Cosa sta facendo attualmente il cliente..."
                value={formData.currentActions}
                onChange={(e) => setFormData({ ...formData, currentActions: e.target.value })}
                rows={2}
              />
            </div>

            {/* Future Vision */}
            <div className="space-y-2">
              <Label htmlFor="edit-futureVision" className="flex items-center gap-2">
                <Telescope className="w-4 h-4" />
                Dove vuole essere tra 3-5 anni
              </Label>
              <Textarea
                id="edit-futureVision"
                placeholder="Dove il cliente vuole essere tra 3-5 anni..."
                value={formData.futureVision}
                onChange={(e) => setFormData({ ...formData, futureVision: e.target.value })}
                rows={2}
              />
            </div>

            {/* Motivation Drivers */}
            <div className="space-y-2">
              <Label htmlFor="edit-motivationDrivers" className="flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Cosa la motiva a raggiungere i risultati
              </Label>
              <Textarea
                id="edit-motivationDrivers"
                placeholder="Descrivi cosa motiva il cliente..."
                value={formData.motivationDrivers}
                onChange={(e) => setFormData({ ...formData, motivationDrivers: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleUpdateState} disabled={updateStateMutation.isPending}>
              {updateStateMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
