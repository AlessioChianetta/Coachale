import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Crown, Medal } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AgentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tier: "bronze" | "silver";
  isEnabled: boolean;
  createdAt: string | null;
}

interface AgentUsersSectionProps {
  agentId: string;
}

export function AgentUsersSection({ agentId }: AgentUsersSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "bronze" | "silver">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ users: AgentUser[]; agentLevels: string[] }>({
    queryKey: ["/api/whatsapp/agents", agentId, "users"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/agents/${agentId}/users`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!agentId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ userId, isEnabled, tier }: { userId: string; isEnabled: boolean; tier: "bronze" | "silver" }) => {
      const res = await fetch(`/api/whatsapp/agents/${agentId}/users/${userId}/toggle`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled, tier }),
      });
      if (!res.ok) throw new Error("Failed to toggle access");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/agents", agentId, "users"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile aggiornare l'accesso utente",
      });
    },
  });

  const users = data?.users || [];
  const agentLevels = data?.agentLevels || [];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTier = filterTier === "all" || user.tier === filterTier;

    return matchesSearch && matchesTier;
  });

  const bronzeCount = users.filter((u) => u.tier === "bronze").length;
  const silverCount = users.filter((u) => u.tier === "silver").length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca per nome o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <Tabs value={filterTier} onValueChange={(v) => setFilterTier(v as typeof filterTier)}>
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="all" className="text-xs">
            Tutti ({users.length})
          </TabsTrigger>
          <TabsTrigger value="bronze" className="text-xs">
            <Medal className="h-3 w-3 mr-1 text-amber-500" />
            Bronze ({bronzeCount})
          </TabsTrigger>
          <TabsTrigger value="silver" className="text-xs">
            <Crown className="h-3 w-3 mr-1 text-slate-400" />
            Silver ({silverCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Nessun utente trovato</p>
          <p className="text-xs text-slate-500 mt-1">
            {users.length === 0
              ? "Non ci sono ancora utenti Bronze o Silver"
              : "Prova a modificare i filtri di ricerca"}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                user.isEnabled
                  ? "bg-white border-slate-200"
                  : "bg-slate-50 border-slate-200 opacity-60"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                  user.tier === "bronze"
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                    : "bg-gradient-to-br from-slate-300 to-slate-500 text-white"
                )}
              >
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 font-medium",
                      user.tier === "bronze"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-300 bg-slate-100 text-slate-600"
                    )}
                  >
                    {user.tier === "bronze" ? "Bronze" : "Silver"}
                  </Badge>
                </div>
                {(user.firstName || user.lastName) && (
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                )}
              </div>

              <Switch
                checked={user.isEnabled}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ userId: user.id, isEnabled: checked, tier: user.tier })
                }
                disabled={toggleMutation.isPending}
                className={cn(
                  user.tier === "bronze"
                    ? "data-[state=checked]:bg-amber-500"
                    : "data-[state=checked]:bg-slate-500"
                )}
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 text-center pt-2 border-t">
        Disabilita l'accesso per impedire all'utente di usare questo agente.
      </p>
    </div>
  );
}
