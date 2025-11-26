import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  CheckCircle,
  Info,
  UserCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

export default function ConsultantProfileSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });

  // Load existing profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/consultant/profile"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/profile", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      return response.json();
    },
  });

  // Update form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
      });
    }
  }, [profile]);

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const response = await fetch("/api/consultant/profile", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "✅ Profilo aggiornato",
        description: "Le tue informazioni sono state salvate con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore durante il salvataggio del profilo",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Optional field
    
    // Remove spaces and common separators
    const cleaned = phone.replace(/[\s\-\.]/g, "");
    
    // Valid formats:
    // +393501234567
    // 3501234567
    // 00393501234567
    const phoneRegex = /^(\+39|0039)?3\d{8,9}$/;
    
    return phoneRegex.test(cleaned);
  };

  const handleSave = () => {
    // Validate phone number if provided
    if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
      toast({
        title: "❌ Numero non valido",
        description: "Inserisci un numero di telefono italiano valido (es. +393501234567 o 3501234567)",
        variant: "destructive",
      });
      return;
    }

    // Normalize phone number (remove spaces, ensure +39 prefix if it's an Italian number)
    let normalizedPhone = formData.phoneNumber;
    if (normalizedPhone) {
      normalizedPhone = normalizedPhone.replace(/[\s\-\.]/g, "");
      
      // Add +39 if it's a mobile number without prefix
      if (/^3\d{8,9}$/.test(normalizedPhone)) {
        normalizedPhone = "+39" + normalizedPhone;
      }
      // Convert 0039 to +39
      if (normalizedPhone.startsWith("0039")) {
        normalizedPhone = "+39" + normalizedPhone.substring(4);
      }
    }

    const dataToSave = {
      ...formData,
      phoneNumber: normalizedPhone,
    };

    saveMutation.mutate(dataToSave);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600">Caricamento profilo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <UserCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">Profilo Consulente</h1>
                  <p className="text-blue-100 text-lg">
                    Gestisci le tue informazioni personali
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="max-w-4xl mx-auto space-y-6">
            {/* WhatsApp Integration Info */}
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Integrazione WhatsApp:</strong> Inserendo il tuo numero di telefono,
                quando scriverai da WhatsApp al sistema, sarai riconosciuto come consulente e
                avrai accesso completo a tutti i dati come se fossi dentro l'app.
              </AlertDescription>
            </Alert>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-6 w-6" />
                  Informazioni Personali
                </CardTitle>
                <CardDescription>
                  Aggiorna le tue informazioni di contatto e profilo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-semibold">
                    Nome *
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Mario"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="h-11"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-semibold">
                    Cognome *
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Rossi"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="h-11"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">
                    Email *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario.rossi@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="h-11 pl-10"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    L'email non può essere modificata
                  </p>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-semibold">
                    Numero di Telefono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+393501234567 o 3501234567"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Formato: +393501234567 (con +39) oppure 3501234567 (senza prefisso)
                  </p>
                  {formData.phoneNumber && validatePhoneNumber(formData.phoneNumber) && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>Numero valido</span>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-5 w-5" />
                        Salva Modifiche
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Recognition Status */}
            {formData.phoneNumber && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-6 w-6" />
                    Riconoscimento WhatsApp Attivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Quando scriverai al sistema da WhatsApp con il numero:
                  </p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <Badge variant="outline" className="text-lg font-mono">
                      {formData.phoneNumber}
                    </Badge>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Sarai automaticamente riconosciuto come <strong>Consulente</strong> e
                    potrai accedere a tutti i dati, clienti, esercizi e appuntamenti come
                    se fossi dentro l'applicazione.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
