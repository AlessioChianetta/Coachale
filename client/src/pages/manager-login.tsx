import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const managerLoginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Password deve essere almeno 6 caratteri"),
  rememberMe: z.boolean().optional(),
});

type ManagerLoginFormData = z.infer<typeof managerLoginSchema>;

interface AgentInfo {
  id: string;
  name: string;
  slug: string;
  requiresLogin: boolean;
}

export default function ManagerLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { toast } = useToast();

  const { data: agentInfo, isLoading: isLoadingAgent, error: agentError } = useQuery<AgentInfo>({
    queryKey: ["public-agent", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/agent/${slug}`);
      if (!response.ok) {
        throw new Error("Agente non trovato");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (agentInfo && !agentInfo.requiresLogin) {
      setLocation(`/agent/${slug}/chat`);
    }
  }, [agentInfo, slug, setLocation]);

  const form = useForm<ManagerLoginFormData>({
    resolver: zodResolver(managerLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: ManagerLoginFormData) => {
      const response = await fetch("/api/managers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          slug,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Credenziali non valide");
      }
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("manager_token", data.token);
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto!",
      });
      setLocation(`/agent/${slug}/chat`);
    },
    onError: (error: any) => {
      toast({
        title: "Errore di accesso",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ManagerLoginFormData) => {
    loginMutation.mutate(data);
  };

  if (isLoadingAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (agentError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Agente non trovato</h2>
            <p className="text-slate-500">Il link potrebbe essere errato o l'agente non esiste più.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Brand Panel (40%) */}
      <div className="lg:w-[40%] bg-gradient-to-br from-slate-900 to-teal-900/50 p-8 lg:p-12 flex items-center justify-center relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-48 h-48 bg-cyan-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-teal-400 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center lg:text-left space-y-6 text-white max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-bold">
              {agentInfo?.name || "Assistente"}
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              Benvenuto! Accedi per iniziare la tua conversazione con il nostro assistente intelligente.
            </p>
          </div>

          {/* Hidden on mobile, visible on desktop */}
          <div className="hidden lg:block pt-8 border-t border-white/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Area Riservata</p>
                <p className="text-xs text-slate-400">Accesso sicuro e protetto</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form Panel (60%) */}
      <div className="lg:w-[60%] flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
              Accedi
            </h2>
            <p className="text-slate-500">
              Inserisci le tue credenziali per continuare
            </p>
          </div>

          {/* Login Form */}
          <Card className="border-slate-200 shadow-xl">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@esempio.com"
                      className="h-12 pl-11 text-base border-slate-300 focus:border-cyan-500 focus:ring-cyan-500 transition-colors"
                      {...form.register("email")}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-12 pl-11 pr-12 text-base border-slate-300 focus:border-cyan-500 focus:ring-cyan-500 transition-colors"
                      {...form.register("password")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={form.watch("rememberMe")}
                    onCheckedChange={(checked) => form.setValue("rememberMe", checked === true)}
                    className="border-slate-300 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                  />
                  <Label
                    htmlFor="rememberMe"
                    className="text-sm text-slate-600 cursor-pointer"
                  >
                    Ricordami
                  </Label>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 group"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
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
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-slate-400">
            Powered by AI Assistant
          </p>
        </div>
      </div>
    </div>
  );
}
