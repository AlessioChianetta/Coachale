
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, TrendingUp, Briefcase, User, Crown } from "lucide-react";
import { loginSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { setToken, setAuthUser, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type LoginFormData = z.infer<typeof loginSchema>;

interface ProfileInfo {
  id: string;
  role: "consultant" | "client" | "super_admin";
  consultantId: string | null;
  consultantName?: string;
  isDefault: boolean;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Profile selection state
  const [showProfileSelection, setShowProfileSelection] = useState(false);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [rememberChoice, setRememberChoice] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      setLocation("/");
    }
  }, [setLocation]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLoginSuccess = (data: any) => {
    setToken(data.token);
    setAuthUser(data.user);
    
    // Mark this as a successful login for activity tracking
    localStorage.setItem('loginSuccess', 'true');
    
    // Small delay before redirect to ensure login flag is processed
    setTimeout(() => {
      // Redirect based on user role
      if (data.user.role === "super_admin") {
        setLocation("/admin");
      } else if (data.user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
    }, 100);
  };

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (data) => {
      // Check if profile selection is required
      if (data.requireProfileSelection) {
        setProfiles(data.profiles);
        setTempToken(data.tempToken);
        setUserName(data.user.firstName);
        setShowProfileSelection(true);
      } else {
        handleLoginSuccess(data);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore di accesso",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    },
  });

  const selectProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await fetch("/api/auth/select-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ profileId, rememberChoice }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore nella selezione profilo");
      }
      return response.json();
    },
    onSuccess: (data) => {
      handleLoginSuccess(data);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella selezione del profilo",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const getProfileIcon = (role: string) => {
    switch (role) {
      case "consultant": return <Briefcase className="w-6 h-6" />;
      case "super_admin": return <Crown className="w-6 h-6" />;
      default: return <User className="w-6 h-6" />;
    }
  };

  const getProfileLabel = (profile: ProfileInfo) => {
    switch (profile.role) {
      case "consultant": return "Consulente";
      case "super_admin": return "Super Admin";
      case "client": return profile.consultantName ? `Cliente di ${profile.consultantName}` : "Cliente";
    }
  };

  // Profile Selection Screen
  if (showProfileSelection) {
    return (
      <div className="min-h-screen flex" data-testid="login-page">
        <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-950">
          <div className="w-full max-w-md space-y-8">
            {/* Logo & Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-gray-100 dark:via-blue-200 dark:to-indigo-100 bg-clip-text text-transparent">
                Ciao {userName}!
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Con quale profilo vuoi accedere?
              </p>
            </div>

            {/* Profile Selection */}
            <Card className="border-gray-200 dark:border-gray-800 shadow-xl">
              <CardContent className="pt-6 space-y-4">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => selectProfileMutation.mutate(profile.id)}
                    disabled={selectProfileMutation.isPending}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 ${
                      profile.isDefault 
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" 
                        : "border-gray-200 dark:border-gray-700"
                    } ${selectProfileMutation.isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      profile.role === "consultant" 
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white" 
                        : profile.role === "super_admin"
                        ? "bg-gradient-to-br from-purple-500 to-pink-600 text-white"
                        : "bg-gradient-to-br from-green-500 to-teal-600 text-white"
                    }`}>
                      {getProfileIcon(profile.role)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {getProfileLabel(profile)}
                      </div>
                      {profile.isDefault && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Profilo predefinito
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}

                {/* Remember Choice Checkbox */}
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Checkbox
                    id="rememberChoice"
                    checked={rememberChoice}
                    onCheckedChange={(checked) => setRememberChoice(checked === true)}
                  />
                  <Label htmlFor="rememberChoice" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Ricorda la mia scelta
                  </Label>
                </div>

                {/* Back Button */}
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => {
                    setShowProfileSelection(false);
                    setProfiles([]);
                    setTempToken(null);
                  }}
                >
                  Torna al login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Side - Same as login */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-12 items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10 max-w-lg space-y-8 text-white">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold leading-tight">
                Scegli il tuo profilo
              </h2>
              <p className="text-xl text-blue-100 leading-relaxed">
                Hai accesso a più profili con la stessa email. Seleziona quello con cui vuoi accedere ora.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-gray-100 dark:via-blue-200 dark:to-indigo-100 bg-clip-text text-transparent">
              Bentornato
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Accedi per continuare il tuo percorso
            </p>
          </div>

          {/* Login Form */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-xl">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@esempio.com"
                    className="h-12 text-base border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    {...form.register("email")}
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1" data-testid="error-email">
                      <span className="w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-12 text-base pr-12 border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                      {...form.register("password")}
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1" data-testid="error-password">
                      <span className="w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 group"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Accesso in corso...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Accedi
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>

              </form>

              {/* Demo Notice */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                  <strong>💡 Demo:</strong> Usa qualsiasi email valida e password (min. 6 caratteri) per provare la piattaforma
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>Sicuro</span>
            </div>
            <div className="w-1 h-1 bg-gray-300 dark:bg-gray-800 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>Veloce</span>
            </div>
            <div className="w-1 h-1 bg-gray-300 dark:bg-gray-800 rounded-full"></div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span>Affidabile</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Showcase */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-12 items-center justify-center relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg space-y-8 text-white">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold leading-tight">
              Il Tuo Percorso verso la Libertà Finanziaria
            </h2>
            <p className="text-xl text-blue-100 leading-relaxed">
              Una piattaforma completa che ti accompagna passo-passo verso i tuoi obiettivi, con il supporto del tuo consulente e dell'intelligenza artificiale.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-6 pt-6">
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">AI Assistant 24/7</h3>
                <p className="text-blue-100 text-sm">Il tuo tutor personale sempre disponibile per rispondere alle tue domande</p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Tracciamento Progressi</h3>
                <p className="text-blue-100 text-sm">Monitora i tuoi risultati con dashboard e grafici dettagliati</p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Percorso Personalizzato</h3>
                <p className="text-blue-100 text-sm">Lezioni ed esercizi su misura per la tua situazione finanziaria</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
            <div>
              <div className="text-3xl font-bold">95%</div>
              <div className="text-sm text-blue-100">Soddisfazione</div>
            </div>
            <div>
              <div className="text-3xl font-bold">15k+</div>
              <div className="text-sm text-blue-100">Lezioni Completate</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-blue-100">Supporto AI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
