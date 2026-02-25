import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Github, ExternalLink, User, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface SkillDetailModalProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string) => void;
}

export function SkillDetailModal({ skill, open, onOpenChange, onToggle }: SkillDetailModalProps) {
  if (!skill) return null;

  const repoUrl = skill.metadata?.repoUrl;
  const fileList = skill.metadata?.fileList || [];
  const author = skill.metadata?.author;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">{skill.displayTitle || skill.name}</DialogTitle>
          </div>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 py-2">
          <Badge variant="outline" className="gap-1">
            {skill.source === "custom" ? <User className="h-3 w-3" /> : <Github className="h-3 w-3" />}
            {skill.source === "github_official" ? "Official" : skill.source === "github_community" ? "Community" : "Custom"}
          </Badge>
          {skill.category && (
            <Badge variant="secondary">{skill.category.replace(/_/g, " ")}</Badge>
          )}
          {author && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> {author}
            </span>
          )}
          {skill.createdAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(skill.createdAt).toLocaleDateString("it-IT")}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between py-2 border-y border-border/50">
          <span className="text-sm font-medium">Skill attiva</span>
          <Switch checked={skill.isActive} onCheckedChange={() => onToggle(skill.id)} />
        </div>

        <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto rounded-lg border border-border/50 bg-muted/30">
          <div className="p-4">
            <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-foreground/90 m-0">
{skill.content}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {fileList.length > 0 && (
            <span className="text-xs text-muted-foreground">{fileList.length} file associati</span>
          )}
          {repoUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Apri su GitHub
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
