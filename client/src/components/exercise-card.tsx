import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Paperclip, Play, CheckCircle, Trophy, X, RefreshCcw } from "lucide-react";
import { type Exercise, type ExerciseAssignment } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ExerciseCardProps {
  exercise: Exercise;
  assignment?: ExerciseAssignment;
  onStart?: (exerciseId: string, assignmentId?: string) => void;
  showStatus?: boolean;
}

export default function ExerciseCard({ exercise, assignment, onStart, showStatus = true }: ExerciseCardProps) {
  const isCompleted = assignment?.status === 'completed';
  const isSubmitted = assignment?.status === 'submitted';
  const isPending = assignment?.status === 'pending';
  const isInProgress = assignment?.status === 'in_progress';
  const isRejected = assignment?.status === 'rejected';
  const isReturned = assignment?.status === 'returned';
  const isPersonalized = exercise.type === 'personalized';

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle size={20} />;
    if (isSubmitted) return <Clock size={20} />;
    if (isRejected) return <X size={20} />;
    if (isReturned) return <RefreshCcw size={20} />;
    return <Play size={20} />;
  };

  const getStatusBadge = () => {
    if (isCompleted) {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Completato</Badge>;
    }
    if (isPersonalized) {
      return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">Personalizzato</Badge>;
    }
    if (isSubmitted) {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Inviato</Badge>;
    }
    if (isRejected) {
      return (
        <Badge variant="destructive" className="text-xs">
          <X size={12} className="mr-1" />
          Respinto
        </Badge>
      );
    }
    if (isReturned) {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
          <RefreshCcw size={12} className="mr-1" />
          Da Correggere
        </Badge>
      );
    }
    return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Generale</Badge>;
  };

  const getCategoryIcon = () => {
    switch (exercise.category) {
      case "post-consulenza":
        return "📝";
      case "newsletter":
        return "📰";
      case "finanza-personale":
        return "💰";
      case "vendita":
        return "💼";
      case "marketing":
        return "📈";
      case "imprenditoria":
        return "🚀";
      case "risparmio-investimenti":
        return "💎";
      case "contabilità":
        return "📊";
      case "gestione-risorse":
        return "⚙️";
      case "strategia":
        return "🎯";
      default:
        return "💪";
    }
  };

  return (
    <Card
      className={cn(
        "hover:shadow-md transition-all duration-200 hover:-translate-y-1",
        isCompleted && "border-success/30 bg-success/5",
        isReturned && "border-orange-500/30 bg-orange-500/5"
      )}
      data-testid={`card-exercise-${exercise.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center text-xl",
              isCompleted ? "bg-success/20" : "bg-primary/10"
            )}>
              {getCategoryIcon()}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-foreground mb-1 break-words leading-tight" data-testid={`text-exercise-title-${exercise.id}`}>
                {exercise.title}
              </h4>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2" data-testid={`text-exercise-description-${exercise.id}`}>
                {exercise.description}
              </p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                {exercise.estimatedDuration && (
                  <span className="flex items-center space-x-1">
                    <Clock size={12} />
                    <span>{String(exercise.estimatedDuration)} min</span>
                  </span>
                )}
                {exercise.attachments && exercise.attachments.length > 0 && (
                  <span className="flex items-center space-x-1">
                    <Paperclip size={12} />
                    <span>{String(exercise.attachments.length)} allegat{exercise.attachments.length === 1 ? 'o' : 'i'}</span>
                  </span>
                )}
                {isCompleted && assignment?.completedAt && (
                  <span className="flex items-center space-x-1 text-success">
                    <CheckCircle size={12} />
                    <span>Completato {new Date(assignment.completedAt).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {showStatus && getStatusBadge()}
            {onStart && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStart(exercise.id, assignment?.id)}
                className={cn(
                  "p-2 rounded-full",
                  isCompleted ? "text-success hover:bg-success/10" : "text-primary hover:bg-primary/10"
                )}
                data-testid={`button-start-exercise-${exercise.id}`}
              >
                {getStatusIcon()}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}