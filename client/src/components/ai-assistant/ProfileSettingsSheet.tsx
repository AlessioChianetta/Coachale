import { useState, useEffect } from "react";
import { User, CreditCard, LogOut, Medal, Crown, Loader2, Mail, Phone, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ProfileSettingsSheetProps {
  trigger: React.ReactNode;
  managerInfo: {
    name: string;
    email?: string;
    phone?: string;
  } | null;
  bronzeUsage: {
    dailyMessagesUsed: number;
    dailyMessageLimit: number;
    remaining: number;
  } | null;
  subscriptionLevel: "bronze" | "silver" | "gold";
  nextRenewalDate?: string;
  onLogout: () => void;
  slug: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: "profile" | "subscription";
  pricing?: {
    level2MonthlyPrice: number;
    level3MonthlyPrice: number;
    level2Name?: string;
    level3Name?: string;
    level2Features?: string[];
    level3Features?: string[];
  };
}

export function ProfileSettingsSheet({
  trigger,
  managerInfo,
  bronzeUsage,
  subscriptionLevel,
  nextRenewalDate,
  onLogout,
  slug,
  open,
  onOpenChange,
  defaultTab = "profile",
  pricing,
}: ProfileSettingsSheetProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const getToken = () => {
    return localStorage.getItem("manager_token") || localStorage.getItem("token");
  };

  const silverPrice = pricing?.level2MonthlyPrice ?? 29;
  const goldPrice = pricing?.level3MonthlyPrice ?? 59;
  const silverName = pricing?.level2Name || "Argento";
  const goldName = pricing?.level3Name || "Oro";

  const levelConfig = {
    bronze: {
      label: "Bronze",
      price: "Gratuito",
      icon: <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-lg">🥉</div>,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-200 dark:border-amber-500/30",
    },
    silver: {
      label: silverName,
      price: `€${silverPrice}/mese`,
      icon: <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-500/20 flex items-center justify-center text-lg">🥈</div>,
      color: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-50 dark:bg-slate-900/20",
      borderColor: "border-slate-200 dark:border-slate-500/30",
    },
    gold: {
      label: goldName,
      price: `€${goldPrice}/mese`,
      icon: <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center text-lg">🥇</div>,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-500/30",
    },
  };

  const currentLevel = levelConfig[subscriptionLevel];

  const handleUpgrade = async (targetLevel: "silver" | "gold") => {
    setIsUpgrading(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("Token di autenticazione non trovato");
      }
      
      const response = await fetch(`/api/stripe/upgrade-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug,
          targetLevel: targetLevel === "silver" ? "2" : "3",
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        // Open Stripe checkout in new tab to preserve chat state
        const checkoutWindow = window.open(data.checkoutUrl, '_blank', 'noopener');
        toast({
          title: "Checkout aperto",
          description: "Completa il pagamento nella nuova scheda. Questa pagina si aggiornerà automaticamente.",
        });
        
        // Start polling to detect when upgrade is completed
        const pollInterval = setInterval(async () => {
          try {
            const checkResponse = await fetch(`/api/public/agent/${slug}/manager/me`, {
              headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (checkResponse.ok) {
              const userData = await checkResponse.json();
              // If user is no longer Bronze, upgrade succeeded
              if (!userData.isBronze) {
                clearInterval(pollInterval);
                toast({
                  title: "Upgrade completato!",
                  description: `Benvenuto nel piano ${targetLevel === "silver" ? "Argento" : "Oro"}! Goditi i nuovi vantaggi.`,
                });
                // Reload to refresh UI with new subscription status
                window.location.reload();
              }
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000); // Poll every 3 seconds
        
        // Stop polling after 10 minutes (timeout)
        setTimeout(() => clearInterval(pollInterval), 600000);
      } else if (data.success) {
        toast({
          title: "Upgrade completato!",
          description: `Sei passato al piano ${targetLevel === "silver" ? "Argento" : "Oro"}`,
        });
        window.location.reload();
      } else {
        throw new Error(data.error || "Errore durante l'upgrade");
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore durante l'upgrade",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const parseName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  };

  const { firstName, lastName } = managerInfo ? parseName(managerInfo.name) : { firstName: "", lastName: "" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Il Tuo Profilo
          </SheetTitle>
        </SheetHeader>

        <div className={`flex items-center gap-3 p-3 rounded-lg ${currentLevel.bgColor} border ${currentLevel.borderColor} mb-4`}>
          {currentLevel.icon}
          <div>
            <span className={`font-semibold ${currentLevel.color}`}>Piano {currentLevel.label}</span>
            <p className="text-xs text-muted-foreground">{currentLevel.price}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "profile" | "subscription")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profilo
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Abbonamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Dati Personali
              </h3>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Nome</span>
                  <span className="text-sm font-medium">{firstName || "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cognome</span>
                  <span className="text-sm font-medium">{lastName || "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </span>
                  <span className="text-sm font-medium truncate max-w-[180px]">{managerInfo?.email || "-"}</span>
                </div>
                {managerInfo?.phone && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Telefono
                      </span>
                      <span className="text-sm font-medium">{managerInfo.phone}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </Button>
          </TabsContent>

          <TabsContent value="subscription" className="mt-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Piano attuale</span>
                <span className={`text-sm font-medium ${currentLevel.color}`}>
                  {currentLevel.label} ({currentLevel.price})
                </span>
              </div>
              
              {subscriptionLevel === "bronze" && bronzeUsage && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Messaggi oggi</span>
                    <span className="text-sm font-medium">
                      {bronzeUsage.dailyMessagesUsed}/{bronzeUsage.dailyMessageLimit}
                    </span>
                  </div>
                </>
              )}

              {subscriptionLevel !== "bronze" && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Messaggi</span>
                    <span className="text-sm font-medium text-green-600">Illimitati ✓</span>
                  </div>
                </>
              )}

              {nextRenewalDate && subscriptionLevel !== "bronze" && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Prossimo rinnovo
                    </span>
                    <span className="text-sm font-medium">{nextRenewalDate}</span>
                  </div>
                </>
              )}
            </div>

            {subscriptionLevel === "bronze" && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className="h-5 w-5 text-slate-500" />
                    <span className="font-medium">{silverName}</span>
                    <span className="text-sm text-muted-foreground">- €{silverPrice}/mese</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Messaggi illimitati</span>
                    </li>
                    {pricing?.level2Features?.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">{goldName}</span>
                    <span className="text-sm text-muted-foreground">- €{goldPrice}/mese</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Tutto di {silverName} +</span>
                    </li>
                    {pricing?.level3Features?.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => handleUpgrade("silver")}
                    disabled={isUpgrading}
                    className="w-full bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white"
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Medal className="h-4 w-4 mr-2" />
                    )}
                    Passa a {silverName} - €{silverPrice}/mese
                  </Button>
                  
                  <Button
                    onClick={() => handleUpgrade("gold")}
                    disabled={isUpgrading}
                    className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Crown className="h-4 w-4 mr-2" />
                    )}
                    Passa a {goldName} - €{goldPrice}/mese
                  </Button>
                </div>
              </div>
            )}

            {subscriptionLevel === "silver" && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">{goldName}</span>
                    <span className="text-sm text-muted-foreground">- €{goldPrice}/mese</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Tutto di {silverName} +</span>
                    </li>
                    {pricing?.level3Features?.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {(!pricing?.level3Features || pricing.level3Features.length === 0) && (
                      <>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>Supporto prioritario</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>Funzionalità premium esclusive</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
                
                <Button
                  onClick={() => handleUpgrade("gold")}
                  disabled={isUpgrading}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
                >
                  {isUpgrading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4 mr-2" />
                  )}
                  Passa a {goldName} - €{goldPrice - silverPrice}/mese extra
                </Button>
              </div>
            )}

            {subscriptionLevel === "gold" && (
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-500/30">
                <Crown className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Hai già il piano migliore disponibile!
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
