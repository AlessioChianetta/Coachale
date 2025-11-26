import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Loader2 } from 'lucide-react';

interface ScriptAssignment {
  scriptId: string;
  scriptName: string;
  scriptType: 'discovery' | 'demo' | 'objections';
}

interface AgentWithScripts {
  id: string;
  agentName: string;
  scriptAssignments: {
    discovery?: ScriptAssignment;
    demo?: ScriptAssignment;
    objections?: ScriptAssignment;
  };
}

interface ActiveScriptBadgeProps {
  agentId: string;
  scriptType?: 'discovery' | 'demo' | 'objections';
  showType?: boolean;
  size?: 'sm' | 'md';
}

const scriptTypeLabels = {
  discovery: 'Discovery',
  demo: 'Demo',
  objections: 'Obiezioni',
};

const scriptTypeColors = {
  discovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  demo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  objections: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export function ActiveScriptBadge({ 
  agentId, 
  scriptType,
  showType = true,
  size = 'sm' 
}: ActiveScriptBadgeProps) {
  const { data: agents, isLoading } = useQuery<AgentWithScripts[]>({
    queryKey: ['/api/sales-scripts/agents'],
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  const agent = agents?.find(a => a.id === agentId);
  if (!agent) return null;

  if (scriptType) {
    const assignment = agent.scriptAssignments[scriptType];
    if (!assignment) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 ${scriptTypeColors[scriptType]} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}
            >
              <FileText className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
              {showType && scriptTypeLabels[scriptType]}
              {assignment.scriptName}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Script {scriptTypeLabels[scriptType]} attivo: {assignment.scriptName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const activeScripts = Object.entries(agent.scriptAssignments)
    .filter(([_, v]) => v !== null && v !== undefined) as [string, ScriptAssignment][];

  if (activeScripts.length === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
        <FileText className="h-3 w-3" />
        Nessuno script attivo
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {activeScripts.map(([type, assignment]) => (
        <TooltipProvider key={type}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`gap-1 ${scriptTypeColors[type as keyof typeof scriptTypeColors]} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}
              >
                <FileText className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
                {showType && <span className="font-medium">{scriptTypeLabels[type as keyof typeof scriptTypeLabels]}:</span>}
                <span className="truncate max-w-[100px]">{assignment.scriptName}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Script {scriptTypeLabels[type as keyof typeof scriptTypeLabels]}: {assignment.scriptName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

export function ActiveScriptsSummary({ agentId }: { agentId: string }) {
  const { data: agents, isLoading } = useQuery<AgentWithScripts[]>({
    queryKey: ['/api/sales-scripts/agents'],
    staleTime: 30000,
  });

  if (isLoading) {
    return <span className="text-muted-foreground text-xs">Caricamento...</span>;
  }

  const agent = agents?.find(a => a.id === agentId);
  if (!agent) return null;

  const activeCount = Object.values(agent.scriptAssignments).filter(v => v !== null && v !== undefined).length;

  return (
    <span className="text-muted-foreground text-xs">
      {activeCount} script attivi
    </span>
  );
}
