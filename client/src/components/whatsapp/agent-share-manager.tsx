import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Share2, Copy, Code, Eye, EyeOff, Trash2, BarChart3, Globe, Lock, X, Plus, Check, Users, UserPlus, Search, Edit, Key, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';

interface AgentShare {
  id: string;
  slug: string;
  agentName: string;
  accessType: 'public' | 'password' | 'token';
  isActive: boolean;
  allowedDomains: string[];
  expireAt: string | null;
  totalAccessCount: number;
  uniqueVisitorsCount: number;
  totalMessagesCount: number;
  publicUrl: string;
  createdAt: string;
  requiresLogin?: boolean;
  assignedManagers?: Manager[];
}

interface Manager {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'invited' | 'suspended';
  agentsAssigned: number;
  createdAt: string;
}

interface ManagerAssignment {
  managerId: string;
  shareId: string;
}

interface AgentConfig {
  id: string;
  name: string;
}

interface AgentShareManagerProps {
  agentId: string;
  agentName: string;
  onClose?: () => void;
}

export function AgentShareManager({ agentId, agentName, onClose }: AgentShareManagerProps) {
  const [shares, setShares] = useState<AgentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [iframeDialogOpen, setIframeDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<AgentShare | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [activeTab, setActiveTab] = useState('shares');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [accessType, setAccessType] = useState<'public' | 'password'>('public');
  const [shareMode, setShareMode] = useState<'public' | 'manager'>('public');
  const [password, setPassword] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [expireDays, setExpireDays] = useState('');
  
  const MAX_SHARES_PER_AGENT = 2;

  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    sendEmail: true,
    selectedAgents: [] as string[]
  });
  const [assignManagerDialogOpen, setAssignManagerDialogOpen] = useState(false);
  const [selectedShareForAssignment, setSelectedShareForAssignment] = useState<AgentShare | null>(null);

  const { data: managers = [], isLoading: managersLoading, refetch: refetchManagers } = useQuery<Manager[]>({
    queryKey: ['/api/managers'],
    queryFn: async () => {
      const res = await fetch('/api/managers', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore caricamento manager');
      const data = await res.json();
      return data.managers || [];
    },
    enabled: activeTab === 'managers',
  });

  // Use the current agent from props - no need to fetch
  const currentAgent: AgentConfig = { id: agentId, name: agentName };
  
  // Auto-select current agent when drawer opens
  useEffect(() => {
    if (inviteDrawerOpen && agentId && !inviteForm.selectedAgents.includes(agentId)) {
      setInviteForm(prev => ({
        ...prev,
        selectedAgents: [agentId]
      }));
    }
  }, [inviteDrawerOpen, agentId]);

  const createManagerMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; sendEmail: boolean; agentIds: string[] }) => {
      const res = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore creazione manager');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Manager Invitato',
        description: 'Invito inviato con successo',
      });
      setInviteDrawerOpen(false);
      setInviteForm({ name: '', email: '', password: '', confirmPassword: '', sendEmail: true, selectedAgents: [] });
      refetchManagers();
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: string) => {
      const res = await fetch(`/api/managers/${managerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore eliminazione manager');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Manager Eliminato',
        description: 'Manager rimosso con successo',
      });
      refetchManagers();
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ managerId, shareId }: ManagerAssignment) => {
      const res = await fetch(`/api/managers/${managerId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) throw new Error('Errore assegnazione manager');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Manager Assegnato',
        description: 'Manager assegnato al link',
      });
      fetchShares();
      setAssignManagerDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const unassignManagerMutation = useMutation({
    mutationFn: async ({ managerId, shareId }: ManagerAssignment) => {
      const res = await fetch(`/api/managers/${managerId}/assignments/${shareId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Errore rimozione assegnazione');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Assegnazione Rimossa',
        description: 'Manager rimosso dal link',
      });
      fetchShares();
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    fetchShares();
  }, []);

  const fetchShares = async () => {
    try {
      const res = await fetch('/api/whatsapp/agent-share', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Errore caricamento condivisioni');
      
      const data = await res.json();
      const agentShares = data.shares.filter((s: AgentShare) => s.agent?.id === agentId);
      setShares(agentShares);
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createShare = async () => {
    try {
      // Check limit
      if (nonRevokedShares.length >= MAX_SHARES_PER_AGENT) {
        toast({
          title: 'Limite Raggiunto',
          description: `Puoi creare massimo ${MAX_SHARES_PER_AGENT} link per agente. Elimina un link esistente per crearne uno nuovo.`,
          variant: 'destructive',
        });
        return;
      }

      const body: any = {
        agentConfigId: agentId,
        accessType,
        requiresLogin: shareMode === 'manager',
      };

      if (accessType === 'password') {
        if (!password) {
          toast({
            title: 'Errore',
            description: 'Password richiesta per accesso protetto',
            variant: 'destructive',
          });
          return;
        }
        body.password = password;
      }

      if (allowedDomains) {
        body.allowedDomains = allowedDomains.split(',').map(d => d.trim()).filter(Boolean);
      }

      if (expireDays) {
        const expireAt = new Date();
        expireAt.setDate(expireAt.getDate() + parseInt(expireDays));
        body.expireAt = expireAt.toISOString();
      }

      const res = await fetch('/api/whatsapp/agent-share', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore creazione condivisione');
      }

      const data = await res.json();
      
      toast({
        title: 'Condivisione creata',
        description: 'Link pubblico generato con successo',
      });

      setCreateDialogOpen(false);
      setPassword('');
      setAllowedDomains('');
      setExpireDays('');
      fetchShares();
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleShareActive = async (shareId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/agent-share/${shareId}/toggle`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Errore toggle condivisione');

      toast({
        title: 'Aggiornato',
        description: 'Stato condivisione aggiornato',
      });

      fetchShares();
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleRequiresLogin = async (shareId: string, requiresLogin: boolean) => {
    try {
      const res = await fetch(`/api/whatsapp/agent-share/${shareId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ requiresLogin }),
      });

      if (!res.ok) throw new Error('Errore aggiornamento condivisione');

      toast({
        title: 'Aggiornato',
        description: requiresLogin ? 'Login richiesto abilitato' : 'Login richiesto disabilitato',
      });

      fetchShares();
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const revokeShare = async (shareId: string) => {
    if (!confirm('Sei sicuro di voler revocare questa condivisione?')) return;

    try {
      const res = await fetch(`/api/whatsapp/agent-share/${shareId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Revocato manualmente dal consultant' }),
      });

      if (!res.ok) throw new Error('Errore revoca condivisione');

      toast({
        title: 'Condivisione revocata',
        description: 'Link pubblico disattivato',
      });

      fetchShares();
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'iframe' = 'url') => {
    navigator.clipboard.writeText(text);
    
    if (type === 'url') {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }

    toast({
      title: 'Copiato!',
      description: type === 'url' ? 'Link copiato negli appunti' : 'Codice iframe copiato',
    });
  };

  const getIframeCode = (shareUrl: string) => {
    const embedUrl = `${shareUrl}?embed=true`;
    return `<iframe 
  src="${embedUrl}"
  loading="lazy"
  allow="clipboard-write; microphone"
  style="
    width: 100%;
    max-width: 420px;
    height: 600px;
    min-height: 400px;
    border: none;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  "
></iframe>`;
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInviteForm(prev => ({ ...prev, password, confirmPassword: password }));
  };

  const handleInviteSubmit = () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.password) {
      toast({
        title: 'Errore',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive',
      });
      return;
    }

    if (inviteForm.password !== inviteForm.confirmPassword) {
      toast({
        title: 'Errore',
        description: 'Le password non corrispondono',
        variant: 'destructive',
      });
      return;
    }

    createManagerMutation.mutate({
      name: inviteForm.name,
      email: inviteForm.email,
      password: inviteForm.password,
      sendEmail: inviteForm.sendEmail,
      agentIds: inviteForm.selectedAgents,
    });
  };

  const handleDeleteManager = (managerId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo manager?')) return;
    deleteManagerMutation.mutate(managerId);
  };

  const filteredManagers = managers.filter(m => 
    m.name.toLowerCase().includes(managerSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(managerSearch.toLowerCase())
  );

  const managerStats = {
    total: managers.length,
    active: managers.filter(m => m.status === 'active').length,
    invited: managers.filter(m => m.status === 'invited').length,
  };

  const getStatusBadge = (status: Manager['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">Attivo</Badge>;
      case 'invited':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Invitato</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Sospeso</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </CardContent>
      </Card>
    );
  }

  const activeShare = shares.find(s => s.isActive && !s.revokedAt);
  const nonRevokedShares = shares.filter(s => !s.revokedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestione Condivisione</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci condivisioni pubbliche e manager autorizzati
          </p>
        </div>

        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shares" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Condivisioni
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shares" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {nonRevokedShares.length} / {MAX_SHARES_PER_AGENT} link creati
            </div>
            {nonRevokedShares.length < MAX_SHARES_PER_AGENT && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-cyan-500 hover:bg-cyan-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuovo Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Crea Nuovo Link</DialogTitle>
                    <DialogDescription>
                      Scegli come vuoi condividere l'accesso a "{agentName}"
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Modalità di Accesso</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          onClick={() => setShareMode('public')}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            shareMode === 'public' 
                              ? 'border-cyan-500 bg-cyan-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Globe className={`w-8 h-8 mb-2 ${shareMode === 'public' ? 'text-cyan-500' : 'text-gray-400'}`} />
                          <p className="font-medium">Pubblico</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Chiunque con il link può accedere senza login
                          </p>
                        </div>
                        <div
                          onClick={() => setShareMode('manager')}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            shareMode === 'manager' 
                              ? 'border-teal-500 bg-teal-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Users className={`w-8 h-8 mb-2 ${shareMode === 'manager' ? 'text-teal-500' : 'text-gray-400'}`} />
                          <p className="font-medium">Solo Manager</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Richiede login con credenziali manager
                          </p>
                        </div>
                      </div>
                    </div>

                    {shareMode === 'public' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Nota:</strong> Il link pubblico permette a chiunque di chattare con l'agente. Le conversazioni non saranno salvate.
                        </p>
                      </div>
                    )}

                    {shareMode === 'manager' && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                        <p className="text-sm text-teal-800">
                          <strong>Nota:</strong> I manager potranno accedere con le loro credenziali. Le conversazioni saranno salvate nel loro storico.
                        </p>
                      </div>
                    )}

                    <div>
                      <Label>Protezione Password (opzionale)</Label>
                      <Select value={accessType} onValueChange={(v: any) => setAccessType(v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Nessuna password aggiuntiva</SelectItem>
                          <SelectItem value="password">Richiedi password per accedere</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {accessType === 'password' && (
                      <div>
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Inserisci password"
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Domini Autorizzati (opzionale)</Label>
                      <Input
                        value={allowedDomains}
                        onChange={(e) => setAllowedDomains(e.target.value)}
                        placeholder="example.com, mysite.com"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Utile per embed iframe. Lascia vuoto per tutti i domini.
                      </p>
                    </div>

                    <div>
                      <Label>Scadenza (giorni)</Label>
                      <Input
                        type="number"
                        value={expireDays}
                        onChange={(e) => setExpireDays(e.target.value)}
                        placeholder="Nessuna scadenza"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button 
                      onClick={createShare}
                      className={shareMode === 'manager' ? 'bg-teal-500 hover:bg-teal-600' : 'bg-cyan-500 hover:bg-cyan-600'}
                    >
                      Crea Link {shareMode === 'manager' ? 'Manager' : 'Pubblico'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {nonRevokedShares.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Nessuna condivisione attiva. Crea la prima per generare un link pubblico.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {nonRevokedShares.map((share) => (
                <Card key={share.id} className={`border-l-4 ${share.requiresLogin ? 'border-l-teal-500' : 'border-l-cyan-500'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            className={share.requiresLogin 
                              ? 'bg-teal-500 hover:bg-teal-600' 
                              : 'bg-cyan-500 hover:bg-cyan-600'
                            }
                          >
                            {share.requiresLogin ? (
                              <>
                                <Users className="w-3 h-3 mr-1" />
                                Solo Manager
                              </>
                            ) : (
                              <>
                                <Globe className="w-3 h-3 mr-1" />
                                Pubblico
                              </>
                            )}
                          </Badge>
                          <Badge variant={share.isActive ? 'default' : 'secondary'}>
                            {share.isActive ? 'Attivo' : 'Disattivato'}
                          </Badge>
                          {share.accessType === 'password' && (
                            <Badge variant="outline">
                              <Lock className="w-3 h-3 mr-1" />
                              Password
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-2">
                          Creato il {new Date(share.createdAt).toLocaleDateString('it-IT')}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleShareActive(share.id)}
                          title={share.isActive ? 'Disattiva' : 'Attiva'}
                        >
                          {share.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeShare(share.id)}
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Link Pubblico</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={share.publicUrl}
                          readOnly
                          className="font-mono text-xs sm:text-sm truncate"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(share.publicUrl)}
                          className="shrink-0"
                        >
                          {copiedUrl === share.publicUrl ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Codice Iframe Embed</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs sm:text-sm"
                          onClick={() => {
                            setSelectedShare(share);
                            setIframeDialogOpen(true);
                          }}
                        >
                          <Code className="w-4 h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Visualizza</span> Codice
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t">
                      <div className="text-center sm:text-left">
                        <p className="text-lg sm:text-2xl font-bold">{share.totalAccessCount}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Visite</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-lg sm:text-2xl font-bold">{share.uniqueVisitorsCount}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Unici</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-lg sm:text-2xl font-bold">{share.totalMessagesCount}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Messaggi</p>
                      </div>
                    </div>

                    {share.allowedDomains && share.allowedDomains.length > 0 && (
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">Domini Autorizzati</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {share.allowedDomains.map((domain, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {domain}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {share.expireAt && (
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">Scadenza</Label>
                        <p className="text-sm mt-1">
                          {new Date(share.expireAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    )}

                    {share.requiresLogin && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-teal-600" />
                            Manager Autorizzati
                          </Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedShareForAssignment(share);
                              setAssignManagerDialogOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Aggiungi
                          </Button>
                        </div>

                        {share.assignedManagers && share.assignedManagers.length > 0 ? (
                          <div className="space-y-2">
                            {share.assignedManagers.map((manager) => (
                              <div
                                key={manager.id}
                                className="flex items-center justify-between p-2 bg-teal-50 rounded border border-teal-200"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                    <span className="text-sm font-medium text-teal-700">
                                      {manager.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{manager.name}</p>
                                    <p className="text-xs text-muted-foreground">{manager.email}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => unassignManagerMutation.mutate({ managerId: manager.id, shareId: share.id })}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">
                              Nessun manager assegnato. Aggiungi manager per permettere l'accesso a questo link.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="managers" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-teal-500 rounded-lg">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-lg sm:text-2xl font-bold text-teal-700">{managerStats.total}</p>
                    <p className="text-[10px] sm:text-xs text-teal-600">Totali</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-cyan-500 rounded-lg">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-lg sm:text-2xl font-bold text-cyan-700">{managerStats.active}</p>
                    <p className="text-[10px] sm:text-xs text-cyan-600">Attivi</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-slate-500 rounded-lg">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-lg sm:text-2xl font-bold text-slate-700">{managerStats.invited}</p>
                    <p className="text-[10px] sm:text-xs text-slate-600">Invitati</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca manager..."
                value={managerSearch}
                onChange={(e) => setManagerSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setInviteDrawerOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invita Manager
            </Button>
          </div>

          {managersLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Caricamento manager...</p>
              </CardContent>
            </Card>
          ) : filteredManagers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {managerSearch ? 'Nessun manager trovato' : 'Nessun manager. Invita il primo manager.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Agenti Assegnati</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManagers.map((manager) => (
                    <TableRow key={manager.id}>
                      <TableCell className="font-medium">{manager.name}</TableCell>
                      <TableCell>{manager.email}</TableCell>
                      <TableCell>{getStatusBadge(manager.status)}</TableCell>
                      <TableCell>{manager.agentsAssigned}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteManager(manager.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={inviteDrawerOpen} onOpenChange={setInviteDrawerOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Invita Manager</SheetTitle>
            <SheetDescription>
              Crea un nuovo account manager per gestire gli agenti
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={inviteForm.name}
                onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="email@esempio.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button variant="outline" size="icon" onClick={generatePassword}>
                  <Key className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conferma Password *</Label>
              <Input
                type="password"
                placeholder="Conferma password"
                value={inviteForm.confirmPassword}
                onChange={(e) => setInviteForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Agente Assegnato</Label>
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`agent-${currentAgent.id}`}
                    checked={inviteForm.selectedAgents.includes(currentAgent.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setInviteForm(prev => ({
                          ...prev,
                          selectedAgents: [...prev.selectedAgents, currentAgent.id]
                        }));
                      } else {
                        setInviteForm(prev => ({
                          ...prev,
                          selectedAgents: prev.selectedAgents.filter(id => id !== currentAgent.id)
                        }));
                      }
                    }}
                  />
                  <label
                    htmlFor={`agent-${currentAgent.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {currentAgent.name}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Il manager avrà accesso a questo agente
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="send-email"
                checked={inviteForm.sendEmail}
                onCheckedChange={(checked) => setInviteForm(prev => ({ ...prev, sendEmail: !!checked }))}
              />
              <label
                htmlFor="send-email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Invia email con credenziali
              </label>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setInviteDrawerOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleInviteSubmit}
              disabled={createManagerMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {createManagerMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invita Manager
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={assignManagerDialogOpen} onOpenChange={setAssignManagerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna Manager</DialogTitle>
            <DialogDescription>
              Seleziona i manager da autorizzare per questo link
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {managers.filter(m => m.status === 'active').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun manager attivo disponibile
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {managers
                  .filter(m => m.status === 'active')
                  .filter(m => !selectedShareForAssignment?.assignedManagers?.some(am => am.id === m.id))
                  .map((manager) => (
                    <div
                      key={manager.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        if (selectedShareForAssignment) {
                          assignManagerMutation.mutate({
                            managerId: manager.id,
                            shareId: selectedShareForAssignment.id
                          });
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-cyan-700">
                            {manager.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{manager.name}</p>
                          <p className="text-sm text-muted-foreground">{manager.email}</p>
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-cyan-500" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignManagerDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={iframeDialogOpen} onOpenChange={setIframeDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Codice Iframe Embed</DialogTitle>
            <DialogDescription>
              Copia e incolla questo codice nel tuo sito web per integrare l'agente
            </DialogDescription>
          </DialogHeader>

          {selectedShare && (
            <div className="space-y-4">
              <div>
                <Label>Codice HTML</Label>
                <Textarea
                  value={getIframeCode(selectedShare.publicUrl)}
                  readOnly
                  className="font-mono text-sm h-32 mt-2"
                />
              </div>

              <Button
                onClick={() => copyToClipboard(getIframeCode(selectedShare.publicUrl), 'iframe')}
                className="w-full"
              >
                {copiedIframe ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copiato!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copia Codice
                  </>
                )}
              </Button>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Istruzioni:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copia il codice sopra</li>
                  <li>Incollalo nell'HTML del tuo sito web dove vuoi mostrare la chat</li>
                  <li>L'agente verrà visualizzato in un iframe responsive</li>
                  {selectedShare.allowedDomains && selectedShare.allowedDomains.length > 0 && (
                    <li className="text-orange-600">
                      Assicurati che il tuo dominio sia nella whitelist: {selectedShare.allowedDomains.join(', ')}
                    </li>
                  )}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
