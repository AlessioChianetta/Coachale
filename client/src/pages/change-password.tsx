import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, Lock, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthUser, setAuthUser, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useEffect } from "react";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password attuale richiesta"),
  newPassword: z.string().min(8, "La nuova password deve avere almeno 8 caratteri"),
  confirmPassword: z.string().min(1, "Conferma la nuova password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Small delay to allow auth storage to be populated after login redirect
    const checkAuth = () => {
      const authUser = getAuthUser();
      if (!isAuthenticated() || !authUser) {
        // Check again after a short delay in case login just happened
        setTimeout(() => {
          const retryUser = getAuthUser();
          if (!isAuthenticated() || !retryUser) {
            setLocation("/login");
          } else {
            setUser(retryUser);
            setIsLoading(false);
          }
        }, 100);
      } else {
        setUser(authUser);
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [setLocation]);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormData) => {
      // Determine the correct endpoint based on user tier
      // Bronze users: /api/bronze-auth/change-password
      // Silver/Gold users: /api/auth/subscription/change-password  
      // Regular users (in users table): /api/auth/change-password
      const tier = user?.tier;
      const bronzeToken = localStorage.getItem("bronzeToken");
      
      let endpoint = "/api/auth/change-password";
      if (bronzeToken || tier === "bronze" || tier === "1") {
        endpoint = "/api/bronze/change-password"; // Router mounted at /api/bronze
      } else if (tier === "silver" || tier === "gold" || tier === "2" || tier === "3") {
        endpoint = "/api/auth/subscription/change-password";
      }
      
      console.log("[CHANGE-PASSWORD] Using endpoint:", endpoint, "tier:", tier, "hasBronzeToken:", !!bronzeToken);
      
      const token = localStorage.getItem('token');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      console.log("[CHANGE-PASSWORD] Response status:", response.status);
      
      const text = await response.text();
      console.log("[CHANGE-PASSWORD] Response body:", text);
      
      if (!response.ok) {
        let errorMessage = 'Errore durante il cambio password';
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          console.error("[CHANGE-PASSWORD] Failed to parse error response:", text);
        }
        throw new Error(errorMessage);
      }
      
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("[CHANGE-PASSWORD] Failed to parse success response:", text);
        // If parsing fails but status was OK, treat as success
        return { success: true, message: text || "Password aggiornata con successo" };
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Password aggiornata",
        description: "La tua password è stata cambiata con successo!",
      });

      if (user) {
        setAuthUser({ ...user, mustChangePassword: false } as any);
      }

      setTimeout(() => {
        const tier = user?.tier;
        const bronzeToken = localStorage.getItem("bronzeToken");
        
        // Get consultant slug for redirect (check multiple storage keys)
        const consultantSlug = user?.consultantSlug || 
                               localStorage.getItem("consultantSlug") || 
                               localStorage.getItem("bronzePublicSlug");
        
        // Gold with client role goes to /client
        if ((tier === "gold" || tier === "3") && user?.role === "client") {
          setLocation("/client");
        }
        // Bronze/Silver subscription-only users go to select-agent
        else if (bronzeToken || tier === "bronze" || tier === "1" || tier === "silver" || tier === "2") {
          if (consultantSlug) {
            setLocation(`/c/${consultantSlug}/select-agent`);
          } else {
            setLocation("/select-agent");
          }
        }
        // Gold without client role (subscription-only) also goes to select-agent
        else if (tier === "gold" || tier === "3") {
          if (consultantSlug) {
            setLocation(`/c/${consultantSlug}/select-agent`);
          } else {
            setLocation("/select-agent");
          }
        }
        else if (user?.role === "super_admin") {
          setLocation("/admin");
        } else if (user?.role === "consultant") {
          setLocation("/consultant");
        } else if (user?.role === "client") {
          setLocation("/client");
        } else {
          // Fallback
          setLocation("/");
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare la password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" data-testid="change-password-page">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
        
        <div className="relative z-10 max-w-lg text-center text-white space-y-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-6">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            Proteggi il tuo Account
          </h2>
          <p className="text-xl text-blue-100 leading-relaxed">
            Una password sicura è il primo passo per proteggere i tuoi dati e la tua privacy.
          </p>
          
          <div className="grid grid-cols-1 gap-4 pt-8">
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Minimo 8 caratteri</div>
                <div className="text-sm text-blue-200">Per una maggiore sicurezza</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-gray-100 dark:via-blue-200 dark:to-indigo-100 bg-clip-text text-transparent">
              Cambia la tua Password
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Per la tua sicurezza, scegli una nuova password personale
            </p>
          </div>

          <Card className="border-gray-200 dark:border-gray-800 shadow-xl">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password attuale
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Inserisci la password attuale"
                      className="pr-12 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      {...form.register("currentPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.formState.errors.currentPassword && (
                    <p className="text-sm text-red-500">{form.formState.errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nuova password
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimo 8 caratteri"
                      className="pr-12 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      {...form.register("newPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.formState.errors.newPassword && (
                    <p className="text-sm text-red-500">{form.formState.errors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Conferma nuova password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ripeti la nuova password"
                      className="pr-12 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      {...form.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {changePasswordMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Aggiornamento in corso...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Cambia Password
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
