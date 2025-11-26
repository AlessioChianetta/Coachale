import { format } from "date-fns";
import it from "date-fns/locale/it";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Heart, Trophy, TrendingUp, Calendar as CalendarIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReflection } from "@shared/schema";

interface ReflectionHistoryProps {
  clients: Array<{ id: string; firstName: string; lastName: string }>;
  reflections: DailyReflection[];
  selectedClientId?: string;
  onClientChange: (clientId: string) => void;
}

export default function ReflectionHistory({
  clients,
  reflections,
  selectedClientId,
  onClientChange,
}: ReflectionHistoryProps) {
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredReflections = selectedClientId
    ? reflections
        .filter(r => r.clientId === selectedClientId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950 dark:via-pink-950 dark:to-orange-950">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-md">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Riflessioni Cliente
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Visualizza le riflessioni giornaliere
              </p>
            </div>
          </div>

          <Select value={selectedClientId || ""} onValueChange={onClientChange}>
            <SelectTrigger className="w-full md:w-[250px] border-2 hover:border-purple-400 transition-colors">
              <SelectValue placeholder="Seleziona cliente">
                {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : "Seleziona cliente"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClientId && filteredReflections.length > 0 && (
            <Badge className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 px-3 py-1.5 w-fit">
              ✨ {filteredReflections.length} riflessioni
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!selectedClientId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-full mb-4">
              <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Seleziona un cliente</h3>
            <p className="text-muted-foreground">Scegli un cliente dal menu sopra per visualizzare le sue riflessioni</p>
          </div>
        ) : filteredReflections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900 rounded-full mb-4">
              <MessageSquare className="h-12 w-12 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nessuna riflessione</h3>
            <p className="text-muted-foreground">Questo cliente non ha ancora salvato riflessioni giornaliere</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredReflections.map(reflection => (
              <div
                key={reflection.id}
                className="border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-200 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg capitalize">
                        {format(new Date(reflection.date), "EEEE d MMMM yyyy", { locale: it })}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Compilata alle {reflection.createdAt ? format(new Date(reflection.createdAt), "HH:mm", { locale: it }) : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {reflection.grateful && reflection.grateful.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
                          <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                        </div>
                        <p className="font-semibold text-base">
                          Cose di cui è grato
                        </p>
                      </div>
                      <div className="pl-11 space-y-2">
                        {reflection.grateful.map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white font-semibold text-xs flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-sm flex-1 pt-0.5">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reflection.makeGreat && reflection.makeGreat.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                          <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <p className="font-semibold text-base">
                          Cosa renderebbe oggi grandioso
                        </p>
                      </div>
                      <div className="pl-11 space-y-2">
                        {reflection.makeGreat.map((item, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 text-white font-semibold text-xs flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-sm flex-1 pt-0.5">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reflection.doBetter && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="font-semibold text-base">
                          Cosa può fare meglio
                        </p>
                      </div>
                      <div className="pl-11">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
                          <p className="text-sm leading-relaxed">
                            {reflection.doBetter}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
