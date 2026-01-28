import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Loader2,
  Send,
  Calendar,
  CheckCircle,
  AlertCircle,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  Clock,
  FileText,
  Video,
  Edit3,
  Eye,
  Save,
  Info,
  ImageIcon,
} from "lucide-react";

interface PublerAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUsername: string;
  profileImageUrl?: string;
  isActive: boolean;
}

// Helper per verificare se una piattaforma Publer è Instagram
// Publer usa identificatori come 'ig_business', 'ig_personal' invece di 'instagram'
function isInstagramPlatform(platform: string): boolean {
  return ['instagram', 'ig_business', 'ig_personal'].includes(platform);
}

// Helper per piattaforme che richiedono media (non supportano solo testo)
function platformRequiresMedia(platform: string): boolean {
  const mediaRequired = ['instagram', 'ig_business', 'ig_personal', 'pinterest', 'youtube', 'tiktok', 'tiktok_business'];
  return mediaRequired.includes(platform);
}

// Info sui requisiti delle piattaforme
interface PlatformInfo {
  name: string;
  requiresMedia: boolean;
  supportedTypes: string[];
  maxChars?: number;
  notes?: string;
}

function getPlatformInfo(platform: string): PlatformInfo {
  const normalized = platform.toLowerCase();
  
  if (['instagram', 'ig_business', 'ig_personal'].includes(normalized)) {
    return {
      name: 'Instagram',
      requiresMedia: true,
      supportedTypes: ['Immagine', 'Video', 'Carosello'],
      maxChars: 2200,
      notes: 'Richiede sempre un\'immagine o video'
    };
  }
  if (['facebook', 'fb_page', 'fb_group'].includes(normalized)) {
    return {
      name: 'Facebook',
      requiresMedia: false,
      supportedTypes: ['Testo', 'Immagine', 'Video', 'Link'],
      notes: 'Supporta post solo testo'
    };
  }
  if (['twitter', 'x'].includes(normalized)) {
    return {
      name: 'Twitter/X',
      requiresMedia: false,
      supportedTypes: ['Testo', 'Immagine', 'Video'],
      maxChars: 280,
      notes: 'Supporta post solo testo'
    };
  }
  if (['linkedin', 'linkedin_page'].includes(normalized)) {
    return {
      name: 'LinkedIn',
      requiresMedia: false,
      supportedTypes: ['Testo', 'Immagine', 'Video', 'Documento'],
      notes: 'Supporta post solo testo'
    };
  }
  if (normalized === 'pinterest') {
    return {
      name: 'Pinterest',
      requiresMedia: true,
      supportedTypes: ['Immagine', 'Video'],
      notes: 'Richiede sempre un\'immagine'
    };
  }
  if (normalized === 'youtube') {
    return {
      name: 'YouTube',
      requiresMedia: true,
      supportedTypes: ['Video'],
      notes: 'Richiede sempre un video'
    };
  }
  if (['tiktok', 'tiktok_business'].includes(normalized)) {
    return {
      name: 'TikTok',
      requiresMedia: true,
      supportedTypes: ['Video'],
      notes: 'Richiede sempre un video'
    };
  }
  return {
    name: platform,
    requiresMedia: false,
    supportedTypes: ['Testo', 'Immagine', 'Video']
  };
}

interface StructuredContent {
  copyType?: string;
  mediaType?: string;
  hook?: string;
  body?: string;
  cta?: string;
  chiCosaCome?: string;
  errore?: string;
  soluzione?: string;
  riprovaSociale?: string;
  videoHook?: string;
  videoProblema?: string;
  videoSoluzione?: string;
  videoCta?: string;
  videoFullScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
}

interface Post {
  id: string;
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  fullCopy?: string;
  videoFullScript?: string;
  imageDescription?: string;
  copyType?: string;
  mediaType?: string;
  platform?: string;
  structuredContent?: StructuredContent;
  chiCosaCome?: string;
  errore?: string;
  soluzione?: string;
  riprovaSociale?: string;
  publerMediaIds?: string[];
  scheduledAt?: string;
  scheduledDate?: string;
}

interface PublerPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
}

type ContentSource = "full_message" | "hook_cta" | "copy_complete" | "video_script" | "custom";
type PublishState = "draft" | "publish_now" | "scheduled";

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  linkedin: <Linkedin className="h-4 w-4 text-blue-700" />,
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-600" />,
};

function composeText(source: ContentSource, post: Post, customText: string): string {
  switch (source) {
    case "full_message": {
      // Prima cerca fullCopy (campo principale per copy completo dal DB)
      if (post.fullCopy) {
        // Se c'è fullCopy, combina con hook e cta se disponibili
        const parts = [
          post.hook,
          post.fullCopy,
          post.cta,
        ].filter(Boolean);
        return parts.join("\n\n");
      }
      
      // Fallback: combina tutti i campi strutturati disponibili
      const s = post.structuredContent || {};
      const parts = [
        post.hook || s.hook,
        post.body || s.body,
        post.chiCosaCome || s.chiCosaCome,
        post.errore || s.errore,
        post.soluzione || s.soluzione,
        post.riprovaSociale || s.riprovaSociale,
        post.cta || s.cta,
      ].filter(Boolean);
      // Se non ci sono parti, prova videoFullScript
      if (parts.length === 0) {
        return post.videoFullScript || s.videoFullScript || "";
      }
      return parts.join("\n\n");
    }
    case "hook_cta": {
      const parts = [post.hook, post.cta].filter(Boolean);
      if (parts.length === 0) {
        return post.body || post.structuredContent?.body || "";
      }
      return parts.join("\n\n");
    }
    case "copy_complete": {
      const s = post.structuredContent || {};
      const parts = [
        post.hook || s.hook,
        post.chiCosaCome || s.chiCosaCome,
        post.errore || s.errore,
        post.soluzione || s.soluzione,
        post.riprovaSociale || s.riprovaSociale,
        post.cta || s.cta,
      ].filter(Boolean);
      if (parts.length === 0) {
        return post.body || s.body || "";
      }
      return parts.join("\n\n");
    }
    case "video_script":
      return post.videoFullScript || post.structuredContent?.videoFullScript || post.hook || post.body || "";
    case "custom":
      return customText;
    default:
      return post.body || post.hook || "";
  }
}

export function PublerPublishDialog({ open, onOpenChange, post }: PublerPublishDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [contentSource, setContentSource] = useState<ContentSource>("full_message");
  const [customText, setCustomText] = useState("");
  const [publishState, setPublishState] = useState<PublishState>("publish_now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [usePlaceholderImage, setUsePlaceholderImage] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: configData } = useQuery<{ configured: boolean; isActive: boolean }>({
    queryKey: ["/api/publer/config"],
    queryFn: async () => {
      const res = await fetch("/api/publer/config", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento config");
      return res.json();
    },
    enabled: open,
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ accounts: PublerAccount[] }>({
    queryKey: ["/api/publer/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/publer/accounts", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento account");
      return res.json();
    },
    enabled: open && !!configData?.configured,
  });

  const uploadPlaceholderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/publer/upload-placeholder", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore caricamento immagine");
      }
      return res.json() as Promise<{ mediaId: string }>;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (data: {
      postId: string;
      accountIds: string[];
      accountPlatforms: { id: string; platform: string }[];
      text: string;
      state: PublishState;
      scheduledAt?: string;
      mediaIds?: string[];
    }) => {
      const res = await fetch("/api/publer/publish", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore pubblicazione");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      const messages: Record<PublishState, { title: string; description: string }> = {
        draft: { title: "Bozza salvata!", description: "Il post è stato salvato come bozza su Publer" },
        publish_now: { title: "Post pubblicato!", description: "Il post è stato pubblicato immediatamente" },
        scheduled: { title: "Post programmato!", description: "Il post è stato programmato per la pubblicazione" },
      };
      toast(messages[variables.state]);
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/posts"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      // Mostra errore come dialog di conferma (non toast che scompare)
      setErrorMessage(error.message);
      setErrorDialogOpen(true);
    },
  });

  const resetForm = () => {
    setSelectedAccounts([]);
    setContentSource("full_message");
    setCustomText("");
    setPublishState("publish_now");
    setScheduledAt("");
    setUsePlaceholderImage(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (open && post) {
      const initialText = composeText("full_message", post, "");
      setCustomText(initialText);
    }
  }, [open, post]);

  // Pre-compila la data programmata se il post ha già una scheduledAt
  useEffect(() => {
    if (open && post) {
      const postScheduledAt = post.scheduledAt || post.scheduledDate;
      if (postScheduledAt) {
        const date = new Date(postScheduledAt);
        // Formato per datetime-local: YYYY-MM-DDTHH:mm
        const formatted = date.toISOString().slice(0, 16);
        setScheduledAt(formatted);
        setPublishState("scheduled");
      }
    }
  }, [open, post]);

  const composedText = useMemo(() => {
    if (!post) return "";
    return composeText(contentSource, post, customText);
  }, [contentSource, post, customText]);

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const handlePublish = async () => {
    if (!post) return;
    if (selectedAccounts.length === 0) {
      toast({ title: "Seleziona almeno un account", variant: "destructive" });
      return;
    }
    if (publishState === "scheduled" && !scheduledAt) {
      toast({ title: "Seleziona data e ora", variant: "destructive" });
      return;
    }
    if (!composedText.trim()) {
      toast({ title: "Il testo del post non può essere vuoto", variant: "destructive" });
      return;
    }

    // Prepara accountPlatforms per il backend (per validazione Instagram)
    const accountPlatforms = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .map(a => ({ id: a.id, platform: a.platform }));
    
    let mediaIds: string[] | undefined;
    
    // SE il post ha già dei media Publer allegati, usali direttamente
    if (post.publerMediaIds && post.publerMediaIds.length > 0) {
      mediaIds = post.publerMediaIds;
    } 
    // ALTRIMENTI, verifica se serve placeholder per piattaforme che richiedono media
    else if (usePlaceholderImage && accountPlatforms.some(a => isInstagramPlatform(a.platform))) {
      try {
        toast({ title: "Caricamento immagine placeholder...", description: "Attendere prego" });
        const result = await uploadPlaceholderMutation.mutateAsync();
        mediaIds = [result.mediaId];
      } catch (error) {
        toast({ 
          title: "Errore", 
          description: "Impossibile caricare l'immagine placeholder", 
          variant: "destructive" 
        });
        return;
      }
    }
    
    publishMutation.mutate({
      postId: post.id,
      accountIds: selectedAccounts,
      accountPlatforms,
      text: composedText,
      state: publishState,
      scheduledAt: publishState === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
      mediaIds,
    });
  };

  const accounts = accountsData?.accounts || [];
  const isConfigured = configData?.configured && configData?.isActive;

  // Auto-seleziona account social in base alla piattaforma del post
  useEffect(() => {
    if (open && post && accounts.length > 0 && selectedAccounts.length === 0) {
      const postPlatform = post.platform?.toLowerCase();
      if (postPlatform) {
        // Mappa le piattaforme del post ai tipi Publer
        const platformMappings: Record<string, string[]> = {
          instagram: ['instagram', 'ig_business', 'ig_personal'],
          facebook: ['facebook', 'fb_page', 'fb_group'],
          linkedin: ['linkedin', 'linkedin_page'],
          twitter: ['twitter', 'x'],
          x: ['twitter', 'x'],
          youtube: ['youtube'],
          tiktok: ['tiktok', 'tiktok_business'],
        };
        
        const matchingPlatforms = platformMappings[postPlatform] || [postPlatform];
        const matchingAccounts = accounts.filter(a => 
          matchingPlatforms.includes(a.platform.toLowerCase())
        );
        
        if (matchingAccounts.length > 0) {
          setSelectedAccounts(matchingAccounts.map(a => a.id));
        }
      }
    }
  }, [open, post, accounts]);

  const hasVideoScript = !!(post?.videoFullScript || post?.structuredContent?.videoFullScript);
  const hasLongCopy = !!(
    post?.chiCosaCome ||
    post?.errore ||
    post?.soluzione ||
    post?.riprovaSociale ||
    post?.structuredContent?.chiCosaCome
  );
  
  // Verifica se è selezionato Instagram (richiede sempre un'immagine)
  // Publer usa 'ig_business', 'ig_personal' invece di 'instagram'
  const hasInstagramSelected = useMemo(() => {
    return accounts
      .filter(a => selectedAccounts.includes(a.id))
      .some(a => isInstagramPlatform(a.platform));
  }, [accounts, selectedAccounts]);
  
  // Calcola info sulle piattaforme selezionate
  const selectedPlatformsInfo = useMemo(() => {
    const selectedAccountsList = accounts.filter(a => selectedAccounts.includes(a.id));
    const uniquePlatforms = [...new Set(selectedAccountsList.map(a => a.platform))];
    return uniquePlatforms.map(p => getPlatformInfo(p));
  }, [accounts, selectedAccounts]);
  
  // Piattaforme che richiedono media
  const platformsRequiringMedia = selectedPlatformsInfo.filter(p => p.requiresMedia);
  const hasMediaRequiredPlatforms = platformsRequiringMedia.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-pink-500" />
            Pubblica su Publer
          </DialogTitle>
          <DialogDescription>Configura e pubblica il tuo post sui social media</DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Publer non è configurato. Vai su Chiavi API {">"} Publer per collegare il tuo account.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-y-auto pr-4" style={{ maxHeight: '60vh' }}>
            <div className="space-y-6 py-4 pb-8">
              {post && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">{post.title || "Post senza titolo"}</p>
                  {post.copyType && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {post.copyType === "short" ? "Copy Corto" : "Copy Lungo"}
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Fonte del Contenuto
                </Label>
                <RadioGroup
                  value={contentSource}
                  onValueChange={(v) => setContentSource(v as ContentSource)}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2 col-span-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <RadioGroupItem value="full_message" id="full_message" />
                    <Label htmlFor="full_message" className="text-sm cursor-pointer font-medium">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-primary" />
                        Messaggio Completo
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hook_cta" id="hook_cta" />
                    <Label htmlFor="hook_cta" className="text-sm cursor-pointer">
                      Hook + CTA
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="copy_complete" id="copy_complete" disabled={!hasLongCopy} />
                    <Label
                      htmlFor="copy_complete"
                      className={`text-sm cursor-pointer ${!hasLongCopy ? "opacity-50" : ""}`}
                    >
                      Copy Strutturato
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="video_script" id="video_script" disabled={!hasVideoScript} />
                    <Label
                      htmlFor="video_script"
                      className={`text-sm cursor-pointer ${!hasVideoScript ? "opacity-50" : ""}`}
                    >
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        Script Video
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="text-sm cursor-pointer">
                      <span className="flex items-center gap-1">
                        <Edit3 className="h-3 w-3" />
                        Personalizzato
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {contentSource === "custom" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Testo Personalizzato</Label>
                  <Textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Scrivi il tuo testo personalizzato..."
                    className="min-h-[120px] resize-none"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Anteprima Testo ({composedText.length} caratteri)
                </Label>
                <div className="p-3 rounded-lg border bg-background max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">
                    {composedText || <span className="text-muted-foreground italic">Nessun contenuto</span>}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Account Social</Label>
                {accountsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : accounts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedAccounts.includes(account.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => handleToggleAccount(account.id)}
                      >
                        <Checkbox
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={() => handleToggleAccount(account.id)}
                        />
                        {platformIcons[account.platform] || <div className="h-4 w-4 bg-gray-400 rounded" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {account.accountName || account.accountUsername}
                          </p>
                          {account.accountUsername && account.accountName && (
                            <p className="text-xs text-muted-foreground">@{account.accountUsername}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize text-xs shrink-0">
                          {account.platform}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nessun account trovato. Sincronizza gli account dalla pagina Chiavi API.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Sezione informativa sui requisiti delle piattaforme */}
              {selectedPlatformsInfo.length > 0 && (
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4 text-blue-500" />
                    Requisiti Piattaforme Selezionate
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedPlatformsInfo.map((info, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2 rounded-md text-xs ${
                          info.requiresMedia 
                            ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700' 
                            : 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                        }`}
                      >
                        <div className="font-medium flex items-center gap-1">
                          {info.requiresMedia ? (
                            <ImageIcon className="h-3 w-3 text-amber-600" />
                          ) : (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {info.name}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {info.notes}
                        </div>
                        <div className="text-muted-foreground">
                          Tipi: {info.supportedTypes.join(', ')}
                        </div>
                        {info.maxChars && (
                          <div className="text-muted-foreground">
                            Max: {info.maxChars} caratteri
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Media già allegati al post */}
                  {post?.publerMediaIds && post.publerMediaIds.length > 0 && hasMediaRequiredPlatforms && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-300 dark:border-green-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          {post.publerMediaIds.length} media già allegati al post
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Checkbox per immagine placeholder se ci sono piattaforme che richiedono media e il post NON ha media */}
                  {hasMediaRequiredPlatforms && (!post?.publerMediaIds || post.publerMediaIds.length === 0) && (
                    <div className="mt-3 p-3 bg-white dark:bg-black/30 rounded-md border border-amber-300 dark:border-amber-700">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="use-placeholder"
                          checked={usePlaceholderImage}
                          onCheckedChange={(checked) => setUsePlaceholderImage(checked === true)}
                        />
                        <Label htmlFor="use-placeholder" className="text-sm cursor-pointer flex-1">
                          <span className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-amber-600" />
                            Usa immagine placeholder per {platformsRequiringMedia.map(p => p.name).join(', ')}
                          </span>
                        </Label>
                      </div>
                      {!usePlaceholderImage && (
                        <p className="text-xs text-muted-foreground mt-2 ml-6">
                          Le piattaforme evidenziate in giallo richiedono un'immagine. 
                          Attiva questa opzione oppure deselezionale.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Modalità di Pubblicazione</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={publishState === "draft" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPublishState("draft")}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Bozza
                  </Button>
                  <Button
                    type="button"
                    variant={publishState === "publish_now" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPublishState("publish_now")}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Pubblica Ora
                  </Button>
                  <Button
                    type="button"
                    variant={publishState === "scheduled" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPublishState("scheduled")}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Programma
                  </Button>
                </div>
                {publishState === "scheduled" && (
                  <div className="space-y-2 mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-md border">
                    <Label className="text-sm font-medium">Data e ora di pubblicazione</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full h-10"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handlePublish}
            disabled={
              !isConfigured || 
              selectedAccounts.length === 0 || 
              publishMutation.isPending || 
              !composedText.trim() ||
              (hasMediaRequiredPlatforms && !usePlaceholderImage && (!post?.publerMediaIds || post.publerMediaIds.length === 0))
            }
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : publishState === "draft" ? (
              <Save className="h-4 w-4 mr-2" />
            ) : publishState === "publish_now" ? (
              <Send className="h-4 w-4 mr-2" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            {publishState === "draft"
              ? "Salva Bozza"
              : publishState === "publish_now"
              ? "Pubblica Ora"
              : "Programma"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog di errore - richiede conferma utente */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Errore Pubblicazione
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
