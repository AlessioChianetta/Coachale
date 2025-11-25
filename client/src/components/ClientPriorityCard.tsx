import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  MessageCircle,
  Phone,
  TrendingUp,
  Eye,
  Flame,
} from "lucide-react";
import { ClientPriorityData } from "@/hooks/useClientPriorityScore";
import { cn } from "@/lib/utils";

interface ClientPriorityCardProps {
  data: ClientPriorityData;
  onViewDetails?: () => void;
  onSendWhatsApp?: () => void;
  onScheduleCall?: () => void;
  onReviewExercise?: () => void;
}

export function ClientPriorityCard({
  data,
  onViewDetails,
  onSendWhatsApp,
  onScheduleCall,
  onReviewExercise,
}: ClientPriorityCardProps) {
  const {
    client,
    priorityLevel,
    priorityScore,
    inactiveDays,
    exercisesToReview,
    emailJourneyPending,
    isOnline,
    momentumStreak,
    lastActivity,
    reasons,
  } = data;

  const getBadgeColor = () => {
    switch (priorityLevel) {
      case "critical":
        return "bg-red-500 text-white hover:bg-red-600";
      case "high":
        return "bg-yellow-500 text-white hover:bg-yellow-600";
      case "medium":
        return "bg-blue-500 text-white hover:bg-blue-600";
      default:
        return "bg-green-500 text-white hover:bg-green-600";
    }
  };

  const getPriorityIcon = () => {
    switch (priorityLevel) {
      case "critical":
        return <AlertCircle className="w-4 h-4" />;
      case "high":
        return <Clock className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getPriorityText = () => {
    switch (priorityLevel) {
      case "critical":
        return "Critico";
      case "high":
        return "Alta Priorità";
      case "medium":
        return "Media Priorità";
      default:
        return "Bassa Priorità";
    }
  };

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-lg",
        priorityLevel === "critical" && "border-red-500 border-2",
        priorityLevel === "high" && "border-yellow-500"
      )}
    >
      <CardContent className="p-4">
        {/* Header with Client Info */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-11 h-11">
                <AvatarImage src={client.avatar || undefined} />
                <AvatarFallback>
                  {client.firstName[0]}
                  {client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {client.firstName} {client.lastName}
              </h3>
              <p className="text-sm text-muted-foreground">{client.email}</p>
            </div>
          </div>
          <Badge className={getBadgeColor()}>
            <span className="flex items-center space-x-1">
              {getPriorityIcon()}
              <span>{getPriorityText()}</span>
            </span>
          </Badge>
        </div>

        {/* Reasons for Attention */}
        {reasons.length > 0 && (
          <div className="mb-3 p-2.5 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1.5">Richiede attenzione:</p>
            <ul className="space-y-1">
              {reasons.map((reason, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Ultimo accesso</p>
            <p className="text-sm font-semibold">
              {inactiveDays === 0
                ? "Oggi"
                : inactiveDays === 1
                ? "Ieri"
                : `${inactiveDays}g fa`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Da validare</p>
            <p className="text-sm font-semibold">{exercisesToReview}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Email actions</p>
            <p className="text-sm font-semibold">{emailJourneyPending}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Momentum</p>
            <p className="text-sm font-semibold flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-500 mr-1" />
              {momentumStreak}d
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {exercisesToReview > 0 && onReviewExercise && (
            <Button size="sm" onClick={onReviewExercise}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Valida Esercizi
            </Button>
          )}
          {onSendWhatsApp && (
            <Button size="sm" variant="outline" onClick={onSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-1" />
              WhatsApp
            </Button>
          )}
          {onScheduleCall && (
            <Button size="sm" variant="outline" onClick={onScheduleCall}>
              <Phone className="w-4 h-4 mr-1" />
              Pianifica Call
            </Button>
          )}
          {onViewDetails && (
            <Button size="sm" variant="ghost" onClick={onViewDetails}>
              <Eye className="w-4 h-4 mr-1" />
              Dettagli
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
