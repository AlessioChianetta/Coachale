import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { ClientPriorityCard } from "./ClientPriorityCard";
import { ClientPriorityData } from "@/hooks/useClientPriorityScore";
import { useLocation } from "wouter";
import { useState } from "react";

interface ClientsNeedAttentionProps {
  highPriorityClients: ClientPriorityData[];
  mediumPriorityClients: ClientPriorityData[];
  lowPriorityClients: ClientPriorityData[];
  onRefresh?: () => void;
}

const ITEMS_PER_PAGE = 4;

export function ClientsNeedAttention({
  highPriorityClients = [],
  mediumPriorityClients = [],
  lowPriorityClients = [],
  onRefresh,
}: ClientsNeedAttentionProps) {
  const [, setLocation] = useLocation();
  const [highPriorityPage, setHighPriorityPage] = useState(1);
  const [mediumPriorityPage, setMediumPriorityPage] = useState(1);
  const [lowPriorityPage, setLowPriorityPage] = useState(1);

  const handleViewClientDetails = (clientId: string) => {
    setLocation(`/consultant/clients/${clientId}`);
  };

  const handleSendWhatsApp = (clientId: string) => {
    setLocation(`/consultant/whatsapp?clientId=${clientId}`);
  };

  const handleScheduleCall = (clientId: string) => {
    setLocation(`/consultant/appointments?clientId=${clientId}&action=schedule`);
  };

  const handleReviewExercise = (clientId: string) => {
    setLocation(`/consultant/exercises?clientId=${clientId}&filter=to-review`);
  };

  const totalClients = highPriorityClients.length + mediumPriorityClients.length + lowPriorityClients.length;

  if (totalClients === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Panoramica Clienti</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              Nessun cliente
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nessun cliente</h3>
            <p className="text-muted-foreground">
              Aggiungi clienti per iniziare a monitorare il loro progresso.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Panoramica Clienti per Priorità</span>
            <Badge 
              variant="outline" 
              className={
                highPriorityClients.length > 0
                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : mediumPriorityClients.length > 0
                  ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                  : "bg-green-500/10 text-green-600 border-green-500/20"
              }
            >
              {totalClients} {totalClients === 1 ? "Cliente" : "Clienti"}
            </Badge>
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          3 livelli di priorità basati su attività ed esercizi
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Alta Priorità */}
          {highPriorityClients.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <h3 className="text-sm font-semibold text-red-600">
                  🔴 Alta Priorità ({highPriorityClients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highPriorityClients
                  .slice((highPriorityPage - 1) * ITEMS_PER_PAGE, highPriorityPage * ITEMS_PER_PAGE)
                  .map((clientData) => (
                    <ClientPriorityCard
                      key={clientData.client.id}
                      data={clientData}
                      onViewDetails={() => handleViewClientDetails(clientData.client.id)}
                      onSendWhatsApp={() => handleSendWhatsApp(clientData.client.id)}
                      onScheduleCall={() => handleScheduleCall(clientData.client.id)}
                      onReviewExercise={() => handleReviewExercise(clientData.client.id)}
                    />
                  ))}
              </div>
              {highPriorityClients.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(highPriorityPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(highPriorityPage * ITEMS_PER_PAGE, highPriorityClients.length)} di {highPriorityClients.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHighPriorityPage(prev => Math.max(1, prev - 1))}
                      disabled={highPriorityPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHighPriorityPage(prev => Math.min(Math.ceil(highPriorityClients.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={highPriorityPage === Math.ceil(highPriorityClients.length / ITEMS_PER_PAGE)}
                    >
                      Successivo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media Priorità */}
          {mediumPriorityClients.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <h3 className="text-sm font-semibold text-yellow-600">
                  🟡 Media Priorità ({mediumPriorityClients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mediumPriorityClients
                  .slice((mediumPriorityPage - 1) * ITEMS_PER_PAGE, mediumPriorityPage * ITEMS_PER_PAGE)
                  .map((clientData) => (
                    <ClientPriorityCard
                      key={clientData.client.id}
                      data={clientData}
                      onViewDetails={() => handleViewClientDetails(clientData.client.id)}
                      onSendWhatsApp={() => handleSendWhatsApp(clientData.client.id)}
                      onScheduleCall={() => handleScheduleCall(clientData.client.id)}
                      onReviewExercise={() => handleReviewExercise(clientData.client.id)}
                    />
                  ))}
              </div>
              {mediumPriorityClients.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(mediumPriorityPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(mediumPriorityPage * ITEMS_PER_PAGE, mediumPriorityClients.length)} di {mediumPriorityClients.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMediumPriorityPage(prev => Math.max(1, prev - 1))}
                      disabled={mediumPriorityPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMediumPriorityPage(prev => Math.min(Math.ceil(mediumPriorityClients.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={mediumPriorityPage === Math.ceil(mediumPriorityClients.length / ITEMS_PER_PAGE)}
                    >
                      Successivo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bassa Priorità */}
          {lowPriorityClients.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <h3 className="text-sm font-semibold text-green-600">
                  🟢 Bassa Priorità ({lowPriorityClients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lowPriorityClients
                  .slice((lowPriorityPage - 1) * ITEMS_PER_PAGE, lowPriorityPage * ITEMS_PER_PAGE)
                  .map((clientData) => (
                    <ClientPriorityCard
                      key={clientData.client.id}
                      data={clientData}
                      onViewDetails={() => handleViewClientDetails(clientData.client.id)}
                      onSendWhatsApp={() => handleSendWhatsApp(clientData.client.id)}
                      onScheduleCall={() => handleScheduleCall(clientData.client.id)}
                      onReviewExercise={() => handleReviewExercise(clientData.client.id)}
                    />
                  ))}
              </div>
              {lowPriorityClients.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(lowPriorityPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(lowPriorityPage * ITEMS_PER_PAGE, lowPriorityClients.length)} di {lowPriorityClients.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLowPriorityPage(prev => Math.max(1, prev - 1))}
                      disabled={lowPriorityPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLowPriorityPage(prev => Math.min(Math.ceil(lowPriorityClients.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={lowPriorityPage === Math.ceil(lowPriorityClients.length / ITEMS_PER_PAGE)}
                    >
                      Successivo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
