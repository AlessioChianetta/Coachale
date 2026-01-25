import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";

interface PublerAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUsername: string;
  profileImageUrl?: string;
  isActive: boolean;
}

interface Post {
  id: string;
  title?: string;
  content?: string;
  platforms?: string[];
  mediaUrl?: string;
}

interface PublerPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  linkedin: <Linkedin className="h-4 w-4 text-blue-700" />,
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-600" />,
};

export function PublerPublishDialog({ open, onOpenChange, post }: PublerPublishDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");

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

  const publishMutation = useMutation({
    mutationFn: async (data: { postId: string; accountIds: string[]; text: string; scheduledAt?: string }) => {
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
    onSuccess: () => {
      toast({ 
        title: scheduleMode === "now" ? "Post inviato!" : "Post programmato!",
        description: "Il post è stato inviato a Publer"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/posts"] });
      onOpenChange(false);
      setSelectedAccounts([]);
      setScheduleMode("now");
      setScheduledAt("");
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!open) {
      setSelectedAccounts([]);
      setScheduleMode("now");
      setScheduledAt("");
    }
  }, [open]);

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handlePublish = () => {
    if (!post) return;
    if (selectedAccounts.length === 0) {
      toast({ title: "Seleziona almeno un account", variant: "destructive" });
      return;
    }
    if (scheduleMode === "scheduled" && !scheduledAt) {
      toast({ title: "Seleziona data e ora", variant: "destructive" });
      return;
    }

    const text = post.content || post.title || "";
    publishMutation.mutate({
      postId: post.id,
      accountIds: selectedAccounts,
      text,
      scheduledAt: scheduleMode === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
    });
  };

  const accounts = accountsData?.accounts || [];
  const isConfigured = configData?.configured && configData?.isActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-pink-500" />
            Pubblica su Publer
          </DialogTitle>
          <DialogDescription>
            Seleziona gli account social su cui pubblicare questo post
          </DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Publer non è configurato. Vai su Chiavi API {">"} Publer per collegare il tuo account.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 py-4">
            {post && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium line-clamp-2">{post.title || "Post"}</p>
                {post.content && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Account Social</Label>
              {accountsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : accounts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
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
                      {platformIcons[account.platform] || (
                        <div className="h-4 w-4 bg-gray-400 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {account.accountName || account.accountUsername}
                        </p>
                        {account.accountUsername && account.accountName && (
                          <p className="text-xs text-muted-foreground">
                            @{account.accountUsername}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
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

            <div className="space-y-3">
              <Label className="text-sm font-medium">Quando pubblicare</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scheduleMode === "now" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setScheduleMode("now")}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Subito
                </Button>
                <Button
                  type="button"
                  variant={scheduleMode === "scheduled" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setScheduleMode("scheduled")}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Programma
                </Button>
              </div>
              {scheduleMode === "scheduled" && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!isConfigured || selectedAccounts.length === 0 || publishMutation.isPending}
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {scheduleMode === "now" ? "Pubblica Ora" : "Programma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
