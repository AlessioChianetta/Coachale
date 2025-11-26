import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

interface VariableMappingTableProps {
  bodyText: string;
  catalog: CatalogVariable[];
}

interface VariableMapping {
  variableKey: string;
  position: number;
  twilioPlaceholder: string;
  variableName: string;
  description: string;
  isValid: boolean;
  catalogId?: string;
}

export default function VariableMappingTable({
  bodyText,
  catalog,
}: VariableMappingTableProps) {
  const extractVariablesWithPositions = (text: string): VariableMapping[] => {
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    const found: Array<{ key: string; index: number }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      if (!found.some((f) => f.key === key)) {
        found.push({ key, index: match.index });
      }
    }

    found.sort((a, b) => a.index - b.index);

    return found.map((item, idx) => {
      const position = idx + 1;
      const catalogVar = catalog.find((v) => v.variableKey === item.key);

      return {
        variableKey: item.key,
        position,
        twilioPlaceholder: `{{${position}}}`,
        variableName: catalogVar?.variableName || "Sconosciuta",
        description: catalogVar?.description || "Variabile non trovata nel catalogo",
        isValid: !!catalogVar,
        catalogId: catalogVar?.id,
      };
    });
  };

  const mappings = extractVariablesWithPositions(bodyText);
  const hasInvalidVariables = mappings.some((m) => !m.isValid);
  const hasVariables = mappings.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mappatura Variabili → Twilio</CardTitle>
        <CardDescription>
          Conversione automatica delle variabili custom in placeholders Twilio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasVariables && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nessuna variabile rilevata nel testo. Inserisci almeno una variabile dal catalogo.
            </AlertDescription>
          </Alert>
        )}

        {hasInvalidVariables && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Attenzione:</strong> Alcune variabili non esistono nel catalogo e non
              potranno essere mappate correttamente.
            </AlertDescription>
          </Alert>
        )}

        {hasVariables && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Posizione</TableHead>
                    <TableHead>Variabile Custom</TableHead>
                    <TableHead className="w-[100px] text-center">
                      <ArrowRight className="h-4 w-4 mx-auto" />
                    </TableHead>
                    <TableHead>Twilio Placeholder</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="w-[100px]">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.variableKey}>
                      <TableCell className="font-mono font-semibold">
                        {mapping.position}
                      </TableCell>
                      <TableCell>
                        <code className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                          {`{${mapping.variableKey}}`}
                        </code>
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <code className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm font-semibold">
                          {mapping.twilioPlaceholder}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {mapping.variableName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mapping.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {mapping.isValid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Valida
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Invalida
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                <strong>ℹ️ Info:</strong> L'ordine delle variabili viene determinato automaticamente
                in base alla loro prima apparizione nel testo. Twilio utilizzerà i placeholder
                numerati (es: {`{{1}}`}, {`{{2}}`}) per sostituire le variabili.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
