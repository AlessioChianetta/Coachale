import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, 
  AlertCircle, 
  Loader2, 
  MessageSquare, 
  Clock, 
  Sparkles,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  agentId: string;
  agentName: string;
  level: "1" | "2" | "3" | null;
  publicSlug: string | null;
}

interface PricingData {
  consultantName: string;
  consultantSlug: string;
  agents: Agent[];
  pricing: {
    level1Name: string;
    level1Description: string;
    level1DailyMessageLimit: number;
    level1Features: string[];
    accentColor: string | null;
    logoUrl: string | null;
  };
}

const BRONZE_TOKEN_KEY = "manager_token";

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Check className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
      <span className="text-sm text-slate-700">{children}</span>
    </li>
  );
}

export default function BronzeAuth() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"register" | "login">("register");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  // Track pending navigation after auth success
  const [pendingNavigation, setPendingNavigation] = useState(false);
  const pendingUserNameRef = useRef<string | undefined>(undefined);

  const { data, isLoading, error, refetch } = useQuery<PricingData>({
    queryKey: ["/api/public/consultant", slug, "pricing"],
    queryFn: async () => {
      const response = await fetch(`/api/public/consultant/${slug}/pricing`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }
        throw new Error("GENERIC_ERROR");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  // Get all level 1 agents for Bronze tier
  const level1Agents = data?.agents.filter(a => a.level === "1") || [];

  // Handle navigation after data is loaded when pendingNavigation is true
  useEffect(() => {
    if (pendingNavigation && data && !isLoading) {
      const agents = data.agents.filter(a => a.level === "1");
      
      if (agents.length > 1) {
        navigate(`/c/${slug}/select-agent`);
      } else if (agents.length === 1 && agents[0].publicSlug) {
        navigate(`/agent/${agents[0].publicSlug}/chat`);
      } else {
        toast({
          title: "Accesso completato",
          description: "Nessun agente disponibile al momento.",
        });
      }
      
      setPendingNavigation(false);
    }
  }, [pendingNavigation, data, isLoading, slug, navigate, toast]);

  const handleAuthSuccess = async (token: string, userName?: string, paymentSource?: string, consultantId?: string) => {
    // Save token in multiple locations for compatibility with different auth systems
    localStorage.setItem(BRONZE_TOKEN_KEY, token);
    localStorage.setItem("bronzeAuthToken", token); // For select-agent compatibility
    // Set tier info for select-agent page
    localStorage.setItem("bronzeUserTier", "1");
    localStorage.setItem("bronzePublicSlug", slug || "");
    if (userName) {
      localStorage.setItem("bronzeUserName", userName);
      pendingUserNameRef.current = userName;
    }
    
    // Save payment source and consultant info for upgrade flow
    if (paymentSource) {
      localStorage.setItem("paymentSource", paymentSource);
    }
    if (consultantId) {
      localStorage.setItem("consultantId", consultantId);
    }
    
    // Small delay to ensure localStorage is synced before navigation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Refetch agents data to ensure we have the latest list, then navigate
    setPendingNavigation(true);
    await refetch();
  };

  const registerMutation = useMutation({
    mutationFn: async (data: typeof registerForm) => {
      const response = await fetch(`/api/bronze/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante la registrazione");
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Registrazione completata!",
        description: "Benvenuto nel piano Bronze.",
      });
      // Pass firstName, paymentSource, and consultantId for the select-agent page and upgrade flow
      handleAuthSuccess(result.token, registerForm.firstName || result.firstName, result.paymentSource, result.consultantId);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: typeof loginForm) => {
      const response = await fetch(`/api/bronze/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Credenziali non valide");
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Accesso effettuato!",
        description: "Bentornato.",
      });
      // Pass firstName, paymentSource, and consultantId from API response
      handleAuthSuccess(result.token, result.user?.firstName, result.paymentSource, result.consultantId);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non corrispondono",
        variant: "destructive",
      });
      return;
    }
    if (registerForm.password.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(registerForm);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-3 text-slate-900">Consulente non trovato</h2>
            <p className="text-muted-foreground mb-8">
              Il consulente che stai cercando non esiste o non ha una pagina pubblica configurata.
            </p>
            <Button onClick={() => navigate("/")} variant="outline" size="lg">
              Torna alla home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planName = data?.pricing.level1Name || "Bronze";
  const dailyLimit = data?.pricing.level1DailyMessageLimit || 15;
  const features = data?.pricing.level1Features || [
    `${dailyLimit} messaggi gratuiti al giorno`,
    "Risposte AI intelligenti",
    "Disponibilità 24/7",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-br from-violet-50/60 via-transparent to-purple-50/40 pointer-events-none" />
      
      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-10">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-6" />
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-48 mx-auto" />
            </>
          ) : (
            <>
              {data?.pricing.logoUrl && (
                <img 
                  src={data.pricing.logoUrl} 
                  alt={data.consultantName}
                  className="h-16 w-auto mx-auto mb-6 object-contain"
                />
              )}
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                {data?.consultantName || "Consulente"}
              </h1>
              <p className="text-lg text-slate-600">
                Accedi al piano {planName} gratuito
              </p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <Card className="shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-6 w-6" />
                <h2 className="text-xl font-bold">{planName}</h2>
              </div>
              <p className="text-white/90 text-sm">
                {data?.pricing.level1Description || "Accesso gratuito all'assistente AI"}
              </p>
            </div>
            
            <CardContent className="p-6">
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-slate-900">Gratis</span>
                <span className="text-slate-500">per sempre</span>
              </div>

              <div className="flex items-center gap-2 text-violet-600 font-medium mb-4">
                <MessageSquare className="h-5 w-5" />
                <span>{dailyLimit} messaggi al giorno</span>
              </div>

              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <FeatureItem key={index}>{feature}</FeatureItem>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4" />
                  <span>I messaggi si resettano ogni giorno</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0">
            <CardHeader className="pb-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "register" | "login")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="register" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Registrati
                  </TabsTrigger>
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Accedi
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="pt-2">
              {activeTab === "register" ? (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="tuaemail@esempio.com"
                        className="pl-10"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-firstName">Nome</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="reg-firstName"
                          type="text"
                          placeholder="Mario"
                          className="pl-10"
                          value={registerForm.firstName}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-lastName">Cognome</Label>
                      <Input
                        id="reg-lastName"
                        type="text"
                        placeholder="Rossi"
                        value={registerForm.lastName}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimo 6 caratteri"
                        className="pl-10 pr-10"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-confirmPassword">Conferma Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="reg-confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Ripeti la password"
                        className="pl-10 pr-10"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Registrazione in corso...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Crea Account Gratuito
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-slate-500">
                    Registrandoti accetti i termini di servizio e la privacy policy
                  </p>
                </form>
              ) : (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="tuaemail@esempio.com"
                        className="pl-10"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="La tua password"
                        className="pl-10 pr-10"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Accesso in corso...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Accedi
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-600">
                  {activeTab === "register" ? (
                    <>
                      Hai già un account?{" "}
                      <button 
                        onClick={() => setActiveTab("login")}
                        className="text-violet-600 hover:underline font-medium"
                      >
                        Accedi
                      </button>
                    </>
                  ) : (
                    <>
                      Non hai un account?{" "}
                      <button 
                        onClick={() => setActiveTab("register")}
                        className="text-violet-600 hover:underline font-medium"
                      >
                        Registrati gratis
                      </button>
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/c/${slug}/pricing`)}
            className="text-slate-600"
          >
            Vedi tutti i piani disponibili
          </Button>
        </div>
      </div>
    </div>
  );
}
