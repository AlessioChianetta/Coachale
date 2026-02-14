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
  Link,
  Calendar,
  UserPlus,
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
  agentConfigId: string | null;
  agentName: string;
  weight: number;
  maxDailyBookings: number;
  isActive: boolean;
  isPaused: boolean;
  totalBookingsCount: number;
  todayBookingsCount: number;
  hasCalendar: boolean;
  googleCalendarEmail: string | null;
  isStandalone: boolean;
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
  const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null);
  const [connectingMemberId, setConnectingMemberId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

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

  const addStandaloneMember = useMutation({
    mutationFn: async (memberName: string) => {
      const res = await fetch(`/api/round-robin/pools/${activePoolId}/members/standalone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ memberName }),
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
      setNewMemberName("");
      setShowAddForm(false);
      toast({ title: "Membro aggiunto al pool", description: "Collega ora il Google Calendar" });
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

  const handleConnectCalendar = async (targetAgentId: string) => {
    setConnectingAgentId(targetAgentId);
    try {
      const response = await fetch(`/api/whatsapp/agents/${targetAgentId}/calendar/oauth/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore durante la connessione');
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile avviare la connessione al calendario"
      });
      setConnectingAgentId(null);
    }
  };

  const handleConnectStandaloneMemberCalendar = async (memberId: string) => {
    setConnectingMemberId(memberId);
    try {
      const response = await fetch(`/api/round-robin/members/${memberId}/calendar/oauth/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore durante la connessione');
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile avviare la connessione al calendario"
      });
      setConnectingMemberId(null);
    }
  };

  const isEnabled = rrStatus?.roundRobinEnabled ?? false;
  const pools = poolsData?.pools || [];
  const activePool = pools.find((p) => p.id === activePoolId);
  const members = membersData?.members || [];
  const agents = availableAgents?.agents || [];
  const memberAgentIds = new Set(members.filter(m => m.agentConfigId).map((m) => m.agentConfigId));
  const nonMemberAgents = agents.filter((a) => !memberAgentIds.has(a.id));
  const addableAgents = nonMemberAgents.filter((a) => a.hasCalendar);
  const agentsWithoutCalendar = nonMemberAgents.filter((a) => !a.hasCalendar);

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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Membri Pool ({members.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setExpanded(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="text-sm font-medium">Aggiungi Membro</span>
                </button>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Chiudi</span>
                    </>
                  ) : (
                    <>
                      <Settings2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Modifica</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : members.length === 0 ? (
              <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-center">
                <AlertCircle className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
                <p className="text-sm text-amber-700 font-medium">Nessun membro nel pool</p>
                <p className="text-xs text-amber-600 mt-0.5">Clicca "Aggiungi Membro" per iniziare</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activePool?.strategy === "weighted" && members.length > 0 && (() => {
                  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
                  return (
                    <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-700">Distribuzione appuntamenti</span>
                        <span className="text-xs text-blue-500">peso totale: {totalWeight}</span>
                      </div>
                      <div className="flex w-full h-4 rounded-full overflow-hidden bg-blue-100">
                        {members.map((m, i) => {
                          const pct = totalWeight > 0 ? (m.weight / totalWeight) * 100 : 0;
                          const colors = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-emerald-500"];
                          return (
                            <div
                              key={m.memberId}
                              className={cn(colors[i % colors.length], "transition-all")}
                              style={{ width: `${pct}%` }}
                              title={`${m.agentName}: ${pct.toFixed(1)}%`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {members.map((m, i) => {
                          const pct = totalWeight > 0 ? (m.weight / totalWeight) * 100 : 0;
                          const dotColors = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-teal-500", "bg-emerald-500"];
                          return (
                            <div key={m.memberId} className="flex items-center gap-1.5">
                              <div className={cn("w-2.5 h-2.5 rounded-full", dotColors[i % dotColors.length])} />
                              <span className="text-xs text-slate-600">{m.agentName}: <strong>{pct.toFixed(1)}%</strong></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {members.map((member) => {
                  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
                  return (
                    <MemberCard
                      key={member.memberId}
                      member={member}
                      strategy={activePool?.strategy || "weighted"}
                      expanded={expanded}
                      totalWeight={totalWeight}
                      onUpdate={(data) => updateMember.mutate({ memberId: member.memberId, data })}
                      onRemove={() => removeMember.mutate(member.memberId)}
                      onReset={() => resetMember.mutate(member.memberId)}
                      onConnectCalendar={() => {
                        if (member.isStandalone) {
                          handleConnectStandaloneMemberCalendar(member.memberId);
                        } else if (member.agentConfigId) {
                          handleConnectCalendar(member.agentConfigId);
                        }
                      }}
                      isUpdating={updateMember.isPending}
                      isConnecting={
                        (member.isStandalone && connectingMemberId === member.memberId) ||
                        (!member.isStandalone && connectingAgentId === member.agentConfigId)
                      }
                    />
                  );
                })}
              </div>
            )}

            {showAddForm && (
              <div className="p-3 rounded-lg border border-blue-300 bg-white space-y-2.5">
                <p className="text-sm font-medium text-slate-700">Aggiungi nuovo membro</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Nome del commerciale..."
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="h-9 text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMemberName.trim()) {
                        addStandaloneMember.mutate(newMemberName.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newMemberName.trim()) {
                        addStandaloneMember.mutate(newMemberName.trim());
                      }
                    }}
                    disabled={!newMemberName.trim() || addStandaloneMember.isPending}
                    className="h-9 px-4 text-sm"
                  >
                    {addStandaloneMember.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Conferma
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewMemberName("");
                    }}
                    className="h-9 px-2 text-sm text-slate-500"
                  >
                    ✕
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  Dopo l'aggiunta, potrai collegare il Google Calendar del membro
                </p>
              </div>
            )}

            {nonMemberAgents.length > 0 && (
              <div className="pt-3 border-t border-blue-200/50 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Dipendenti WhatsApp disponibili:</p>

                {addableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-green-200 bg-white"
                  >
                    <CalendarCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{agent.agentName}</p>
                      <p className="text-xs text-green-600 truncate">{agent.googleCalendarEmail}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addMember.mutate(agent.id)}
                      disabled={addMember.isPending}
                      className="h-8 px-3 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Aggiungi
                    </Button>
                  </div>
                ))}

                {agentsWithoutCalendar.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-amber-200 bg-amber-50/30"
                  >
                    <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{agent.agentName}</p>
                      <p className="text-xs text-amber-600">Calendario non collegato</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnectCalendar(agent.id)}
                      disabled={connectingAgentId === agent.id}
                      className="h-8 px-3 text-xs text-green-600 border-green-300 hover:bg-green-50"
                    >
                      {connectingAgentId === agent.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Link className="h-3.5 w-3.5 mr-1" />
                      )}
                      Collega Calendar
                    </Button>
                  </div>
                ))}
              </div>
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
              <div className="mt-2.5 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white rounded-lg border border-blue-100">
                    <p className="text-base font-bold text-blue-600">{statsData.totalBookings}</p>
                    <p className="text-xs text-slate-500">Totale</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg border border-blue-100">
                    <p className="text-base font-bold text-green-600">{statsData.todayBookings}</p>
                    <p className="text-xs text-slate-500">Oggi</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg border border-blue-100">
                    <p className="text-base font-bold text-indigo-600">{statsData.activeMembers}</p>
                    <p className="text-xs text-slate-500">Attivi</p>
                  </div>
                </div>

                {statsData.distribution.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-600">Distribuzione:</p>
                    {statsData.distribution.map((d) => (
                      <div key={d.agentConfigId} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-24 truncate">{d.agentName}</span>
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.max(d.sharePercent, 2)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{d.sharePercent}%</span>
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
  onConnectCalendar,
  isUpdating,
  isConnecting,
  totalWeight,
}: {
  member: PoolMember;
  strategy: string;
  expanded: boolean;
  onUpdate: (data: any) => void;
  onRemove: () => void;
  onReset: () => void;
  onConnectCalendar: () => void;
  isUpdating: boolean;
  isConnecting: boolean;
  totalWeight: number;
}) {
  const [editWeight, setEditWeight] = useState(member.weight);
  const [editMaxDaily, setEditMaxDaily] = useState(member.maxDailyBookings);

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        member.isPaused
          ? "bg-amber-50/50 border-amber-200"
          : member.isActive
            ? "bg-white border-blue-200"
            : "bg-slate-50 border-slate-200 opacity-60"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 truncate">{member.agentName}</span>
            {member.isStandalone && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Esterno</span>
            )}
            {member.isPaused && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">In pausa</span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            {member.hasCalendar ? (
              <span className="text-xs text-slate-500">
                {member.totalBookingsCount} totali | {member.todayBookingsCount}/{member.maxDailyBookings} oggi
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">Calendario non collegato</span>
            )}
            {strategy === "weighted" && (
              <span className="text-xs text-blue-500 font-semibold">
                peso: {member.weight} ({totalWeight > 0 ? ((member.weight / totalWeight) * 100).toFixed(1) : 0}%)
              </span>
            )}
          </div>
          {member.hasCalendar && member.googleCalendarEmail && (
            <p className="text-xs text-green-600 truncate mt-0.5">{member.googleCalendarEmail}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!member.hasCalendar && (
            <Button
              size="sm"
              variant="outline"
              onClick={onConnectCalendar}
              disabled={isConnecting}
              className="h-8 px-3 text-xs text-green-600 border-green-300 hover:bg-green-50"
            >
              {isConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Link className="h-3.5 w-3.5 mr-1" />
                  Collega
                </>
              )}
            </Button>
          )}
          <button
            onClick={() => onUpdate({ isPaused: !member.isPaused })}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title={member.isPaused ? "Riattiva" : "Metti in pausa"}
          >
            {member.isPaused ? (
              <Play className="h-4 w-4 text-green-500" />
            ) : (
              <Pause className="h-4 w-4 text-amber-500" />
            )}
          </button>
          {expanded && (
            <>
              <button
                onClick={onReset}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                title="Reset contatore"
              >
                <RotateCcw className="h-4 w-4 text-slate-400" />
              </button>
              <button
                onClick={onRemove}
                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Rimuovi dal pool"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2.5">
          {strategy === "weighted" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Peso (priorità)</span>
                <span className="text-xs font-semibold text-blue-600">{editWeight}</span>
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
          <div className="space-y-1.5">
            <span className="text-xs text-slate-500">Max appuntamenti/giorno</span>
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
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
