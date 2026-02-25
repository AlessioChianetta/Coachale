import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

interface SkillCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; displayTitle: string; description: string; category: string; content: string }) => void;
  editingSkill?: Skill | null;
  isSubmitting?: boolean;
}

export function SkillCreateModal({ open, onOpenChange, onSubmit, editingSkill, isSubmitting }: SkillCreateModalProps) {
  const [name, setName] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (editingSkill) {
      setName(editingSkill.name || "");
      setDisplayTitle(editingSkill.displayTitle || "");
      setDescription(editingSkill.description || "");
      setCategory(editingSkill.category || "");
      setContent(editingSkill.content || "");
    } else {
      setName("");
      setDisplayTitle("");
      setDescription("");
      setCategory("custom");
      setContent("");
    }
  }, [editingSkill, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, displayTitle: displayTitle || name, description, category: category || "custom", content });
  };

  const isValid = name.trim() && description.trim() && content.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSkill ? "Modifica Skill" : "Crea Skill Personalizzata"}</DialogTitle>
          <DialogDescription>
            {editingSkill ? "Modifica i dettagli della skill." : "Crea una nuova skill personalizzata con il tuo contenuto markdown."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Nome *</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Analisi Dati Avanzata"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-title">Titolo Display</Label>
            <Input
              id="skill-title"
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              placeholder="Titolo visibile nel marketplace (opzionale)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-desc">Descrizione *</Label>
            <Textarea
              id="skill-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione di cosa fa questa skill..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-cat">Categoria</Label>
            <Input
              id="skill-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="es. analytics, development, marketing"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-content">Contenuto Skill (Markdown) *</Label>
            <Textarea
              id="skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrivi qui il contenuto della skill in formato markdown..."
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingSkill ? "Salva Modifiche" : "Crea Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
