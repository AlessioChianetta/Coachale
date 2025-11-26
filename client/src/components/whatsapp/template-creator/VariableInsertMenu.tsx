import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, User, Settings, Sparkles } from "lucide-react";

interface CatalogVariable {
  id: string;
  variableKey: string;
  variableName: string;
  description: string;
  sourceType: "lead" | "agent_config" | "consultant" | "computed";
  sourcePath: string;
  dataType: string;
}

interface VariableInsertMenuProps {
  catalog: CatalogVariable[];
  onInsertVariable: (variableKey: string) => void;
}

const SOURCE_TYPE_CONFIG = {
  lead: {
    label: "Dati Lead",
    icon: User,
    color: "bg-blue-100 text-blue-700",
  },
  agent_config: {
    label: "Configurazione Agente",
    icon: Settings,
    color: "bg-purple-100 text-purple-700",
  },
  consultant: {
    label: "Dati Consulente",
    icon: User,
    color: "bg-green-100 text-green-700",
  },
  computed: {
    label: "Valori Calcolati",
    icon: Sparkles,
    color: "bg-amber-100 text-amber-700",
  },
} as const;

export default function VariableInsertMenu({
  catalog,
  onInsertVariable,
}: VariableInsertMenuProps) {
  const groupedVariables = catalog.reduce((acc, variable) => {
    const type = variable.sourceType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(variable);
    return acc;
  }, {} as Record<string, CatalogVariable[]>);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Inserisci Variabile
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-2">
          <div>
            <h4 className="font-medium text-sm mb-1">Variabili Disponibili</h4>
            <p className="text-xs text-muted-foreground">
              Clicca su una variabile per inserirla nel testo
            </p>
          </div>
          <Separator />
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {Object.entries(groupedVariables).map(([sourceType, variables]) => {
                const config = SOURCE_TYPE_CONFIG[sourceType as keyof typeof SOURCE_TYPE_CONFIG];
                if (!config) return null;
                
                const Icon = config.icon;

                return (
                  <div key={sourceType}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                        {config.label}
                      </h5>
                    </div>
                    <div className="space-y-1">
                      {variables.map((variable) => (
                        <button
                          key={variable.id}
                          onClick={() => onInsertVariable(variable.variableKey)}
                          className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors border border-transparent hover:border-border"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {variable.variableName}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {variable.description}
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-xs shrink-0 ${config.color}`}
                            >
                              {`{${variable.variableKey}}`}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
