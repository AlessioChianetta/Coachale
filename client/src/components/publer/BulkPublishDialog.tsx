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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Loader2,
  Send,
  CheckCircle,
  AlertCircle,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Clock,
  ImageIcon,
  Calendar,
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
  hook?: string;
  platform?: string;
  scheduledAt?: string;
  scheduledDate?: string;
  publerMediaIds?: any[];
  publerStatus?: string;
}

interface BulkPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: Post[];
}

const getPlatformIcon = (platform: string) => {
  const normalized = platform.toLowerCase();
  if (['instagram', 'ig_business', 'ig_personal'].includes(normalized)) {
    return <Instagram className="h-5 w-5 text-pink-500" />;
  }
  if (['facebook', 'fb_page', 'fb_group'].includes(normalized)) {
    return <Facebook className="h-5 w-5 text-blue-600" />;
  }
  if (['linkedin', 'linkedin_page'].includes(normalized)) {
    return <Linkedin className="h-5 w-5 text-blue-700" />;
  }
  if (['twitter', 'x'].includes(normalized)) {
    return <Twitter className="h-5 w-5 text-gray-800 dark:text-gray-200" />;
  }
  return <Send className="h-5 w-5 text-gray-500" />;
};

export function BulkPublishDialog({ open, onOpenChange, posts }: BulkPublishDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [publishResults, setPublishResults] = useState<{ postId: string; success: boolean; error?: string }[]>([]);

  const { data: configData } = useQuery({
    queryKey: ["/api/publer/config"],
    queryFn: async () => {
      const res = await fetch("/api/publer/config", { headers: getAuthHeaders() });
      return res.json();
    },
    enabled: open,
  });

  const { data: accountsData } = useQuery({
    queryKey: ["/api/publer/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/publer/accounts", { headers: getAuthHeaders() });
      return res.json();
    },
    enabled: open && configData?.configured,
  });

  const publishMutation = useMutation({
    mutationFn: async (data: {
      accountIds: string[];
      accountPlatforms: { id: string; platform: string }[];
      postIds: string[];
    }) => {
      const res = await fetch("/api/publer/bulk-publish", {
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
    onSuccess: (data) => {
      setPublishResults(data.results || []);
      toast({
        title: "Pubblicazione completata",
        description: `${data.summary?.success || 0} post programmati, ${data.summary?.failed || 0} errori`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/posts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!open) {
      setSelectedAccounts([]);
      setPublishResults([]);
    }
  }, [open]);

  const accounts = accountsData?.accounts || [];
  const isConfigured = configData?.configured && configData?.isActive;

  const eligiblePosts = useMemo(() => {
    return posts.filter(p => 
      (p.scheduledAt || p.scheduledDate) && 
      p.publerMediaIds && 
      p.publerMediaIds.length > 0 &&
      p.publerStatus !== 'scheduled' &&
      p.publerStatus !== 'published'
    );
  }, [posts]);

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const handlePublish = async () => {
    if (selectedAccounts.length === 0) {
      toast({ title: "Seleziona almeno un account", variant: "destructive" });
      return;
    }

    const accountPlatforms = accounts
      .filter((a: PublerAccount) => selectedAccounts.includes(a.id))
      .map((a: PublerAccount) => ({ id: a.id, platform: a.platform }));

    publishMutation.mutate({
      accountIds: selectedAccounts,
      accountPlatforms,
      postIds: eligiblePosts.map(p => p.id),
    });
  };

  const progressPercentage = publishResults.length > 0 
    ? (publishResults.filter(r => r.success).length / eligiblePosts.length) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Pubblica Tutti i Programmati
          </DialogTitle>
          <DialogDescription>
            Programma su Publer tutti i post con data e immagine già impostati
          </DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Publer non è configurato. Vai nelle impostazioni per configurarlo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">{eligiblePosts.length} post pronti</p>
                <p className="text-sm text-muted-foreground">
                  Post programmati con immagine, non ancora su Publer
                </p>
              </div>
            </div>

            {eligiblePosts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nessun post idoneo. Assicurati che i post abbiano una data programmata e un'immagine.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Seleziona Account Social
                  </Label>
                  <ScrollArea className="h-[150px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {accounts.map((account: PublerAccount) => (
                        <div
                          key={account.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedAccounts.includes(account.id)
                              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleToggleAccount(account.id)}
                        >
                          <Checkbox
                            checked={selectedAccounts.includes(account.id)}
                            onCheckedChange={() => handleToggleAccount(account.id)}
                          />
                          {getPlatformIcon(account.platform)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{account.accountName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              @{account.accountUsername}
                            </p>
                          </div>
                          {selectedAccounts.includes(account.id) && (
                            <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Post da Pubblicare ({eligiblePosts.length})
                  </Label>
                  <ScrollArea className="h-[120px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {eligiblePosts.map((post) => {
                        const result = publishResults.find(r => r.postId === post.id);
                        return (
                          <div
                            key={post.id}
                            className={`flex items-center gap-2 p-2 rounded text-sm ${
                              result?.success 
                                ? 'bg-green-50 dark:bg-green-900/20' 
                                : result?.error 
                                ? 'bg-red-50 dark:bg-red-900/20' 
                                : 'bg-muted/50'
                            }`}
                          >
                            {result?.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : result?.error ? (
                              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="truncate flex-1">
                              {post.title || post.hook?.slice(0, 50) || 'Post senza titolo'}
                            </span>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {post.scheduledAt || post.scheduledDate 
                                ? new Date(post.scheduledAt || post.scheduledDate!).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                                : '-'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {publishResults.length > 0 && (
                  <div className="space-y-2">
                    <Progress value={progressPercentage} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      {publishResults.filter(r => r.success).length} / {eligiblePosts.length} completati
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {publishResults.length > 0 ? 'Chiudi' : 'Annulla'}
          </Button>
          {publishResults.length === 0 && eligiblePosts.length > 0 && (
            <Button
              onClick={handlePublish}
              disabled={!isConfigured || selectedAccounts.length === 0 || publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Programmando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Programma Tutti
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
