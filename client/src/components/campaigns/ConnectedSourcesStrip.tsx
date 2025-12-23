import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Plug, Plus, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectedSourcesStripProps {
  crmConfigs: Array<{
    id: string;
    configName?: string;
    pollingEnabled?: boolean;
    pollingIntervalMinutes?: number;
    lastImportAt?: string | null;
    lastImportStatus?: string | null;
  }>;
  hubdigitalConfig?: {
    isActive?: boolean;
    totalLeadsReceived?: number;
    lastLeadReceivedAt?: string | null;
  } | null;
  externalSources?: Array<{
    name: string;
    icon: string;
    description: string;
  }>;
}

export function ConnectedSourcesStrip({
  crmConfigs,
  hubdigitalConfig,
  externalSources = [],
}: ConnectedSourcesStripProps) {
  const activeCrmConfigs = crmConfigs.filter((config) => config.pollingEnabled);

  return (
    <div
      className="flex items-center gap-2 py-2 px-1 overflow-x-auto bg-muted/30 rounded-lg"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {activeCrmConfigs.length > 0 ? (
        activeCrmConfigs.map((config) => (
          <Link key={config.id} href="/consultant/knowledge/apis">
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-transform hover:scale-105 shrink-0",
                "border-green-500/50 bg-green-50 dark:bg-green-950/20"
              )}
            >
              <Database className="h-3.5 w-3.5 text-green-600" />
              <span className="text-sm font-medium">
                {config.configName && config.configName !== "API CRM Personalizzata"
                  ? config.configName
                  : "CrmAle"}
              </span>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            </Badge>
          </Link>
        ))
      ) : (
        <Link href="/consultant/knowledge/apis">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-transform hover:scale-105 shrink-0 border-muted-foreground/30"
          >
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">CrmAle</span>
            <Circle className="h-3 w-3 text-muted-foreground" />
          </Badge>
        </Link>
      )}

      {hubdigitalConfig?.isActive ? (
        <Link href="/consultant/knowledge/apis?tab=lead-import">
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-transform hover:scale-105 shrink-0",
              "border-green-500/50 bg-green-50 dark:bg-green-950/20"
            )}
          >
            <Plug className="h-3.5 w-3.5 text-green-600" />
            <span className="text-sm font-medium">Hubdigital</span>
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          </Badge>
        </Link>
      ) : (
        <Link href="/consultant/knowledge/apis?tab=lead-import">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-transform hover:scale-105 shrink-0 border-muted-foreground/30"
          >
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Hubdigital</span>
            <Circle className="h-3 w-3 text-muted-foreground" />
          </Badge>
        </Link>
      )}

      {externalSources.map((source) => (
        <Badge
          key={source.name}
          variant="outline"
          className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 border-muted-foreground/30 opacity-60"
        >
          <span className="text-sm">{source.icon}</span>
          <span className="text-sm font-medium text-muted-foreground">{source.name}</span>
          <Circle className="h-3 w-3 text-muted-foreground" />
        </Badge>
      ))}

      <Link href="/consultant/knowledge/apis">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-3 py-1.5 h-auto shrink-0 text-primary hover:bg-primary/10 transition-transform hover:scale-105"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Aggiungi fonte</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}
