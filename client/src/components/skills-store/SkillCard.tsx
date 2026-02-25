import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Pencil, Github, User, Sparkles } from "lucide-react";

interface Skill {
  id: string;
  skillId: string;
  name: string;
  displayTitle: string;
  description: string;
  source: string;
  category: string;
  content: string;
  isActive: boolean;
  metadata: any;
  createdAt: string;
}

interface SkillCardProps {
  skill: Skill;
  onToggle: (id: string) => void;
  onDetail: (skill: Skill) => void;
  onEdit?: (skill: Skill) => void;
  onDelete: (id: string) => void;
  isToggling?: boolean;
}

const sourceConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  github_official: {
    label: "Official",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: <Github className="h-3 w-3" />,
  },
  github_community: {
    label: "Community",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: <Github className="h-3 w-3" />,
  },
  custom: {
    label: "Custom",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: <User className="h-3 w-3" />,
  },
};

const categoryColors: Record<string, string> = {
  development: "bg-green-500/10 text-green-400 border-green-500/20",
  creative: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  document_processing: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  communication: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  meta: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  branding: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  general: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  custom: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export function SkillCard({ skill, onToggle, onDetail, onEdit, onDelete, isToggling }: SkillCardProps) {
  const source = sourceConfig[skill.source] || sourceConfig.custom;
  const catColor = categoryColors[skill.category] || categoryColors.general;

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-sm truncate">{skill.displayTitle || skill.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
          </div>
          <Switch
            checked={skill.isActive}
            onCheckedChange={() => onToggle(skill.id)}
            disabled={isToggling}
            className="shrink-0"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${source.color}`}>
            {source.icon}
            {source.label}
          </Badge>
          {skill.category && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${catColor}`}>
              {skill.category.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDetail(skill)} title="Dettaglio">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {skill.source === "custom" && onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(skill)} title="Modifica">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(skill.id)} title="Elimina">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {skill.metadata?.author && (
            <span className="text-[10px] text-muted-foreground">by {skill.metadata.author}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
