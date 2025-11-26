import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface TemplateMetadataFormProps {
  templateName: string;
  templateType: "opening" | "followup_gentle" | "followup_value" | "followup_final" | "";
  description: string;
  onTemplateNameChange: (value: string) => void;
  onTemplateTypeChange: (value: "opening" | "followup_gentle" | "followup_value" | "followup_final") => void;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
}

const TEMPLATE_TYPES = [
  { value: "opening", label: "Opening Message", description: "Primo messaggio di apertura" },
  { value: "followup_gentle", label: "Follow-up Gentile", description: "Sollecito delicato" },
  { value: "followup_value", label: "Follow-up Valore", description: "Messaggio di valore" },
  { value: "followup_final", label: "Follow-up Finale", description: "Ultimo tentativo" },
] as const;

export default function TemplateMetadataForm({
  templateName,
  templateType,
  description,
  onTemplateNameChange,
  onTemplateTypeChange,
  onDescriptionChange,
  disabled = false,
}: TemplateMetadataFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informazioni Template</CardTitle>
        <CardDescription>
          Definisci il nome, tipo e descrizione del template WhatsApp
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
            <Label htmlFor="template-type">
              Tipo Template <span className="text-destructive">*</span>
            </Label>
            {disabled && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Read-Only
              </Badge>
            )}
          </div>
          {disabled ? (
            <Input
              id="template-type"
              value={TEMPLATE_TYPES.find(t => t.value === templateType)?.label || templateType}
              readOnly
              aria-readonly="true"
              className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 cursor-not-allowed"
            />
          ) : (
            <Select
              value={templateType}
              onValueChange={onTemplateTypeChange}
            >
              <SelectTrigger id="template-type">
                <SelectValue placeholder="Seleziona il tipo di template" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {disabled && (
            <p className="text-xs text-muted-foreground">
              Questo campo non può essere modificato in modalità edit
            </p>
          )}
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
