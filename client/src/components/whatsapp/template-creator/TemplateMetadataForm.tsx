import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface TemplateMetadataFormProps {
  templateName: string;
  useCase: string;
  description: string;
  onTemplateNameChange: (value: string) => void;
  onUseCaseChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
}

const USE_CASE_SUGGESTIONS = [
  { value: "primo-contatto", label: "Primo Contatto", description: "Primo messaggio a un nuovo lead" },
  { value: "follow-up", label: "Follow-up", description: "Seguito dopo il primo contatto" },
  { value: "promemoria", label: "Promemoria", description: "Ricordare un appuntamento o scadenza" },
  { value: "benvenuto", label: "Benvenuto", description: "Messaggio di benvenuto" },
  { value: "ringraziamento", label: "Ringraziamento", description: "Ringraziare dopo una call o acquisto" },
  { value: "richiesta-referral", label: "Richiesta Referral", description: "Chiedere referenze" },
  { value: "offerta-speciale", label: "Offerta Speciale", description: "Promozione o sconto" },
  { value: "nurturing", label: "Nurturing", description: "Contenuto di valore per mantenere il contatto" },
  { value: "riattivazione", label: "Riattivazione", description: "Ricontattare lead freddi" },
  { value: "conferma-appuntamento", label: "Conferma Appuntamento", description: "Confermare un meeting" },
  { value: "post-demo", label: "Post-Demo", description: "Follow-up dopo una demo" },
  { value: "sondaggio", label: "Sondaggio", description: "Richiedere feedback" },
];

export default function TemplateMetadataForm({
  templateName,
  useCase,
  description,
  onTemplateNameChange,
  onUseCaseChange,
  onDescriptionChange,
  disabled = false,
}: TemplateMetadataFormProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState(USE_CASE_SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUseCaseInputChange = (value: string) => {
    onUseCaseChange(value);
    const filtered = USE_CASE_SUGGESTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(value.toLowerCase()) ||
        s.value.toLowerCase().includes(value.toLowerCase()) ||
        s.description.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSuggestions(filtered);
  };

  const handleSuggestionClick = (suggestion: typeof USE_CASE_SUGGESTIONS[0]) => {
    onUseCaseChange(suggestion.label);
    setShowSuggestions(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informazioni Template</CardTitle>
        <CardDescription>
          Definisci il nome, caso d'uso e descrizione del template WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="template-name">
              Nome Template <span className="text-destructive">*</span>
            </Label>
            {disabled && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Read-Only
              </Badge>
            )}
          </div>
          <Input
            id="template-name"
            placeholder="Es: Messaggio Apertura Lead Nuovi"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            maxLength={100}
            required
            readOnly={disabled}
            className={disabled ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 cursor-not-allowed" : ""}
          />
          <p className="text-xs text-muted-foreground">
            {disabled ? "Questo campo non può essere modificato in modalità edit" : `${templateName.length}/100 caratteri`}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="use-case">
              Caso d'Uso (opzionale)
            </Label>
            {disabled && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Read-Only
              </Badge>
            )}
          </div>
          <div className="relative">
            <Input
              ref={inputRef}
              id="use-case"
              placeholder="Es: follow-up, promemoria, benvenuto..."
              value={useCase}
              onChange={(e) => handleUseCaseInputChange(e.target.value)}
              onFocus={() => !disabled && setShowSuggestions(true)}
              readOnly={disabled}
              className={disabled ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 cursor-not-allowed" : ""}
            />
            {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
              >
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.value}
                    type="button"
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="font-medium text-sm">{suggestion.label}</div>
                    <div className="text-xs text-muted-foreground">{suggestion.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {disabled 
              ? "Questo campo non può essere modificato in modalità edit" 
              : "Descrivi quando usare questo template. Puoi scrivere qualsiasi valore o scegliere dai suggerimenti."
            }
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrizione (opzionale)</Label>
          <Textarea
            id="description"
            placeholder="Descrivi lo scopo di questo template..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Puoi sempre modificare la descrizione
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
