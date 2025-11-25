import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Clock, 
  Play, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Globe, 
  Lock,
  Tag,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { type ExerciseTemplate } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";
import { useState } from "react";

interface TemplateCardProps {
  template: ExerciseTemplate;
  onUse?: (templateId: string) => void;
  onEdit?: (template: ExerciseTemplate) => void;
  onDelete?: (templateId: string) => void;
  onView?: (template: ExerciseTemplate) => void;
  showActions?: boolean;
  isOwner?: boolean;
}

export default function TemplateCard({ 
  template, 
  onUse, 
  onEdit, 
  onDelete, 
  onView,
  showActions = true,
  isOwner = false 
}: TemplateCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const getCategoryIcon = () => {
    switch (template.category.toLowerCase()) {
      case "strength":
        return "🏋️";
      case "cardio":
        return "🏃";
      case "nutrition":
        return "🥗";
      case "flexibility":
        return "🧘";
      case "wellness":
        return "🧠";
      case "rehabilitation":
        return "🩹";
      default:
        return "📝";
    }
  };

  const getTypeBadge = () => {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          template.type === "personalized" 
            ? "bg-accent/10 text-accent border-accent/20"
            : "bg-primary/10 text-primary border-primary/20"
        )}
      >
        {template.type === "personalized" ? "Personalizzato" : "Generale"}
      </Badge>
    );
  };

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 hover:-translate-y-1 h-full"
      data-testid={`card-template-${template.id}`}
    >
      <CardContent className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3 flex-1">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
              {getCategoryIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-1" data-testid={`text-template-name-${template.id}`}>
                {template.name}
              </h4>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2" data-testid={`text-template-description-${template.id}`}>
                {template.description}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
            {template.isPublic ? (
              <Badge variant="secondary" className="text-xs">
                <Globe size={10} className="mr-1" />
                Pubblico
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Lock size={10} className="mr-1" />
                Privato
              </Badge>
            )}
          </div>
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs bg-muted/50"
                  data-testid={`badge-tag-${template.id}-${index}`}
                >
                  <Tag size={8} className="mr-1" />
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="outline" className="text-xs bg-muted/50">
                  +{template.tags.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Type Badge */}
        <div className="mb-3">
          {getTypeBadge()}
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 flex-1">
          <div className="flex items-center space-x-4">
            {template.estimatedDuration && (
              <span className="flex items-center space-x-1">
                <Clock size={12} />
                <span>{template.estimatedDuration} min</span>
              </span>
            )}
            <span className="flex items-center space-x-1" data-testid={`text-usage-count-${template.id}`}>
              <TrendingUp size={12} />
              <span>{template.usageCount} usi</span>
            </span>
          </div>
          <span className="flex items-center space-x-1" data-testid={`text-created-date-${template.id}`}>
            <Calendar size={12} />
            <span>
              {template.createdAt 
                ? formatDistanceToNow(new Date(template.createdAt), { 
                    addSuffix: true, 
                    locale: it 
                  })
                : "N/A"
              }
            </span>
          </span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="space-y-2 mt-auto">
            <div className="flex items-center justify-between space-x-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => onUse?.(template.id)}
                data-testid={`button-use-${template.id}`}
              >
                <Copy size={14} className="mr-1" />
                Crea e Assegna Esercizio
              </Button>

              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onView?.(template)}
                  data-testid={`button-view-${template.id}`}
                >
                  <Eye size={14} />
                </Button>

                {isOwner && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit?.(template)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit3 size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteDialog(true);
                      }}
                      data-testid={`button-delete-${template.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Template</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il template "{template.name}"? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsDeleting(true);
                try {
                  await onDelete?.(template.id);
                  setShowDeleteDialog(false);
                } catch (error) {
                  console.error('Error deleting template:', error);
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 size={16} className="mr-2" />
              {isDeleting ? 'Eliminazione...' : 'Elimina Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}