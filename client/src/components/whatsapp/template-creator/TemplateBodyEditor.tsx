import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VariableInsertMenu from "./VariableInsertMenu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

interface TemplateBodyEditorProps {
  bodyText: string;
  onBodyTextChange: (text: string) => void;
  catalog: CatalogVariable[];
}

export default function TemplateBodyEditor({
  bodyText,
  onBodyTextChange,
  catalog,
}: TemplateBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (variableKey: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const variableText = `{${variableKey}}`;
    const newText =
      bodyText.substring(0, start) + variableText + bodyText.substring(end);

    onBodyTextChange(newText);

    setTimeout(() => {
      const newCursorPos = start + variableText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Regex that requires at least 3 characters and must contain underscore (valid variable format)
  // This prevents matching single letters like {e}, {i} which are not real variables
  const VARIABLE_REGEX = /\{([a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]{2,})\}/g;

  const extractVariables = (text: string): string[] => {
    const regex = new RegExp(VARIABLE_REGEX.source, 'g');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }

    return matches;
  };

  const getHighlightedText = () => {
    if (!bodyText) return null;

    const parts: Array<{ text: string; isVariable: boolean }> = [];
    let lastIndex = 0;
    const regex = new RegExp(VARIABLE_REGEX.source, 'g');
    let match;

    while ((match = regex.exec(bodyText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          text: bodyText.substring(lastIndex, match.index),
          isVariable: false,
        });
      }

      parts.push({
        text: match[0],
        isVariable: true,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < bodyText.length) {
      parts.push({
        text: bodyText.substring(lastIndex),
        isVariable: false,
      });
    }

    return parts;
  };

  const usedVariables = extractVariables(bodyText);
  const catalogKeys = catalog.map((v) => v.variableKey);
  const unknownVariables = usedVariables.filter(
    (key) => !catalogKeys.includes(key)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testo del Template</CardTitle>
        <CardDescription>
          Scrivi il contenuto del messaggio e inserisci variabili dinamiche dal catalogo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="body-text">
              Corpo del Messaggio <span className="text-destructive">*</span>
            </Label>
            <VariableInsertMenu
              catalog={catalog}
              onInsertVariable={handleInsertVariable}
            />
          </div>
          <Textarea
            ref={textareaRef}
            id="body-text"
            placeholder="Es: Ciao {nome_lead}, sono {nome_consulente} di {business_name}..."
            value={bodyText}
            onChange={(e) => onBodyTextChange(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {bodyText.length} caratteri • {usedVariables.length} variabili utilizzate
          </p>
        </div>

        {unknownVariables.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Variabili sconosciute rilevate:</strong>{" "}
              {unknownVariables.map((v) => `{${v}}`).join(", ")}
              <br />
              Queste variabili non esistono nel catalogo e non saranno sostituite.
            </AlertDescription>
          </Alert>
        )}

        {bodyText && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preview:</Label>
            <div className="p-3 border rounded-md bg-muted/30 font-mono text-sm whitespace-pre-wrap break-words">
              {getHighlightedText()?.map((part, index) => (
                <span
                  key={index}
                  className={
                    part.isVariable
                      ? "bg-blue-100 text-blue-700 px-1 rounded font-semibold"
                      : ""
                  }
                >
                  {part.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
