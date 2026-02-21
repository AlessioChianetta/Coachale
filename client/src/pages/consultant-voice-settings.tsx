import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Save,
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface VoiceNumber {
  id: string;
  phone_number: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ConsultantVoiceSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<VoiceNumber | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedNumber) {
      setIsActive(selectedNumber.is_active ?? true);
    } else if (isCreating) {
      setIsActive(true);
    }
  }, [selectedNumber, isCreating]);

  const { data: numbersData, isLoading: loadingNumbers } = useQuery({
    queryKey: ["/api/voice/numbers"],
    queryFn: async () => {
      const res = await fetch("/api/voice/numbers", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento numeri");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<VoiceNumber> & { id?: string }) => {
      const url = data.id ? `/api/voice/numbers/${data.id}` : "/api/voice/numbers";
      const method = data.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Numero configurato con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/numbers"] });
      setSelectedNumber(null);
      setIsCreating(false);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voice/numbers/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Eliminato", description: "Numero rimosso" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/numbers"] });
      setSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const numbers: VoiceNumber[] = numbersData?.numbers || [];

  const handleSave = (formData: FormData) => {
    const data: Partial<VoiceNumber> = {
      phone_number: formData.get("phone_number") as string,
      display_name: formData.get("display_name") as string || null,
      is_active: isActive,
    };

    if (selectedNumber?.id) {
      saveMutation.mutate({ ...data, id: selectedNumber.id });
    } else {
      saveMutation.mutate(data);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-6 lg:px-8 overflow-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Link href="/consultant/voice-calls">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Phone className="h-8 w-8" />
                  I Miei Numeri
                </h1>
                <p className="text-muted-foreground mt-1">
                  Collega un numero telefonico per ricevere chiamate AI
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Numeri Configurati</h2>
              <Button onClick={() => { setIsCreating(true); setSelectedNumber(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Numero
              </Button>
            </div>

            {loadingNumbers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : numbers.length === 0 && !isCreating ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nessun numero configurato</h3>
                  <p className="text-muted-foreground mb-4">
                    Aggiungi il tuo numero per iniziare a ricevere chiamate AI
                  </p>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Configura Primo Numero
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {numbers.map((num) => (
                  <Card
                    key={num.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${
                      selectedNumber?.id === num.id ? "border-primary" : ""
                    }`}
                    onClick={() => { setSelectedNumber(num); setIsCreating(false); }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-lg font-medium">{num.phone_number}</div>
                          {num.display_name && (
                            <div className="text-sm text-muted-foreground">{num.display_name}</div>
                          )}
                        </div>
                        <Badge variant={num.is_active ? "default" : "secondary"}>
                          {num.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {(selectedNumber || isCreating) && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isCreating ? "Nuovo Numero" : "Modifica Numero"}
                  </CardTitle>
                  <CardDescription>
                    {isCreating
                      ? "Inserisci il numero telefonico da collegare al servizio Voice AI"
                      : "Modifica le impostazioni del numero"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSave(new FormData(e.currentTarget));
                    }}
                    className="space-y-6"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone_number">Numero Telefono *</Label>
                        <Input
                          id="phone_number"
                          name="phone_number"
                          placeholder="+39..."
                          defaultValue={selectedNumber?.phone_number || ""}
                          required
                          disabled={!!selectedNumber?.id}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="display_name">Nome Visualizzato</Label>
                        <Input
                          id="display_name"
                          name="display_name"
                          placeholder="Es: Linea Principale"
                          defaultValue={selectedNumber?.display_name || ""}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Switch
                        id="is_active"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <Label htmlFor="is_active">Numero Attivo</Label>
                    </div>

                    <div className="flex justify-between pt-4">
                      <div>
                        {selectedNumber?.id && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(selectedNumber.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Elimina
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setSelectedNumber(null); setIsCreating(false); }}
                        >
                          Annulla
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Salva
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
