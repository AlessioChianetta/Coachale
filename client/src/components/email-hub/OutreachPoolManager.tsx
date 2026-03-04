import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  Layers, Plus, Trash2, UserMinus, Settings, Globe, CheckCircle,
  XCircle, RotateCcw, Info, BarChart2, ChevronRight, Loader2, Edit2
} from "lucide-react";

interface PoolAccount {
  id: string;
  emailAddress: string;
  displayName: string | null;
  provider: string;
  isOutreachSender: boolean;
  dailySendLimit: number;
  dailySendCount: number;
  lastSendResetDate: string | null;
  isActive: boolean;
  smtpHost: string | null;
}

interface Pool {
  id: string;
  poolName: string;
  trackingDomain: string | null;
  salesContext: Record<string, string> | null;
  customInstructions: string | null;
  isActive: boolean;
  accounts: PoolAccount[];
  totalSendToday: number;
  totalLimit: number;
}

interface EmailAccount {
  id: string;
  emailAddress: string;
  displayName: string | null;
  smtpHost: string | null;
  outreachPoolId: string | null;
}

export default function OutreachPoolManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState<string | null>(null);
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [limitEditing, setLimitEditing] = useState<{ accountId: string; poolId: string; value: number } | null>(null);

  const [newPool, setNewPool] = useState({ poolName: "", trackingDomain: "", customInstructions: "" });
  const [addAccountData, setAddAccountData] = useState({ accountId: "", dailySendLimit: 50 });
  const [editPool, setEditPool] = useState<Partial<Pool>>({});

  const { data: poolsData, isLoading } = useQuery<{ success: boolean; pools: Pool[] }>({
    queryKey: ["/api/email-hub/pools"],
  });

  const { data: accountsData } = useQuery<{ success: boolean; data: EmailAccount[] }>({
    queryKey: ["/api/email-hub/accounts"],
  });

  const pools = poolsData?.pools || [];
  const allAccounts: EmailAccount[] = accountsData?.data || [];
  const freeAccounts = allAccounts.filter(
    (a) => !a.outreachPoolId && a.smtpHost
  );

  const createMutation = useMutation({
    mutationFn: (data: typeof newPool) =>
      apiRequest("POST", "/api/email-hub/pools", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      setCreateDialogOpen(false);
      setNewPool({ poolName: "", trackingDomain: "", customInstructions: "" });
      toast({ title: "Pool creato con successo" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: Partial<Pool> }) =>
      apiRequest("PUT", `/api/email-hub/pools/${poolId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      setEditPoolId(null);
      toast({ title: "Pool aggiornato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (poolId: string) => apiRequest("DELETE", `/api/email-hub/pools/${poolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      toast({ title: "Pool eliminato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const addAccountMutation = useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: typeof addAccountData }) =>
      apiRequest("POST", `/api/email-hub/pools/${poolId}/accounts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      setAddAccountDialogOpen(null);
      setAddAccountData({ accountId: "", dailySendLimit: 50 });
      toast({ title: "Account aggiunto al pool" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const removeAccountMutation = useMutation({
    mutationFn: ({ poolId, accountId }: { poolId: string; accountId: string }) =>
      apiRequest("DELETE", `/api/email-hub/pools/${poolId}/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      toast({ title: "Account rimosso dal pool" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ poolId, accountId, dailySendLimit }: { poolId: string; accountId: string; dailySendLimit: number }) =>
      apiRequest("PATCH", `/api/email-hub/pools/${poolId}/accounts/${accountId}`, { dailySendLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/pools"] });
      setLimitEditing(null);
      toast({ title: "Limite aggiornato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pool di Outreach</h2>
          <p className="text-sm text-muted-foreground">
            Raggruppa più account email per la rotazione automatica di Hunter
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Pool
        </Button>
      </div>

      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">Come funziona</p>
          <p>
            Hunter seleziona automaticamente l'account con meno invii oggi. Configura il <strong>Custom Tracking Domain</strong> per nascondere i pixel di tracciamento e migliorare la deliverability.
            Per il tracking domain imposta nel tuo DNS un record CNAME: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">track.tuodominio.it</code> → hostname della piattaforma.
          </p>
        </div>
      </div>

      {pools.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessun pool configurato.</p>
            <p className="text-xs text-muted-foreground mt-1">Crea un pool e aggiungi almeno 5 account email scaldati.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pools.map((pool) => (
            <Card key={pool.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{pool.poolName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {pool.trackingDomain ? (
                          <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            {pool.trackingDomain}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 text-orange-600 border-orange-300">
                            <XCircle className="w-3 h-3" />
                            Tracking domain non configurato
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {pool.accounts.length} account
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditPoolId(pool.id);
                        setEditPool({
                          poolName: pool.poolName,
                          trackingDomain: pool.trackingDomain || "",
                          customInstructions: pool.customInstructions || "",
                          salesContext: pool.salesContext || {},
                        });
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Eliminare il pool "${pool.poolName}"? Gli account resteranno ma non saranno più nel pool.`)) {
                          deleteMutation.mutate(pool.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" />
                      Invii oggi: {pool.totalSendToday} / {pool.totalLimit}
                    </span>
                    <span>{pool.totalLimit > 0 ? Math.round((pool.totalSendToday / pool.totalLimit) * 100) : 0}%</span>
                  </div>
                  <Progress
                    value={pool.totalLimit > 0 ? (pool.totalSendToday / pool.totalLimit) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                {pool.accounts.length > 0 ? (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Account</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Oggi</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Limite</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Stato</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pool.accounts.map((acc) => {
                          const sendCount = acc.lastSendResetDate !== today ? 0 : acc.dailySendCount;
                          const pct = acc.dailySendLimit > 0 ? (sendCount / acc.dailySendLimit) * 100 : 0;
                          const isEditing = limitEditing?.accountId === acc.id && limitEditing?.poolId === pool.id;

                          return (
                            <tr key={acc.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2">
                                <div>
                                  <p className="font-medium truncate max-w-[180px]">{acc.emailAddress}</p>
                                  {acc.displayName && (
                                    <p className="text-xs text-muted-foreground">{acc.displayName}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div>
                                  <span className={`font-semibold ${pct >= 100 ? "text-red-600" : pct >= 80 ? "text-orange-600" : "text-foreground"}`}>
                                    {sendCount}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <Input
                                      type="number"
                                      className="w-16 h-7 text-xs text-center"
                                      value={limitEditing.value}
                                      min={1}
                                      max={500}
                                      onChange={(e) =>
                                        setLimitEditing((prev) => prev ? { ...prev, value: Number(e.target.value) } : null)
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() =>
                                        updateLimitMutation.mutate({
                                          poolId: pool.id,
                                          accountId: acc.id,
                                          dailySendLimit: limitEditing.value,
                                        })
                                      }
                                      disabled={updateLimitMutation.isPending}
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setLimitEditing(null)}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="text-xs hover:underline"
                                    onClick={() =>
                                      setLimitEditing({ accountId: acc.id, poolId: pool.id, value: acc.dailySendLimit })
                                    }
                                  >
                                    {acc.dailySendLimit}/giorno
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center hidden sm:table-cell">
                                {pct >= 100 ? (
                                  <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Limite raggiunto</Badge>
                                ) : !acc.smtpHost ? (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">No SMTP</Badge>
                                ) : (
                                  <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    Attivo
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    removeAccountMutation.mutate({ poolId: pool.id, accountId: acc.id })
                                  }
                                  disabled={removeAccountMutation.isPending}
                                >
                                  <UserMinus className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">Nessun account nel pool</p>
                    <p className="text-xs text-muted-foreground mt-1">Aggiungi almeno 5 account scaldati per la rotazione</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddAccountDialogOpen(pool.id);
                      setAddAccountData({ accountId: "", dailySendLimit: 50 });
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Aggiungi Account
                  </Button>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="millie" className="border rounded-lg px-3">
                    <AccordionTrigger className="text-sm py-2 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        Personalità Millie condivisa
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-3 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Millie userà queste istruzioni quando risponde a email ricevute in risposta agli outreach di questo pool.
                      </p>
                      <div>
                        <Label className="text-xs">Istruzioni personalizzate</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          rows={4}
                          placeholder="Es: Sei un consulente finanziario esperto. Rispondi in modo professionale e caldo..."
                          defaultValue={pool.customInstructions || ""}
                          onBlur={(e) => {
                            if (e.target.value !== pool.customInstructions) {
                              updateMutation.mutate({
                                poolId: pool.id,
                                data: { customInstructions: e.target.value },
                              });
                            }
                          }}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Pool Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Nuovo Pool</DialogTitle>
            <DialogDescription>
              Raggruppa più account email per la rotazione automatica degli outreach
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome Pool *</Label>
              <Input
                placeholder="Es: Consulenza Finanziaria Q1"
                value={newPool.poolName}
                onChange={(e) => setNewPool((p) => ({ ...p, poolName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Custom Tracking Domain
              </Label>
              <Input
                placeholder="track.tuodominio.it"
                value={newPool.trackingDomain}
                onChange={(e) => setNewPool((p) => ({ ...p, trackingDomain: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Configura un CNAME nel tuo DNS per nascondere i pixel di tracciamento. Lascia vuoto per disattivare il tracking.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Istruzioni Millie (opzionale)</Label>
              <Textarea
                rows={3}
                placeholder="Istruzioni per la risposta AI quando un lead risponde..."
                value={newPool.customInstructions}
                onChange={(e) => setNewPool((p) => ({ ...p, customInstructions: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annulla</Button>
            <Button
              onClick={() => createMutation.mutate(newPool)}
              disabled={!newPool.poolName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea Pool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pool Dialog */}
      <Dialog open={!!editPoolId} onOpenChange={(o) => !o && setEditPoolId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome Pool</Label>
              <Input
                value={(editPool.poolName as string) || ""}
                onChange={(e) => setEditPool((p) => ({ ...p, poolName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Custom Tracking Domain</Label>
              <Input
                placeholder="track.tuodominio.it"
                value={(editPool.trackingDomain as string) || ""}
                onChange={(e) => setEditPool((p) => ({ ...p, trackingDomain: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Istruzioni Millie</Label>
              <Textarea
                rows={4}
                value={(editPool.customInstructions as string) || ""}
                onChange={(e) => setEditPool((p) => ({ ...p, customInstructions: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPoolId(null)}>Annulla</Button>
            <Button
              onClick={() => editPoolId && updateMutation.mutate({ poolId: editPoolId, data: editPool })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Account to Pool Dialog */}
      <Dialog open={!!addAccountDialogOpen} onOpenChange={(o) => !o && setAddAccountDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Account al Pool</DialogTitle>
            <DialogDescription>
              Seleziona un account email con SMTP configurato e imposta il limite giornaliero
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Account Email *</Label>
              {freeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 border rounded-lg">
                  Nessun account disponibile. Tutti gli account SMTP sono già assegnati a un pool o non hanno SMTP configurato.
                </p>
              ) : (
                <Select
                  value={addAccountData.accountId}
                  onValueChange={(v) => setAddAccountData((p) => ({ ...p, accountId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {freeAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.emailAddress}
                        {acc.displayName ? ` (${acc.displayName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Limite invii/giorno</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={addAccountData.dailySendLimit}
                  onChange={(e) => setAddAccountData((p) => ({ ...p, dailySendLimit: Number(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">email/giorno (consigliato: 30–50 per account scaldato)</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountDialogOpen(null)}>Annulla</Button>
            <Button
              disabled={!addAccountData.accountId || addAccountMutation.isPending}
              onClick={() =>
                addAccountDialogOpen &&
                addAccountMutation.mutate({ poolId: addAccountDialogOpen, data: addAccountData })
              }
            >
              {addAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
