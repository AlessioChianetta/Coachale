import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dumbbell, Eye, EyeOff } from "lucide-react";
import { registerSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { setToken, setAuthUser, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useEffect } from "react";

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      setLocation("/");
    }
  }, [setLocation]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
      role: "client",
      consultantId: "", // Added for client role
    },
  });

  // Fetch consultants for client registration
  const { data: consultants = [] } = useQuery({
    queryKey: ["/api/consultants"],
    queryFn: async () => {
      const response = await fetch("/api/consultants");
      if (!response.ok) throw new Error("Failed to fetch consultants");
      return response.json();
    },
    enabled: form.watch("role") === "client",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const registrationData = {
        ...data,
        consultantId: data.role === "client" && data.consultantId ? data.consultantId : null,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      setAuthUser(data.user);
      toast({
        title: "Registrazione completata",
        description: "Account creato con successo!",
      });

      // Redirect based on user role
      if (data.user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore di registrazione",
        description: error.message || "Si è verificato un errore durante la registrazione",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="register-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Dumbbell className="text-white" size={24} />
            </div>
          </div>
          <CardTitle className="text-2xl font-heading">Registrati a Consulente Pro</CardTitle>
          <p className="text-muted-foreground">Crea il tuo account per iniziare</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Tipo di account</Label>
              <RadioGroup
                value={form.watch("role")}
                onValueChange={(value: "consultant" | "client") => {
                  form.setValue("role", value);
                  form.setValue("consultantId", ""); // Reset consultantId when role changes
                }}
                className="flex space-x-4"
                data-testid="radio-role"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="client" data-testid="radio-client" />
                  <Label htmlFor="client">Cliente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="consultant" id="consultant" data-testid="radio-consultant" />
                  <Label htmlFor="consultant">Consulente</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  placeholder="Mario"
                  {...form.register("firstName")}
                  data-testid="input-firstName"
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-destructive" data-testid="error-firstName">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Cognome</Label>
                <Input
                  id="lastName"
                  placeholder="Rossi"
                  {...form.register("lastName")}
                  data-testid="input-lastName"
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-destructive" data-testid="error-lastName">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-2">
              <Label htmlFor="username">Nome utente</Label>
              <Input
                id="username"
                placeholder="mario.rossi"
                {...form.register("username")}
                data-testid="input-username"
              />
              {form.formState.errors.username && (
                <p className="text-sm text-destructive" data-testid="error-username">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="mario@email.com"
                {...form.register("email")}
                data-testid="input-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive" data-testid="error-email">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("password")}
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive" data-testid="error-password">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("confirmPassword")}
                  data-testid="input-confirmPassword"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  data-testid="button-toggle-confirmPassword"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive" data-testid="error-confirmPassword">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Consultant Selection for Client Role */}
            {form.watch("role") === "client" && (
              <div className="space-y-2">
                <Label htmlFor="consultantId">Consulente di Riferimento</Label>
                <Select
                  value={form.watch("consultantId") || undefined}
                  onValueChange={(value) => form.setValue("consultantId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona il tuo consulente" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultants.map((consultant: any) => (
                      <SelectItem key={consultant.id} value={consultant.id}>
                        {consultant.firstName} {consultant.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.consultantId && (
                  <p className="text-sm text-destructive" data-testid="error-consultantId">
                    {form.formState.errors.consultantId.message}
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
              data-testid="button-register"
            >
              {registerMutation.isPending ? "Registrazione..." : "Registrati"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Hai già un account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-primary"
                onClick={() => setLocation("/login")}
                data-testid="link-login"
              >
                Accedi
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}