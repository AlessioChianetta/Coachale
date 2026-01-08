import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Copy,
  Check,
  Gift,
  Users,
  Clock,
  Phone,
  Mail,
  Send,
  Award,
  TrendingUp,
  Share2,
  Menu,
  Loader2,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ReferralCode {
  success: boolean;
  code: string;
  codeType: string;
  isActive: boolean;
  consultant: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
  bonusText: string;
  bonusValue: number | null;
}

interface Referral {
  id: string;
  friendFirstName: string;
  friendLastName: string | null;
  friendEmail: string;
  friendPhone: string;
  status: "pending" | "contacted" | "appointment_set" | "closed_won" | "closed_lost";
  bonusAwarded: boolean;
  bonusAwardedAt: string | null;
  createdAt: string;
}

interface InvitesResponse {
  success: boolean;
  referrals: Referral[];
  stats: {
    total: number;
    pending: number;
    contacted: number;
    closedWon: number;
    closedLost: number;
    bonusEarned: number;
  };
}

export default function ClientReferralPage() {
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: referralCode, isLoading: isLoadingCode } = useQuery<ReferralCode>({
    queryKey: ["/api/referral/my-code"],
    queryFn: async () => {
      const response = await fetch("/api/referral/my-code", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch referral code");
      return response.json();
    },
  });

  const { data: invitesData, isLoading: isLoadingInvites } = useQuery<InvitesResponse>({
    queryKey: ["/api/referral/my-invites"],
    queryFn: async () => {
      const response = await fetch("/api/referral/my-invites", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch invites");
      return response.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      const response = await fetch("/api/referral/invite", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'invio dell'invito");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invito inviato!",
        description: "Il tuo amico riceverà un'email con il tuo codice referral.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/referral/my-invites"] });
      setIsInviteDialogOpen(false);
      setInviteForm({ firstName: "", lastName: "", email: "", phone: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = () => {
    if (!referralCode?.code) return;
    const referralUrl = `${window.location.origin}/r/${referralCode.code}`;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({
      title: "Link copiato!",
      description: "Il link referral è stato copiato negli appunti.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCodeOnly = () => {
    if (!referralCode?.code) return;
    navigator.clipboard.writeText(referralCode.code);
    toast({
      title: "Codice copiato!",
      description: "Il codice referral è stato copiato negli appunti.",
    });
  };

  const handleSubmitInvite = () => {
    if (!inviteForm.firstName.trim() || !inviteForm.email.trim() || !inviteForm.phone.trim()) {
      toast({
        title: "Campi obbligatori",
        description: "Nome, email e telefono sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    inviteMutation.mutate(inviteForm);
  };

  const getStatusBadge = (status: Referral["status"]) => {
    const statusConfig = {
      pending: { label: "In Attesa", variant: "secondary" as const, icon: Clock },
      contacted: { label: "Contattato", variant: "outline" as const, icon: Phone },
      appointment_set: { label: "Appuntamento", variant: "default" as const, icon: Calendar },
      closed_won: { label: "Successo", variant: "default" as const, icon: CheckCircle },
      closed_lost: { label: "Non Convertito", variant: "destructive" as const, icon: XCircle },
    };
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge 
        variant={config.variant} 
        className={cn(
          "gap-1",
          status === "closed_won" && "bg-emerald-500 hover:bg-emerald-600"
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const stats = invitesData?.stats;
  const referrals = invitesData?.referrals || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex h-screen">
        <Sidebar
          role="client"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-xl shadow-lg">
                    <Gift className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Invita un Amico</h1>
                    <p className="text-muted-foreground text-sm">
                      Condividi il tuo percorso e guadagna bonus
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Inviti Totali</p>
                      <p className="text-2xl sm:text-3xl font-bold">{stats?.total || 0}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/50 backdrop-blur-sm shadow-sm">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">In Attesa</p>
                      <p className="text-2xl sm:text-3xl font-bold">{stats?.pending || 0}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/50 backdrop-blur-sm shadow-sm">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Convertiti</p>
                      <p className="text-2xl sm:text-3xl font-bold">{stats?.closedWon || 0}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/50 backdrop-blur-sm shadow-sm">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Bonus Guadagnati</p>
                      <p className="text-2xl sm:text-3xl font-bold">{stats?.bonusEarned || 0}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/50 backdrop-blur-sm shadow-sm">
                      <Award className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-xl bg-gradient-to-br from-fuchsia-500/5 via-purple-500/5 to-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-fuchsia-500" />
                  Il Tuo Codice Referral
                </CardTitle>
                <CardDescription>
                  Condividi questo codice con i tuoi amici per invitarli
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingCode ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : referralCode?.code ? (
                  <>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 rounded-xl blur-sm opacity-30" />
                          <div className="relative bg-background/80 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-4 text-center">
                            <p className="text-3xl sm:text-4xl font-bold tracking-wider text-foreground">
                              {referralCode.code}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleCopyCodeOnly}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Codice
                        </Button>
                        <Button
                          size="lg"
                          onClick={handleCopyCode}
                          className="gap-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copiato!
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-4 w-4" />
                              Copia Link
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                      <LinkIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {window.location.origin}/r/{referralCode.code}
                      </span>
                    </div>

                    {referralCode.bonusText && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                          <Gift className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-emerald-700 dark:text-emerald-400">
                            Bonus per ogni amico che si iscrive
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {referralCode.bonusText}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Impossibile caricare il codice referral.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-blue-500" />
                      Invita i Tuoi Amici
                    </CardTitle>
                    <CardDescription>
                      Invia un invito diretto ai tuoi contatti
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsInviteDialogOpen(true)}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    Nuovo Invito
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingInvites ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : referrals.length > 0 ? (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Nome</TableHead>
                          <TableHead className="hidden sm:table-cell">Email</TableHead>
                          <TableHead className="hidden md:table-cell">Data Invito</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead className="text-center">Bonus</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referrals.map((referral) => (
                          <TableRow key={referral.id}>
                            <TableCell className="font-medium">
                              <div>
                                <p>{referral.friendFirstName} {referral.friendLastName}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">
                                  {referral.friendEmail}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {referral.friendEmail}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {format(new Date(referral.createdAt), "dd MMM yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>{getStatusBadge(referral.status)}</TableCell>
                            <TableCell className="text-center">
                              {referral.bonusAwarded ? (
                                <Badge variant="default" className="bg-emerald-500 gap-1">
                                  <Gift className="h-3 w-3" />
                                  Ricevuto
                                </Badge>
                              ) : referral.status === "closed_won" ? (
                                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                                  <Clock className="h-3 w-3" />
                                  In Arrivo
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Nessun invito ancora</p>
                      <p className="text-sm text-muted-foreground">
                        Inizia invitando i tuoi amici a unirsi al percorso!
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsInviteDialogOpen(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Invia il Primo Invito
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {(stats?.bonusEarned || 0) > 0 && (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-500" />
                    I Tuoi Bonus
                  </CardTitle>
                  <CardDescription>
                    Bonus guadagnati grazie ai tuoi referral di successo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {referrals
                      .filter((r) => r.bonusAwarded)
                      .map((referral) => (
                        <div
                          key={referral.id}
                          className="flex items-center gap-3 p-4 rounded-xl bg-background/50 border border-emerald-500/20"
                        >
                          <div className="p-2 rounded-lg bg-emerald-500/20">
                            <Gift className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">
                              Bonus per {referral.friendFirstName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {referral.bonusAwardedAt
                                ? format(new Date(referral.bonusAwardedAt), "dd MMM yyyy", { locale: it })
                                : "Ricevuto"}
                            </p>
                          </div>
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Invita un Amico
            </DialogTitle>
            <DialogDescription>
              Inserisci i dati del tuo amico per invitarlo a unirsi al percorso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome *</Label>
                <Input
                  id="firstName"
                  placeholder="Mario"
                  value={inviteForm.firstName}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Cognome</Label>
                <Input
                  id="lastName"
                  placeholder="Rossi"
                  value={inviteForm.lastName}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="mario@esempio.com"
                  className="pl-9"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+39 333 1234567"
                  className="pl-9"
                  value={inviteForm.phone}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, phone: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSubmitInvite}
              disabled={inviteMutation.isPending}
              className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Invio...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Invia Invito
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
