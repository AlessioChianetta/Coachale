import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Share2, Copy, Code, Eye, EyeOff, Trash2, BarChart3, Globe, Lock, X, Plus, Check } from 'lucide-react';
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
}

interface AgentShareManagerProps {
  agentConfigId: string;
  agentName: string;
}

export function AgentShareManager({ agentConfigId, agentName }: AgentShareManagerProps) {
  const [shares, setShares] = useState<AgentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [iframeDialogOpen, setIframeDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<AgentShare | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const { toast } = useToast();

  // Create share form state
  const [accessType, setAccessType] = useState<'public' | 'password'>('public');
  const [password, setPassword] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [expireDays, setExpireDays] = useState('');

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
      // Filter shares for this agent
      const agentShares = data.shares.filter((s: AgentShare) => s.agent?.id === agentConfigId);
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
      const body: any = {
        agentConfigId,
        accessType,
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
  width="400" 
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border: none; border-radius: 8px;"
></iframe>`;
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
          <h3 className="text-lg font-semibold">Condivisione Pubblica</h3>
          <p className="text-sm text-muted-foreground">
            Condividi questo agente tramite link pubblico o iframe embed
          </p>
        </div>

        {!activeShare && nonRevokedShares.length === 0 && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crea Condivisione
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crea Condivisione Pubblica</DialogTitle>
                <DialogDescription>
                  Genera un link pubblico per permettere ai visitatori di chattare con "{agentName}"
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Tipo di Accesso</Label>
                  <Select value={accessType} onValueChange={(v: any) => setAccessType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center">
                          <Globe className="w-4 h-4 mr-2" />
                          <span>Pubblico - Accessibile a tutti</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="password">
                        <div className="flex items-center">
                          <Lock className="w-4 h-4 mr-2" />
                          <span>Protetto da Password</span>
                        </div>
                      </SelectItem>
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
                    />
                  </div>
                )}

                <div>
                  <Label>Domini Autorizzati (opzionale)</Label>
                  <Input
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    placeholder="example.com, mysite.com (separati da virgola)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lascia vuoto per permettere tutti i domini. Utile per embed iframe.
                  </p>
                </div>

                <div>
                  <Label>Scadenza (giorni)</Label>
                  <Input
                    type="number"
                    value={expireDays}
                    onChange={(e) => setExpireDays(e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lascia vuoto per nessuna scadenza
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={createShare}>
                  Crea Condivisione
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
            <Card key={share.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{share.agentName}</CardTitle>
                      <Badge variant={share.isActive ? 'default' : 'secondary'}>
                        {share.isActive ? 'Attivo' : 'Disattivato'}
                      </Badge>
                      <Badge variant="outline">
                        {share.accessType === 'public' ? (
                          <>
                            <Globe className="w-3 h-3 mr-1" />
                            Pubblico
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 mr-1" />
                            Password
                          </>
                        )}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Creato il {new Date(share.createdAt).toLocaleDateString('it-IT')}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleShareActive(share.id)}
                    >
                      {share.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeShare(share.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Public URL */}
                <div>
                  <Label className="text-xs text-muted-foreground">Link Pubblico</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={share.publicUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(share.publicUrl)}
                    >
                      {copiedUrl === share.publicUrl ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Iframe Embed */}
                <div>
                  <Label className="text-xs text-muted-foreground">Codice Iframe Embed</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedShare(share);
                        setIframeDialogOpen(true);
                      }}
                    >
                      <Code className="w-4 h-4 mr-2" />
                      Visualizza Codice
                    </Button>
                  </div>
                </div>

                {/* Analytics */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-2xl font-bold">{share.totalAccessCount}</p>
                    <p className="text-xs text-muted-foreground">Visite Totali</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{share.uniqueVisitorsCount}</p>
                    <p className="text-xs text-muted-foreground">Visitatori Unici</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{share.totalMessagesCount}</p>
                    <p className="text-xs text-muted-foreground">Messaggi</p>
                  </div>
                </div>

                {/* Domain Whitelist */}
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

                {/* Expiration */}
                {share.expireAt && (
                  <div className="pt-2">
                    <Label className="text-xs text-muted-foreground">Scadenza</Label>
                    <p className="text-sm mt-1">
                      {new Date(share.expireAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Iframe Dialog */}
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
