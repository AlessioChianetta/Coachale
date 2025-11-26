import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Star, Flame, TrendingUp, Eye } from "lucide-react";
import { ClientPriorityData } from "@/hooks/useClientPriorityScore";
import { useLocation } from "wouter";

interface TopPerformersProps {
  topPerformers: ClientPriorityData[];
}

export function TopPerformers({ topPerformers }: TopPerformersProps) {
  const [, setLocation] = useLocation();

  const handleViewClient = (clientId: string) => {
    setLocation(`/consultant/clients/${clientId}`);
  };

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-orange-600" />;
      default:
        return <Star className="w-5 h-5 text-blue-500" />;
    }
  };

  const getMedalBadge = (index: number) => {
    if (index === 0) return "🥇 1°";
    if (index === 1) return "🥈 2°";
    if (index === 2) return "🥉 3°";
    return `${index + 1}°`;
  };

  if (topPerformers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>Classifica Clienti Attivi</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Nessun cliente attivo al momento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span>Classifica Clienti Attivi</span>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            {topPerformers.length} {topPerformers.length === 1 ? "Cliente" : "Clienti"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ordinati per performance: completamenti, momentum e attività
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topPerformers.map((clientData, index) => (
            <div
              key={clientData.client.id}
              className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:border-yellow-500/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-center space-x-4">
                {/* Position Badge */}
                <div className="flex items-center justify-center w-10">
                  {getMedalIcon(index)}
                </div>

                {/* Avatar with Online Indicator */}
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={clientData.client.avatar || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
                      {clientData.client.firstName[0]}
                      {clientData.client.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  {clientData.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                  )}
                </div>

                {/* Client Info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold">
                      {clientData.client.firstName} {clientData.client.lastName}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {getMedalBadge(index)}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>{clientData.momentumStreak} giorni streak</span>
                    </div>
                    {clientData.exercisesToReview > 0 && (
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span>{clientData.exercisesToReview} completati</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="hidden md:flex items-center space-x-6 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Momentum</p>
                    <p className="text-lg font-bold text-orange-500">
                      {clientData.momentumStreak}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completati</p>
                    <p className="text-lg font-bold text-green-500">
                      {clientData.exercisesToReview}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg font-bold text-blue-500">
                      {clientData.pendingExercises}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewClient(clientData.client.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="w-4 h-4 mr-1" />
                Dettagli
              </Button>
            </div>
          ))}
        </div>

        {topPerformers.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
            <p className="text-sm text-center text-muted-foreground">
              🎉 Continua così! Celebra i successi dei tuoi top performers
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
