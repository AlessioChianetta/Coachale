import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Building2,
  Globe,
  Briefcase,
  Target,
  Heart,
  Brain,
  MessageSquare,
  GraduationCap,
  Award,
  Languages,
  MapPin,
  Linkedin,
  Instagram,
  Palette,
  BookOpen,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BasicProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

interface DetailedProfileData {
  professionalTitle: string;
  tagline: string;
  bio: string;
  yearsOfExperience: string;
  certifications: string;
  education: string;
  languagesSpoken: string;
  businessName: string;
  businessType: string;
  vatNumber: string;
  businessAddress: string;
  websiteUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  servicesOffered: string;
  specializations: string;
  methodology: string;
  toolsUsed: string;
  idealClientDescription: string;
  industriesServed: string;
  clientAgeRange: string;
  geographicFocus: string;
  consultationStyle: string;
  initialProcess: string;
  sessionDuration: string;
  followUpApproach: string;
  coreValues: string;
  missionStatement: string;
  visionStatement: string;
  uniqueSellingProposition: string;
  additionalContext: string;
  toneOfVoice: string;
  topicsToAvoid: string;
  brandName: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandFaviconUrl: string;
}

const defaultDetailedData: DetailedProfileData = {
  professionalTitle: "",
  tagline: "",
  bio: "",
  yearsOfExperience: "",
  certifications: "",
  education: "",
  languagesSpoken: "",
  businessName: "",
  businessType: "",
  vatNumber: "",
  businessAddress: "",
  websiteUrl: "",
  linkedinUrl: "",
  instagramUrl: "",
  servicesOffered: "",
  specializations: "",
  methodology: "",
  toolsUsed: "",
  idealClientDescription: "",
  industriesServed: "",
  clientAgeRange: "",
  geographicFocus: "",
  consultationStyle: "",
  initialProcess: "",
  sessionDuration: "",
  followUpApproach: "",
  coreValues: "",
  missionStatement: "",
  visionStatement: "",
  uniqueSellingProposition: "",
  additionalContext: "",
  toneOfVoice: "",
  topicsToAvoid: "",
  brandName: "",
  brandLogoUrl: "",
  brandPrimaryColor: "#06b6d4",
  brandSecondaryColor: "#14b8a6",
  brandFaviconUrl: "",
};

export default function ConsultantProfileSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [basicFormData, setBasicFormData] = useState<BasicProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });

  const [detailedFormData, setDetailedFormData] = useState<DetailedProfileData>({ ...defaultDetailedData });

  const { data: profile, isLoading: isLoadingBasic } = useQuery({
    queryKey: ["/api/consultant/profile"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/profile", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  const { data: detailedProfile, isLoading: isLoadingDetailed } = useQuery({
    queryKey: ["/api/consultant/detailed-profile"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/detailed-profile", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch detailed profile");
      return response.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setBasicFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (detailedProfile) {
      setDetailedFormData({
        professionalTitle: detailedProfile.professionalTitle || "",
        tagline: detailedProfile.tagline || "",
        bio: detailedProfile.bio || "",
        yearsOfExperience: detailedProfile.yearsOfExperience?.toString() || "",
        certifications: detailedProfile.certifications || "",
        education: detailedProfile.education || "",
        languagesSpoken: detailedProfile.languagesSpoken || "",
        businessName: detailedProfile.businessName || "",
        businessType: detailedProfile.businessType || "",
        vatNumber: detailedProfile.vatNumber || "",
        businessAddress: detailedProfile.businessAddress || "",
        websiteUrl: detailedProfile.websiteUrl || "",
        linkedinUrl: detailedProfile.linkedinUrl || "",
        instagramUrl: detailedProfile.instagramUrl || "",
        servicesOffered: detailedProfile.servicesOffered || "",
        specializations: detailedProfile.specializations || "",
        methodology: detailedProfile.methodology || "",
        toolsUsed: detailedProfile.toolsUsed || "",
        idealClientDescription: detailedProfile.idealClientDescription || "",
        industriesServed: detailedProfile.industriesServed || "",
        clientAgeRange: detailedProfile.clientAgeRange || "",
        geographicFocus: detailedProfile.geographicFocus || "",
        consultationStyle: detailedProfile.consultationStyle || "",
        initialProcess: detailedProfile.initialProcess || "",
        sessionDuration: detailedProfile.sessionDuration || "",
        followUpApproach: detailedProfile.followUpApproach || "",
        coreValues: detailedProfile.coreValues || "",
        missionStatement: detailedProfile.missionStatement || "",
        visionStatement: detailedProfile.visionStatement || "",
        uniqueSellingProposition: detailedProfile.uniqueSellingProposition || "",
        additionalContext: detailedProfile.additionalContext || "",
        toneOfVoice: detailedProfile.toneOfVoice || "",
        topicsToAvoid: detailedProfile.topicsToAvoid || "",
        brandName: detailedProfile.brandName || "",
        brandLogoUrl: detailedProfile.brandLogoUrl || "",
        brandPrimaryColor: detailedProfile.brandPrimaryColor || "#06b6d4",
        brandSecondaryColor: detailedProfile.brandSecondaryColor || "#14b8a6",
        brandFaviconUrl: detailedProfile.brandFaviconUrl || "",
      });
    }
  }, [detailedProfile]);

  const saveBasicMutation = useMutation({
    mutationFn: async (data: BasicProfileData) => {
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
        title: "Profilo aggiornato",
        description: "Le tue informazioni personali sono state salvate con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio del profilo",
        variant: "destructive",
      });
    },
  });

  const saveDetailedMutation = useMutation({
    mutationFn: async (data: DetailedProfileData) => {
      const response = await fetch("/api/consultant/detailed-profile", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save detailed profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/detailed-profile"] });
      toast({
        title: "Profilo dettagliato aggiornato",
        description: "Le informazioni dettagliate sono state salvate con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio del profilo dettagliato",
        variant: "destructive",
      });
    },
  });

  const handleBasicChange = (field: keyof BasicProfileData, value: string) => {
    setBasicFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDetailedChange = (field: keyof DetailedProfileData, value: string) => {
    setDetailedFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true;
    const cleaned = phone.replace(/[\s\-\.]/g, "");
    const phoneRegex = /^(\+39|0039)?3\d{8,9}$/;
    return phoneRegex.test(cleaned);
  };

  const handleSaveBasic = () => {
    if (basicFormData.phoneNumber && !validatePhoneNumber(basicFormData.phoneNumber)) {
      toast({
        title: "Numero non valido",
        description: "Inserisci un numero di telefono italiano valido (es. +393501234567 o 3501234567)",
        variant: "destructive",
      });
      return;
    }

    let normalizedPhone = basicFormData.phoneNumber;
    if (normalizedPhone) {
      normalizedPhone = normalizedPhone.replace(/[\s\-\.]/g, "");
      if (/^3\d{8,9}$/.test(normalizedPhone)) {
        normalizedPhone = "+39" + normalizedPhone;
      }
      if (normalizedPhone.startsWith("0039")) {
        normalizedPhone = "+39" + normalizedPhone.substring(4);
      }
    }

    saveBasicMutation.mutate({ ...basicFormData, phoneNumber: normalizedPhone });
  };

  const handleSaveDetailed = () => {
    saveDetailedMutation.mutate(detailedFormData);
  };

  const isLoading = isLoadingBasic || isLoadingDetailed;

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

  const SaveButton = ({ onClick, isPending, label = "Salva Modifiche" }: { onClick: () => void; isPending: boolean; label?: string }) => (
    <div className="flex gap-3 pt-4">
      <Button
        onClick={onClick}
        disabled={isPending}
        className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Salvataggio...
          </>
        ) : (
          <>
            <Save className="mr-2 h-5 w-5" />
            {label}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <UserCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">Profilo Consulente</h1>
                  <p className="text-blue-100 text-lg">
                    Il tuo profilo completo - queste informazioni saranno utilizzate dall'AI per personalizzare le risposte
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  <Info className="w-3 h-3 mr-1" />
                  Tutte le informazioni che inserisci qui verranno utilizzate dall'AI per conoscerti meglio e personalizzare le risposte
                </Badge>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className={`${isMobile ? "flex flex-wrap h-auto gap-1 p-2" : "grid grid-cols-5 lg:grid-cols-9 h-auto gap-1 p-2"} w-full bg-white/80 backdrop-blur-sm rounded-xl mb-6 shadow-sm`}>
                <TabsTrigger value="personal" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <User className="w-3 h-3" /> Personali
                </TabsTrigger>
                <TabsTrigger value="identity" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <GraduationCap className="w-3 h-3" /> Chi Sei
                </TabsTrigger>
                <TabsTrigger value="business" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Building2 className="w-3 h-3" /> Attività
                </TabsTrigger>
                <TabsTrigger value="services" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Briefcase className="w-3 h-3" /> Cosa Fai
                </TabsTrigger>
                <TabsTrigger value="target" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Target className="w-3 h-3" /> Target
                </TabsTrigger>
                <TabsTrigger value="approach" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <MessageSquare className="w-3 h-3" /> Approccio
                </TabsTrigger>
                <TabsTrigger value="values" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Heart className="w-3 h-3" /> Valori
                </TabsTrigger>
                <TabsTrigger value="ai-context" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Brain className="w-3 h-3" /> AI
                </TabsTrigger>
                <TabsTrigger value="brand" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Palette className="h-3 w-3" /> Brand
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Informazioni Personali */}
              <TabsContent value="personal" className="space-y-6">
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
                      <User className="h-6 w-6 text-blue-600" />
                      Informazioni Personali
                    </CardTitle>
                    <CardDescription>
                      Aggiorna le tue informazioni di contatto e profilo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-semibold">Nome *</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Mario"
                        value={basicFormData.firstName}
                        onChange={(e) => handleBasicChange("firstName", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-semibold">Cognome *</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Rossi"
                        value={basicFormData.lastName}
                        onChange={(e) => handleBasicChange("lastName", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="mario.rossi@example.com"
                          value={basicFormData.email}
                          onChange={(e) => handleBasicChange("email", e.target.value)}
                          className="h-11 pl-10"
                          disabled
                        />
                      </div>
                      <p className="text-xs text-gray-500">L'email non può essere modificata</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="text-sm font-semibold">Numero di Telefono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="+393501234567 o 3501234567"
                          value={basicFormData.phoneNumber}
                          onChange={(e) => handleBasicChange("phoneNumber", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Formato: +393501234567 (con +39) oppure 3501234567 (senza prefisso)</p>
                      {basicFormData.phoneNumber && validatePhoneNumber(basicFormData.phoneNumber) && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          <span>Numero valido</span>
                        </div>
                      )}
                    </div>

                    <SaveButton onClick={handleSaveBasic} isPending={saveBasicMutation.isPending} />
                  </CardContent>
                </Card>

                {basicFormData.phoneNumber && (
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
                          {basicFormData.phoneNumber}
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
              </TabsContent>

              {/* Tab 2: Chi Sei */}
              <TabsContent value="identity">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-6 w-6 text-purple-600" />
                      Chi Sei
                    </CardTitle>
                    <CardDescription>
                      Racconta la tua identità professionale, esperienza e formazione
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Titolo Professionale</Label>
                      <Input
                        placeholder="Consulente Finanziario Indipendente"
                        value={detailedFormData.professionalTitle}
                        onChange={(e) => handleDetailedChange("professionalTitle", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Tagline</Label>
                      <Input
                        placeholder="Aiuto professionisti a costruire il loro futuro finanziario"
                        value={detailedFormData.tagline}
                        onChange={(e) => handleDetailedChange("tagline", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Bio / Presentazione</Label>
                      <Textarea
                        rows={4}
                        placeholder="Racconta chi sei, la tua storia professionale..."
                        value={detailedFormData.bio}
                        onChange={(e) => handleDetailedChange("bio", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Anni di Esperienza</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={detailedFormData.yearsOfExperience}
                        onChange={(e) => handleDetailedChange("yearsOfExperience", e.target.value)}
                        className="h-11 w-32"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Award className="w-4 h-4" /> Certificazioni e Qualifiche
                      </Label>
                      <Textarea
                        placeholder="OCF, CFA, EFPA..."
                        value={detailedFormData.certifications}
                        onChange={(e) => handleDetailedChange("certifications", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Formazione / Istruzione</Label>
                      <Textarea
                        placeholder="Laurea in Economia, Master in..."
                        value={detailedFormData.education}
                        onChange={(e) => handleDetailedChange("education", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Languages className="w-4 h-4" /> Lingue Parlate
                      </Label>
                      <Input
                        placeholder="Italiano, Inglese, Francese"
                        value={detailedFormData.languagesSpoken}
                        onChange={(e) => handleDetailedChange("languagesSpoken", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Chi Sei" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: La Tua Attività */}
              <TabsContent value="business">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-emerald-600" />
                      La Tua Attività
                    </CardTitle>
                    <CardDescription>
                      Informazioni sulla tua attività professionale e contatti online
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Nome Attività / Studio</Label>
                      <Input
                        placeholder="Studio Rossi & Associati"
                        value={detailedFormData.businessName}
                        onChange={(e) => handleDetailedChange("businessName", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Tipo di Attività</Label>
                      <Input
                        placeholder="Studio associato, Libero professionista, SRL..."
                        value={detailedFormData.businessType}
                        onChange={(e) => handleDetailedChange("businessType", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Partita IVA</Label>
                      <Input
                        placeholder="IT12345678901"
                        value={detailedFormData.vatNumber}
                        onChange={(e) => handleDetailedChange("vatNumber", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Indirizzo Sede
                      </Label>
                      <Input
                        placeholder="Via Roma 1, 20121 Milano"
                        value={detailedFormData.businessAddress}
                        onChange={(e) => handleDetailedChange("businessAddress", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Sito Web
                      </Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="https://www.tuosito.it"
                          value={detailedFormData.websiteUrl}
                          onChange={(e) => handleDetailedChange("websiteUrl", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Linkedin className="w-4 h-4" /> LinkedIn
                      </Label>
                      <div className="relative">
                        <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="https://linkedin.com/in/tuoprofilo"
                          value={detailedFormData.linkedinUrl}
                          onChange={(e) => handleDetailedChange("linkedinUrl", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Instagram className="w-4 h-4" /> Instagram
                      </Label>
                      <div className="relative">
                        <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="@tuoprofilo"
                          value={detailedFormData.instagramUrl}
                          onChange={(e) => handleDetailedChange("instagramUrl", e.target.value)}
                          className="h-11 pl-10"
                        />
                      </div>
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Attività" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Cosa Fai */}
              <TabsContent value="services">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-6 w-6 text-amber-600" />
                      Cosa Fai
                    </CardTitle>
                    <CardDescription>
                      Descrivi i tuoi servizi, specializzazioni e metodologia di lavoro
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Servizi Offerti</Label>
                      <Textarea
                        rows={4}
                        placeholder="Pianificazione finanziaria, Gestione portafoglio, Consulenza previdenziale..."
                        value={detailedFormData.servicesOffered}
                        onChange={(e) => handleDetailedChange("servicesOffered", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Specializzazioni</Label>
                      <Textarea
                        placeholder="Investimenti ESG, Pianificazione successoria..."
                        value={detailedFormData.specializations}
                        onChange={(e) => handleDetailedChange("specializations", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Metodologia di Lavoro</Label>
                      <Textarea
                        placeholder="Descrivi il tuo approccio metodologico..."
                        value={detailedFormData.methodology}
                        onChange={(e) => handleDetailedChange("methodology", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Strumenti e Piattaforme Utilizzate</Label>
                      <Textarea
                        placeholder="Bloomberg, Morningstar, Excel avanzato..."
                        value={detailedFormData.toolsUsed}
                        onChange={(e) => handleDetailedChange("toolsUsed", e.target.value)}
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Servizi" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 5: Il Tuo Target */}
              <TabsContent value="target">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-6 w-6 text-red-600" />
                      Il Tuo Target
                    </CardTitle>
                    <CardDescription>
                      Definisci il tuo cliente ideale e il mercato di riferimento
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Descrizione Cliente Ideale</Label>
                      <Textarea
                        rows={4}
                        placeholder="Professionisti 35-55 anni con patrimonio..."
                        value={detailedFormData.idealClientDescription}
                        onChange={(e) => handleDetailedChange("idealClientDescription", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Settori Serviti</Label>
                      <Textarea
                        placeholder="Medici, Avvocati, Imprenditori PMI..."
                        value={detailedFormData.industriesServed}
                        onChange={(e) => handleDetailedChange("industriesServed", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Fascia di Età Target</Label>
                      <Input
                        placeholder="30-60 anni"
                        value={detailedFormData.clientAgeRange}
                        onChange={(e) => handleDetailedChange("clientAgeRange", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Focus Geografico
                      </Label>
                      <Input
                        placeholder="Milano e Lombardia, Nord Italia"
                        value={detailedFormData.geographicFocus}
                        onChange={(e) => handleDetailedChange("geographicFocus", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Target" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 6: Il Tuo Approccio */}
              <TabsContent value="approach">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-6 w-6 text-teal-600" />
                      Il Tuo Approccio
                    </CardTitle>
                    <CardDescription>
                      Descrivi come lavori con i tuoi clienti e il tuo stile di consulenza
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Stile di Consulenza</Label>
                      <Textarea
                        placeholder="Empatico e educativo, Diretto e pragmatico..."
                        value={detailedFormData.consultationStyle}
                        onChange={(e) => handleDetailedChange("consultationStyle", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Processo Iniziale con Nuovi Clienti</Label>
                      <Textarea
                        placeholder="Prima consulenza gratuita, Analisi patrimoniale..."
                        value={detailedFormData.initialProcess}
                        onChange={(e) => handleDetailedChange("initialProcess", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Durata Tipica delle Sessioni</Label>
                      <Input
                        placeholder="60 minuti"
                        value={detailedFormData.sessionDuration}
                        onChange={(e) => handleDetailedChange("sessionDuration", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Approccio al Follow-up</Label>
                      <Textarea
                        placeholder="Report mensile, Check-in trimestrale..."
                        value={detailedFormData.followUpApproach}
                        onChange={(e) => handleDetailedChange("followUpApproach", e.target.value)}
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Approccio" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 7: Valori e Visione */}
              <TabsContent value="values">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-6 w-6 text-rose-600" />
                      Valori e Visione
                    </CardTitle>
                    <CardDescription>
                      Condividi i tuoi valori fondamentali, la tua mission e la tua vision
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Valori Fondamentali</Label>
                      <Textarea
                        placeholder="Trasparenza, Indipendenza, Educazione finanziaria..."
                        value={detailedFormData.coreValues}
                        onChange={(e) => handleDetailedChange("coreValues", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Mission</Label>
                      <Textarea
                        placeholder="La mia missione è..."
                        value={detailedFormData.missionStatement}
                        onChange={(e) => handleDetailedChange("missionStatement", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Vision</Label>
                      <Textarea
                        placeholder="La mia visione è..."
                        value={detailedFormData.visionStatement}
                        onChange={(e) => handleDetailedChange("visionStatement", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Proposta di Valore Unica</Label>
                      <Textarea
                        placeholder="Cosa ti rende diverso dagli altri consulenti?"
                        value={detailedFormData.uniqueSellingProposition}
                        onChange={(e) => handleDetailedChange("uniqueSellingProposition", e.target.value)}
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Valori" />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 8: Contesto AI */}
              <TabsContent value="ai-context">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-6 w-6 text-violet-600" />
                      Contesto AI
                    </CardTitle>
                    <CardDescription>
                      Personalizza come l'AI interagisce con te e i tuoi clienti
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Contesto Aggiuntivo per l'AI</Label>
                      <Textarea
                        rows={5}
                        placeholder="Informazioni extra che vuoi che l'AI sappia di te..."
                        value={detailedFormData.additionalContext}
                        onChange={(e) => handleDetailedChange("additionalContext", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Tono di Voce Preferito</Label>
                      <Input
                        placeholder="Professionale ma amichevole, Formale, Informale..."
                        value={detailedFormData.toneOfVoice}
                        onChange={(e) => handleDetailedChange("toneOfVoice", e.target.value)}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Argomenti da Evitare</Label>
                      <Textarea
                        placeholder="Temi o argomenti che preferisci evitare nelle risposte AI..."
                        value={detailedFormData.topicsToAvoid}
                        onChange={(e) => handleDetailedChange("topicsToAvoid", e.target.value)}
                      />
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Contesto AI" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="brand">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-6 w-6 text-cyan-600" />
                      Personalizzazione Brand
                    </CardTitle>
                    <CardDescription>
                      Personalizza l'aspetto della piattaforma con il tuo brand (white-label per reseller)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Nome Brand</Label>
                      <Input
                        placeholder="Il nome del tuo brand (es. 'Studio Rossi Consulenza')"
                        value={detailedFormData.brandName}
                        onChange={(e) => handleDetailedChange("brandName", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-slate-500">Sostituisce "Consulente Pro" nella sidebar e nel loader</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">URL Logo</Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={detailedFormData.brandLogoUrl}
                        onChange={(e) => handleDetailedChange("brandLogoUrl", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-slate-500">Sostituisce l'icona predefinita nella sidebar e nel loader</p>
                      {detailedFormData.brandLogoUrl && (
                        <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-3">
                          <img src={detailedFormData.brandLogoUrl} alt="Preview logo" className="h-10 w-10 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="text-xs text-slate-500">Anteprima logo</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Colore Primario</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={detailedFormData.brandPrimaryColor}
                            onChange={(e) => handleDetailedChange("brandPrimaryColor", e.target.value)}
                            className="h-11 w-14 rounded cursor-pointer border border-slate-200"
                          />
                          <Input
                            value={detailedFormData.brandPrimaryColor}
                            onChange={(e) => handleDetailedChange("brandPrimaryColor", e.target.value)}
                            className="h-11 font-mono text-sm"
                            placeholder="#06b6d4"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Colore Secondario</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={detailedFormData.brandSecondaryColor}
                            onChange={(e) => handleDetailedChange("brandSecondaryColor", e.target.value)}
                            className="h-11 w-14 rounded cursor-pointer border border-slate-200"
                          />
                          <Input
                            value={detailedFormData.brandSecondaryColor}
                            onChange={(e) => handleDetailedChange("brandSecondaryColor", e.target.value)}
                            className="h-11 font-mono text-sm"
                            placeholder="#14b8a6"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-semibold mb-3">Anteprima Colori</p>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, ${detailedFormData.brandPrimaryColor}, ${detailedFormData.brandSecondaryColor})` }}>
                          {detailedFormData.brandLogoUrl ? (
                            <img src={detailedFormData.brandLogoUrl} alt="Logo" className="h-5 w-5 rounded" />
                          ) : (
                            <BookOpen className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <span className="font-bold text-sm" style={{ color: detailedFormData.brandPrimaryColor }}>
                          {detailedFormData.brandName || "Consulente Pro"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">URL Favicon</Label>
                      <Input
                        placeholder="https://example.com/favicon.ico"
                        value={detailedFormData.brandFaviconUrl}
                        onChange={(e) => handleDetailedChange("brandFaviconUrl", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-slate-500">Sostituisce il favicon della piattaforma nel browser</p>
                    </div>

                    <SaveButton onClick={handleSaveDetailed} isPending={saveDetailedMutation.isPending} label="Salva Brand" />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
