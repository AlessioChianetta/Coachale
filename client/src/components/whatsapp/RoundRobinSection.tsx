import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shuffle,
  Plus,
  Trash2,
  Loader2,
  Users,
  CalendarCheck,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Settings2,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";

interface RoundRobinSectionProps {
  agentConfigId: string;
  consultantId: string;
}

interface Pool {
  id: string;
  name: string;
  strategy: string;
  isActive: boolean;
}

interface PoolMember {
  memberId: string;
  agentConfigId: string;
  agentName: string;
  weight: number;
  maxDailyBookings: number;
  isActive: boolean;
  isPaused: boolean;
  totalBookingsCount: number;
  todayBookingsCount: number;
  hasCalendar: boolean;
  googleCalendarEmail: string | null;
}

interface AvailableAgent {
  id: string;
  agentName: string;
  hasCalendar: boolean;
  googleCalendarEmail: string | null;
}

interface PoolStats {
  totalMembers: number;
  activeMembers: number;
  withCalendar: number;
  totalBookings: number;
  todayBookings: number;
  distribution: Array<{
    agentName: string;
    agentConfigId: string;
    weight: number;
    totalBookings: number;
    todayBookings: number;
    maxDaily: number;
    sharePercent: number;
    hasCalendar: boolean;
    isActive: boolean;
    isPaused: boolean;
  }>;
}

export default function RoundRobinSection({ agentConfigId, consultantId }: RoundRobinSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const { data: rrStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["round-robin-status", agentConfigId],
    queryFn: async () => {
      const res = await fetch(`/api/round-robin/agent/${agentConfigId}/round-robin`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ roundRobinEnabled: boolean; bookingPoolId: string | null }>;
    },
  });

  const { data: poolsData } = useQuery({
    queryKey: ["round-robin-pools", consultantId],
    queryFn: async () => {
      const res = await fetch("/api/round-robin/pools", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ pools: Pool[] }>;
    },
    enabled: !!rrStatus?.roundRobinEnabled || expanded,
  });

  const activePoolId = rrStatus?.bookingPoolId;

  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["round-robin-members", activePoolId],
    queryFn: async () => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ members: PoolMember[] }>;
    },
    enabled: !!activePoolId,
  });

  const { data: statsData } = useQuery({
    queryKey: ["round-robin-stats", activePoolId],
    queryFn: async () => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/stats`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<PoolStats>;
    },
    enabled: !!activePoolId && showStats,
  });

  const { data: availableAgents } = useQuery({
    queryKey: ["round-robin-agents-available"],
    queryFn: async () => {
      const res = await fetch("/api/round-robin/agents-available", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ agents: AvailableAgent[] }>;
    },
    enabled: !!activePoolId,
  });

  const toggleRoundRobin = useMutation({
    mutationFn: async (enabled: boolean) => {
      let poolId = rrStatus?.bookingPoolId;

      if (enabled && !poolId) {
        const createRes = await fetch("/api/round-robin/pools", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ name: "Pool Commerciali" }),
        });
        if (!createRes.ok) throw new Error("Failed to create pool");
        const { pool } = await createRes.json();
        poolId = pool.id;
      }

      const res = await fetch(`/api/round-robin/agent/${agentConfigId}/round-robin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ enabled, poolId }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-status"] });
      queryClient.invalidateQueries({ queryKey: ["round-robin-pools"] });
      toast({
        title: enabled ? "Round-Robin attivato" : "Round-Robin disattivato",
        description: enabled
          ? "Gli appuntamenti verranno distribuiti tra i commerciali nel pool"
          : "Gli appuntamenti torneranno al calendario singolo",
      });
      if (enabled) setExpanded(true);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    },
  });

  const updatePool = useMutation({
    mutationFn: async ({ poolId, data }: { poolId: string; data: any }) => {
      const res = await fetch(`/api/round-robin/pools/${poolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-pools"] });
      toast({ title: "Pool aggiornato" });
    },
  });

  const addMember = useMutation({
    mutationFn: async (memberAgentConfigId: string) => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ agentConfigId: memberAgentConfigId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-members"] });
      queryClient.invalidateQueries({ queryKey: ["round-robin-stats"] });
      toast({ title: "Commerciale aggiunto al pool" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: any }) => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-members"] });
      queryClient.invalidateQueries({ queryKey: ["round-robin-stats"] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members/${memberId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to remove");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-members"] });
      queryClient.invalidateQueries({ queryKey: ["round-robin-stats"] });
      toast({ title: "Commerciale rimosso dal pool" });
    },
  });

  const resetMember = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members/${memberId}/reset`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round-robin-members"] });
      queryClient.invalidateQueries({ queryKey: ["round-robin-stats"] });
      toast({ title: "Contatore resettato" });
    },
  });

  const isEnabled = rrStatus?.roundRobinEnabled ?? false;
  const pools = poolsData?.pools || [];
  const activePool = pools.find((p) => p.id === activePoolId);
  const members = membersData?.members || [];
  const agents = availableAgents?.agents || [];
  const memberAgentIds = new Set(members.map((m) => m.agentConfigId));
  const addableAgents = agents.filter((a) => !memberAgentIds.has(a.id) && a.hasCalendar);

  if (isLoadingStatus) {
    return (
      <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-blue-500" />
          Round-Robin Booking
        </h3>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => toggleRoundRobin.mutate(checked)}
          disabled={toggleRoundRobin.isPending}
          className="scale-75"
        />
      </div>

      {!isEnabled && (
        <p className="text-xs text-slate-500">
          Distribuisci gli appuntamenti tra più commerciali automaticamente
        </p>
      )}

      {isEnabled && (
        <div className="space-y-3 mt-2">
          {activePool && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-slate-700">Strategia</span>
                </div>
                <Select
                  value={activePool.strategy}
                  onValueChange={(value) =>
                    updatePool.mutate({ poolId: activePool.id, data: { strategy: value } })
                  }
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted">Weighted</SelectItem>
                    <SelectItem value="strict_round_robin">Strict</SelectItem>
                    <SelectItem value="availability_first">Disponibilità</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-[10px] text-slate-500 bg-white/60 p-2 rounded border border-blue-100">
                {activePool.strategy === "weighted" && "Distribuzione proporzionale al peso di ciascun commerciale"}
                {activePool.strategy === "strict_round_robin" && "Rotazione fissa: A→B→C→A→B→C (equa distribuzione)"}
                {activePool.strategy === "availability_first" && "Priorità a chi ha meno appuntamenti oggi"}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-slate-700">
                  Commerciali ({members.length})
                </span>
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>
            </div>

            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : members.length === 0 ? (
              <div className="p-3 bg-amber-50/60 rounded border border-amber-200 text-center">
                <AlertCircle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-amber-700">Nessun commerciale nel pool</p>
                <p className="text-[10px] text-amber-600">Aggiungi dipendenti con Google Calendar collegato</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {members.map((member) => (
                  <MemberCard
                    key={member.memberId}
                    member={member}
                    strategy={activePool?.strategy || "weighted"}
                    expanded={expanded}
                    onUpdate={(data) => updateMember.mutate({ memberId: member.memberId, data })}
                    onRemove={() => removeMember.mutate(member.memberId)}
                    onReset={() => resetMember.mutate(member.memberId)}
                    isUpdating={updateMember.isPending}
                  />
                ))}
              </div>
            )}

            {expanded && addableAgents.length > 0 && (
              <div className="pt-2 border-t border-blue-200/50">
                <p className="text-[10px] text-slate-500 mb-1.5">Aggiungi commerciale:</p>
                <div className="space-y-1">
                  {addableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => addMember.mutate(agent.id)}
                      disabled={addMember.isPending}
                      className="w-full flex items-center gap-2 p-2 rounded border border-blue-200 bg-white hover:bg-blue-50 transition-colors text-left"
                    >
                      <Plus className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{agent.agentName}</p>
                        {agent.googleCalendarEmail && (
                          <p className="text-[10px] text-slate-400 truncate">{agent.googleCalendarEmail}</p>
                        )}
                      </div>
                      <CalendarCheck className="h-3 w-3 text-green-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {expanded && addableAgents.length === 0 && agents.filter((a) => !memberAgentIds.has(a.id)).length > 0 && (
              <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                I dipendenti rimanenti non hanno Google Calendar collegato. Collegalo prima di aggiungerli al pool.
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-blue-200/50">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {showStats ? "Nascondi statistiche" : "Mostra statistiche"}
            </button>

            {showStats && statsData && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="text-center p-1.5 bg-white rounded border border-blue-100">
                    <p className="text-sm font-bold text-blue-600">{statsData.totalBookings}</p>
                    <p className="text-[10px] text-slate-500">Totale</p>
                  </div>
                  <div className="text-center p-1.5 bg-white rounded border border-blue-100">
                    <p className="text-sm font-bold text-green-600">{statsData.todayBookings}</p>
                    <p className="text-[10px] text-slate-500">Oggi</p>
                  </div>
                  <div className="text-center p-1.5 bg-white rounded border border-blue-100">
                    <p className="text-sm font-bold text-indigo-600">{statsData.activeMembers}</p>
                    <p className="text-[10px] text-slate-500">Attivi</p>
                  </div>
                </div>

                {statsData.distribution.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-slate-600">Distribuzione:</p>
                    {statsData.distribution.map((d) => (
                      <div key={d.agentConfigId} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 w-20 truncate">{d.agentName}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.max(d.sharePercent, 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 w-8 text-right">{d.sharePercent}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  strategy,
  expanded,
  onUpdate,
  onRemove,
  onReset,
  isUpdating,
}: {
  member: PoolMember;
  strategy: string;
  expanded: boolean;
  onUpdate: (data: any) => void;
  onRemove: () => void;
  onReset: () => void;
  isUpdating: boolean;
}) {
  const [editWeight, setEditWeight] = useState(member.weight);
  const [editMaxDaily, setEditMaxDaily] = useState(member.maxDailyBookings);

  return (
    <div
      className={cn(
        "p-2 rounded border transition-colors",
        member.isPaused
          ? "bg-amber-50/50 border-amber-200"
          : member.isActive
            ? "bg-white border-blue-200"
            : "bg-slate-50 border-slate-200 opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-700 truncate">{member.agentName}</span>
            {member.isPaused && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">In pausa</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">
              {member.totalBookingsCount} totali | {member.todayBookingsCount}/{member.maxDailyBookings} oggi
            </span>
            {strategy === "weighted" && (
              <span className="text-[10px] text-blue-500 font-medium">peso: {member.weight}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onUpdate({ isPaused: !member.isPaused })}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title={member.isPaused ? "Riattiva" : "Metti in pausa"}
          >
            {member.isPaused ? (
              <Play className="h-3 w-3 text-green-500" />
            ) : (
              <Pause className="h-3 w-3 text-amber-500" />
            )}
          </button>
          {expanded && (
            <>
              <button
                onClick={onReset}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                title="Reset contatore"
              >
                <RotateCcw className="h-3 w-3 text-slate-400" />
              </button>
              <button
                onClick={onRemove}
                className="p-1 hover:bg-red-50 rounded transition-colors"
                title="Rimuovi dal pool"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
          {strategy === "weighted" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Peso (priorità)</span>
                <span className="text-[10px] font-medium text-blue-600">{editWeight}</span>
              </div>
              <Slider
                value={[editWeight]}
                min={1}
                max={100}
                step={1}
                onValueChange={([val]) => setEditWeight(val)}
                onValueCommit={([val]) => onUpdate({ weight: val })}
                className="w-full"
              />
            </div>
          )}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500">Max appuntamenti/giorno</span>
            <Input
              type="number"
              value={editMaxDaily}
              min={1}
              max={50}
              onChange={(e) => setEditMaxDaily(Number(e.target.value))}
              onBlur={() => {
                if (editMaxDaily !== member.maxDailyBookings) {
                  onUpdate({ maxDailyBookings: editMaxDaily });
                }
              }}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
