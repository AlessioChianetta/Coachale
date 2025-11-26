import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WhatsAppPreviewProps {
  templateBody: string;
  variables?: {
    leadName?: string;
    consultantName?: string;
    hook?: string;
    idealState?: string;
    obiettivi?: string;
    desideri?: string;
    [key: string]: string | undefined;
  };
  campaignType?: string;
  leadCategory?: string;
}

export function WhatsAppPreview({
  templateBody,
  variables = {},
  campaignType,
  leadCategory,
}: WhatsAppPreviewProps) {
  const replaceVariables = (text: string) => {
    let result = text;
    
    const defaultVariables = {
      leadName: "Mario Rossi",
      consultantName: "Consulente",
      hook: variables.hook || "ho visto che sei interessato alla crescita personale",
      idealState: variables.idealState || "la libertà finanziaria",
      obiettivi: variables.obiettivi || "creare un patrimonio solido",
      desideri: variables.desideri || "generare rendita passiva",
      ...variables,
    };

    Object.entries(defaultVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, value || "");
    });

    return result;
  };

  const previewText = templateBody
    ? replaceVariables(templateBody)
    : "Inserisci un testo per vedere l'anteprima...";

  const campaignTypeLabels: Record<string, string> = {
    outbound_ads: "Pubblicità Esterna",
    inbound_form: "Form Inbound",
    referral: "Referral",
    recovery: "Recupero",
    partner: "Partner",
    walk_in: "Walk-In",
  };

  const leadCategoryLabels: Record<string, string> = {
    freddo: "Freddo",
    tiepido: "Tiepido",
    caldo: "Caldo",
    recupero: "Recupero",
    referral: "Referral",
  };

  const leadCategoryColors: Record<string, string> = {
    freddo: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    tiepido: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    caldo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    recupero: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    referral: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Anteprima Messaggio WhatsApp
          </CardTitle>
          <div className="flex gap-2">
            {campaignType && (
              <Badge variant="outline" className="text-xs">
                {campaignTypeLabels[campaignType] || campaignType}
              </Badge>
            )}
            {leadCategory && (
              <Badge className={cn("text-xs", leadCategoryColors[leadCategory])}>
                {leadCategoryLabels[leadCategory] || leadCategory}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%]">
              <div className="bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 rounded-xl rounded-tr-none p-3 shadow-sm">
                <p className="text-sm whitespace-pre-wrap break-words">
                  {previewText}
                </p>
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                  <span>ora</span>
                  <span className="text-green-600">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Questo è un esempio di come apparirà il messaggio al lead
          </div>
        </div>

        {Object.keys(variables).length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-2">
              Variabili disponibili:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <code className="text-blue-600 dark:text-blue-400">
                    {`{{${key}}}`}
                  </code>
                  <span className="text-muted-foreground">→</span>
                  <span className="truncate">{value || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
