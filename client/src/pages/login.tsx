
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { loginSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { setToken, setAuthUser, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useEffect } from "react";

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (data) => {
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
    },
    onError: (error: any) => {
      toast({
        title: "Errore di accesso",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

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

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                      Non hai un account?
                    </span>
                  </div>
                </div>

                {/* Register Link */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base font-semibold border-2 border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200"
                  onClick={() => setLocation("/register")}
                  data-testid="link-register"
                >
                  Crea un account gratuito
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
