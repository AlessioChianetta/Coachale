import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Send, Loader2, X, Plus, ChevronDown, ChevronUp, Mail } from "lucide-react";

interface EmailAccount {
  id: string;
  displayName: string;
  emailAddress: string;
  smtpHost?: string;
}

interface ReplyToEmail {
  id: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  toRecipients?: string[];
  ccRecipients?: string[];
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;
}

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: EmailAccount[];
  defaultAccountId?: string;
  replyTo?: ReplyToEmail;
  replyAll?: boolean;
}

export function EmailComposer({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
  replyTo,
  replyAll = false,
}: EmailComposerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCcBcc, setShowCcBcc] = useState(false);

  const [formData, setFormData] = useState({
    accountId: defaultAccountId || accounts[0]?.id || "",
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  useEffect(() => {
    if (open) {
      if (replyTo) {
        const replySubject = replyTo.subject?.startsWith("Re: ")
          ? replyTo.subject
          : `Re: ${replyTo.subject || ""}`;
        
        let toAddresses = replyTo.fromEmail;
        let ccAddresses = "";

        if (replyAll) {
          const originalTo = replyTo.toRecipients || [];
          const originalCc = replyTo.ccRecipients || [];
          const currentAccount = accounts.find(a => a.id === (defaultAccountId || accounts[0]?.id));
          const myEmail = currentAccount?.emailAddress;

          const allTo = [replyTo.fromEmail, ...originalTo].filter(e => e !== myEmail);
          toAddresses = [...new Set(allTo)].join(", ");
          ccAddresses = [...new Set(originalCc.filter(e => e !== myEmail))].join(", ");
          
          if (ccAddresses) setShowCcBcc(true);
        }

        const quotedBody = replyTo.bodyText
          ? `\n\n\n--- Messaggio originale ---\nDa: ${replyTo.fromName || replyTo.fromEmail}\nOggetto: ${replyTo.subject || ""}\n\n${replyTo.bodyText}`
          : "";

        setFormData({
          accountId: defaultAccountId || accounts[0]?.id || "",
          to: toAddresses,
          cc: ccAddresses,
          bcc: "",
          subject: replySubject,
          body: quotedBody,
        });
      } else {
        setFormData({
          accountId: defaultAccountId || accounts[0]?.id || "",
          to: "",
          cc: "",
          bcc: "",
          subject: "",
          body: "",
        });
        setShowCcBcc(false);
      }
    }
  }, [open, replyTo, replyAll, defaultAccountId, accounts]);

  const composeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const endpoint = replyTo ? "/api/email-hub/reply" : "/api/email-hub/compose";
      
      const toArray = data.to.split(",").map(e => e.trim()).filter(Boolean);
      const ccArray = data.cc ? data.cc.split(",").map(e => e.trim()).filter(Boolean) : [];
      const bccArray = data.bcc ? data.bcc.split(",").map(e => e.trim()).filter(Boolean) : [];

      const body = replyTo
        ? {
            emailId: replyTo.id,
            bodyText: data.body,
            bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body.replace(/\n/g, "<br>")}</div>`,
            replyAll,
          }
        : {
            accountId: data.accountId,
            to: toArray,
            cc: ccArray.length > 0 ? ccArray : undefined,
            bcc: bccArray.length > 0 ? bccArray : undefined,
            subject: data.subject,
            bodyText: data.body,
            bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body.replace(/\n/g, "<br>")}</div>`,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore durante l'invio");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email inviata",
        description: replyTo ? "Risposta inviata con successo" : "Email inviata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["email-hub-emails"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.to.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci almeno un destinatario",
        variant: "destructive",
      });
      return;
    }

    if (!replyTo && !formData.subject.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci l'oggetto dell'email",
        variant: "destructive",
      });
      return;
    }

    composeMutation.mutate(formData);
  };

  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const canSend = selectedAccount?.smtpHost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {replyTo ? (replyAll ? "Rispondi a tutti" : "Rispondi") : "Nuova email"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!replyTo && accounts.length > 1 && (
            <div className="space-y-2">
              <Label>Da</Label>
              <Select
                value={formData.accountId}
                onValueChange={(val) => setFormData(prev => ({ ...prev, accountId: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.smtpHost).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span>{account.displayName || account.emailAddress}</span>
                        <span className="text-muted-foreground text-xs">
                          {account.emailAddress}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!replyTo && accounts.length === 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Da:</span>
              <Badge variant="secondary">
                {accounts[0].displayName || accounts[0].emailAddress}
              </Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="to">A</Label>
            <Input
              id="to"
              placeholder="destinatario@esempio.com"
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              disabled={!!replyTo}
            />
            <p className="text-xs text-muted-foreground">
              Separa più indirizzi con virgole
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowCcBcc(!showCcBcc)}
          >
            {showCcBcc ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {showCcBcc ? "Nascondi Cc/Ccn" : "Mostra Cc/Ccn"}
          </Button>

          {showCcBcc && (
            <div className="space-y-4 pl-4 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="cc">Cc</Label>
                <Input
                  id="cc"
                  placeholder="copia@esempio.com"
                  value={formData.cc}
                  onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc">Ccn (nascosto)</Label>
                <Input
                  id="bcc"
                  placeholder="copia-nascosta@esempio.com"
                  value={formData.bcc}
                  onChange={(e) => setFormData(prev => ({ ...prev, bcc: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Oggetto</Label>
            <Input
              id="subject"
              placeholder="Oggetto dell'email"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              disabled={!!replyTo}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Messaggio</Label>
            <Textarea
              id="body"
              placeholder="Scrivi il tuo messaggio..."
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              rows={10}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={composeMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={composeMutation.isPending || !canSend}
            >
              {composeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Invia
            </Button>
          </DialogFooter>

          {!canSend && (
            <p className="text-xs text-destructive text-center">
              SMTP non configurato per questo account. Configura le impostazioni di invio.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
