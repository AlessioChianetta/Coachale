import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Tag } from "lucide-react";
import { insertExerciseTemplateSchema, type ExerciseTemplate } from "@shared/schema";
import { z } from "zod";
import { cn } from "@/lib/utils";

const templateFormSchema = insertExerciseTemplateSchema.extend({
  estimatedDuration: z.number().min(1).optional(),
  timeLimit: z.number().min(1).optional(),
  workPlatform: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface Question {
  id: string;
  question: string;
  type: "text" | "number" | "select";
  options?: string[];
}

interface TemplateFormProps {
  template?: ExerciseTemplate; // For editing
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function TemplateForm({ template, onSubmit, onCancel, isLoading }: TemplateFormProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      type: template?.type || "general",
      category: template?.category || "",
      instructions: template?.instructions || "",
      estimatedDuration: template?.estimatedDuration || undefined,
      timeLimit: template?.timeLimit || undefined,
      workPlatform: template?.workPlatform || "",
      isPublic: template?.isPublic || false,
    },
  });

  // Initialize questions and tags when editing
  useEffect(() => {
    if (template) {
      setQuestions(template.questions || []);
      setTags(template.tags || []);
    }
  }, [template]);

  const handleSubmit = (data: TemplateFormData) => {
    const templateData = {
      ...data,
      questions,
      tags,
      workPlatform: data.workPlatform || undefined,
    };
    onSubmit(templateData);
  };

  // Question management functions
  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question: "",
      type: "text",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { ...q, options: [...(q.options || []), ""] }
        : q
    ));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options?.map((opt, idx) => idx === optionIndex ? value : opt) 
          }
        : q
    ));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options?.filter((_, idx) => idx !== optionIndex) 
          }
        : q
    ));
  };

  // Tag management functions
  const addTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Card className="w-full max-w-4xl" data-testid="template-form">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Modifica Template" : "Crea Nuovo Template"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Template *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Nome del template"
                data-testid="input-template-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select
                onValueChange={(value: string) => form.setValue("category", value)}
                value={form.watch("category")}
                data-testid="select-template-category"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imprenditoria">Imprenditoria</SelectItem>
                  <SelectItem value="risparmio-investimenti">Risparmio e Investimenti</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione *</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Descrizione del template"
              rows={3}
              data-testid="textarea-template-description"
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value: "general" | "personalized") => form.setValue("type", value)}
              >
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Generale</SelectItem>
                  <SelectItem value="personalized">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Durata Stimata (minuti)</Label>
              <Input
                id="estimatedDuration"
                type="number"
                min="1"
                {...form.register("estimatedDuration", { 
                  setValueAs: v => v === "" ? undefined : parseInt(v, 10) 
                })}
                placeholder="30"
                data-testid="input-template-duration"
              />
              {form.formState.errors.estimatedDuration && (
                <p className="text-sm text-destructive">{form.formState.errors.estimatedDuration.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeLimit">Limite di tempo (minuti, opzionale)</Label>
              <Input
                id="timeLimit"
                type="number"
                min="1"
                {...form.register("timeLimit", { 
                  setValueAs: v => v === "" ? undefined : parseInt(v, 10) 
                })}
                placeholder="60"
                data-testid="input-template-time-limit"
              />
              {form.formState.errors.timeLimit && (
                <p className="text-sm text-destructive">{form.formState.errors.timeLimit.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <span>Template Pubblico</span>
                <Switch
                  checked={form.watch("isPublic") || false}
                  onCheckedChange={(checked) => form.setValue("isPublic", checked)}
                  data-testid="switch-template-public"
                />
              </Label>
              <p className="text-xs text-muted-foreground">
                I template pubblici possono essere utilizzati da altri consulenti
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">
                  <Tag size={12} className="mr-1" />
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => removeTag(tag)}
                    data-testid={`button-remove-tag-${tag}`}
                  >
                    <X size={12} />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Aggiungi tag"
                className="flex-1"
                data-testid="input-new-tag"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                disabled={!newTag.trim()}
                data-testid="button-add-tag"
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Istruzioni</Label>
            <Textarea
              id="instructions"
              {...form.register("instructions")}
              placeholder="Istruzioni dettagliate per l'esercizio"
              rows={4}
              data-testid="textarea-template-instructions"
            />
          </div>

          {/* Work Platform */}
          <div className="space-y-2">
            <Label htmlFor="workPlatform">Piattaforma di Lavoro (opzionale)</Label>
            <Input
              id="workPlatform"
              {...form.register("workPlatform")}
              placeholder="es. https://docs.google.com/spreadsheets/d/..."
              data-testid="input-template-work-platform"
            />
            <p className="text-xs text-muted-foreground">
              URL della piattaforma esterna dove i clienti dovranno lavorare
            </p>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Domande per il Cliente</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                data-testid="button-add-question"
              >
                <Plus size={16} className="mr-2" />
                Aggiungi Domanda
              </Button>
            </div>

            {questions.map((question, index) => (
              <Card key={question.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Domanda {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-remove-question-${question.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        value={question.question}
                        onChange={(e) => updateQuestion(question.id, "question", e.target.value)}
                        placeholder="Testo della domanda"
                        data-testid={`input-question-${question.id}`}
                      />
                    </div>
                    <div>
                      <Select
                        value={question.type}
                        onValueChange={(value: "text" | "number" | "select") => 
                          updateQuestion(question.id, "type", value)
                        }
                      >
                        <SelectTrigger data-testid={`select-question-type-${question.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Testo</SelectItem>
                          <SelectItem value="number">Numero</SelectItem>
                          <SelectItem value="select">Selezione</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {question.type === "select" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Opzioni</Label>
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex space-x-2">
                          <Input
                            value={option}
                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                            placeholder={`Opzione ${optIndex + 1}`}
                            className="flex-1"
                            data-testid={`input-option-${question.id}-${optIndex}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(question.id, optIndex)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-remove-option-${question.id}-${optIndex}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(question.id)}
                        data-testid={`button-add-option-${question.id}`}
                      >
                        <Plus size={16} className="mr-2" />
                        Aggiungi Opzione
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Form Actions */}
          <div className="flex items-center space-x-4 pt-6">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
              data-testid="button-submit-template"
            >
              {isLoading ? "Salvando..." : isEditing ? "Aggiorna Template" : "Crea Template"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              data-testid="button-cancel-template"
            >
              Annulla
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}