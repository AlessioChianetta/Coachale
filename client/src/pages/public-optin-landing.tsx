import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Mail,
  Phone,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  MessageCircle,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  Briefcase,
  GraduationCap,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

interface QualificationFieldConfig {
  enabled: boolean;
  required: boolean;
}

interface QualificationFieldsConfig {
  role?: QualificationFieldConfig;
  companyType?: QualificationFieldConfig;
  sector?: QualificationFieldConfig;
  employeeCount?: QualificationFieldConfig;
  annualRevenue?: QualificationFieldConfig;
  currentCompany?: QualificationFieldConfig;
  currentPosition?: QualificationFieldConfig;
  yearsExperience?: QualificationFieldConfig;
  fieldOfStudy?: QualificationFieldConfig;
  university?: QualificationFieldConfig;
  motivation?: QualificationFieldConfig;
  biggestProblem?: QualificationFieldConfig;
  goal12Months?: QualificationFieldConfig;
  currentBlocker?: QualificationFieldConfig;
}

interface OptinLandingData {
  success: boolean;
  config: {
    headline: string | null;
    subheadline: string | null;
    description: string | null;
    ctaText: string | null;
    primaryColor: string | null;
    backgroundImage: string | null;
    showTestimonials: boolean;
    testimonials: any[] | null;
    thankYouMessage: string | null;
    showAiChat: boolean;
    aiAssistantIframeUrl: string | null;
    welcomeMessage: string | null;
    showQualificationFields: boolean;
    qualificationConfig: QualificationFieldsConfig | null;
  };
  consultant: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  qualificationRole: string;
  qualificationCompanyType: string;
  qualificationSector: string;
  qualificationEmployeeCount: string;
  qualificationAnnualRevenue: string;
  qualificationCurrentCompany: string;
  qualificationCurrentPosition: string;
  qualificationYearsExperience: string;
  qualificationFieldOfStudy: string;
  qualificationUniversity: string;
  qualificationMotivation: string;
  qualificationBiggestProblem: string;
  qualificationGoal12Months: string;
  qualificationCurrentBlocker: string;
}

type RoleType = 'imprenditore' | 'dipendente' | 'libero_professionista' | 'studente' | 'altro' | '';

const roleLabels: Record<string, string> = {
  imprenditore: 'Imprenditore',
  dipendente: 'Dipendente',
  libero_professionista: 'Libero Professionista',
  studente: 'Studente',
  altro: 'Altro',
};

const roleIcons: Record<string, React.ReactNode> = {
  imprenditore: <Building2 className="h-4 w-4" />,
  dipendente: <Briefcase className="h-4 w-4" />,
  libero_professionista: <Users className="h-4 w-4" />,
  studente: <GraduationCap className="h-4 w-4" />,
  altro: <User className="h-4 w-4" />,
};

export default function PublicOptinLanding() {
  const { consultantId } = useParams<{ consultantId: string }>();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    qualificationRole: '',
    qualificationCompanyType: '',
    qualificationSector: '',
    qualificationEmployeeCount: '',
    qualificationAnnualRevenue: '',
    qualificationCurrentCompany: '',
    qualificationCurrentPosition: '',
    qualificationYearsExperience: '',
    qualificationFieldOfStudy: '',
    qualificationUniversity: '',
    qualificationMotivation: '',
    qualificationBiggestProblem: '',
    qualificationGoal12Months: '',
    qualificationCurrentBlocker: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);

  const { data, isLoading, error } = useQuery<OptinLandingData>({
    queryKey: ['/public/optin', consultantId],
    queryFn: async () => {
      const response = await fetch(`/api/public/optin/${consultantId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Pagina non trovata o non attiva');
        throw new Error('Errore nel caricamento');
      }
      return response.json();
    },
    enabled: !!consultantId,
  });

  const submitMutation = useMutation({
    mutationFn: async (submissionData: FormData) => {
      const qualConfig = data?.config?.qualificationConfig;
      const getFieldValue = (fieldName: keyof QualificationFieldsConfig, formValue: string): string | null => {
        if (!qualConfig?.[fieldName]?.enabled) return null;
        return formValue.trim() || null;
      };

      const response = await fetch(`/api/public/optin/${consultantId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: submissionData.firstName,
          lastName: submissionData.lastName || null,
          email: submissionData.email,
          phone: submissionData.phone,
          qualificationRole: getFieldValue('role', submissionData.qualificationRole),
          qualificationCompanyType: getFieldValue('companyType', submissionData.qualificationCompanyType),
          qualificationSector: getFieldValue('sector', submissionData.qualificationSector),
          qualificationEmployeeCount: getFieldValue('employeeCount', submissionData.qualificationEmployeeCount),
          qualificationAnnualRevenue: getFieldValue('annualRevenue', submissionData.qualificationAnnualRevenue),
          qualificationCurrentCompany: getFieldValue('currentCompany', submissionData.qualificationCurrentCompany),
          qualificationCurrentPosition: getFieldValue('currentPosition', submissionData.qualificationCurrentPosition),
          qualificationYearsExperience: getFieldValue('yearsExperience', submissionData.qualificationYearsExperience),
          qualificationFieldOfStudy: getFieldValue('fieldOfStudy', submissionData.qualificationFieldOfStudy),
          qualificationUniversity: getFieldValue('university', submissionData.qualificationUniversity),
          qualificationMotivation: getFieldValue('motivation', submissionData.qualificationMotivation),
          qualificationBiggestProblem: getFieldValue('biggestProblem', submissionData.qualificationBiggestProblem),
          qualificationGoal12Months: getFieldValue('goal12Months', submissionData.qualificationGoal12Months),
          qualificationCurrentBlocker: getFieldValue('currentBlocker', submissionData.qualificationCurrentBlocker),
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'invio');
      }
      
      return result;
    },
    onSuccess: (result) => {
      setSubmitted(true);
      toast({
        title: 'Richiesta inviata!',
        description: result.message || 'Ti contatteremo presto.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim()) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Il nome è obbligatorio' });
      return;
    }
    if (!formData.email.trim()) {
      toast({ variant: 'destructive', title: 'Errore', description: 'L\'email è obbligatoria' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Il telefono è obbligatorio' });
      return;
    }

    const qualConfig = data?.config?.qualificationConfig;
    if (qualConfig) {
      if (qualConfig.role?.enabled && qualConfig.role?.required && !formData.qualificationRole) {
        setQualificationOpen(true);
        toast({ variant: 'destructive', title: 'Errore', description: 'Seleziona il tuo ruolo' });
        return;
      }
      
      const currentRole = formData.qualificationRole as RoleType;
      const roleSpecificFieldsMap: Record<RoleType, string[]> = {
        'imprenditore': ['companyType', 'sector', 'employeeCount', 'annualRevenue'],
        'dipendente': ['currentCompany', 'currentPosition', 'sector'],
        'libero_professionista': ['sector', 'yearsExperience'],
        'studente': ['fieldOfStudy', 'university'],
        'altro': [],
        '': [],
      };
      const commonFieldsList = ['motivation', 'biggestProblem', 'goal12Months', 'currentBlocker'];
      const visibleFields = [...commonFieldsList, ...(roleSpecificFieldsMap[currentRole] || [])];
      
      const fieldValidations: Array<{ field: keyof QualificationFieldsConfig; formField: keyof FormData; label: string }> = [
        { field: 'motivation', formField: 'qualificationMotivation', label: 'Motivazione' },
        { field: 'biggestProblem', formField: 'qualificationBiggestProblem', label: 'Problema principale' },
        { field: 'goal12Months', formField: 'qualificationGoal12Months', label: 'Obiettivo 12 mesi' },
        { field: 'currentBlocker', formField: 'qualificationCurrentBlocker', label: 'Blocco attuale' },
        { field: 'companyType', formField: 'qualificationCompanyType', label: 'Tipo di azienda' },
        { field: 'sector', formField: 'qualificationSector', label: 'Settore' },
        { field: 'employeeCount', formField: 'qualificationEmployeeCount', label: 'Numero dipendenti' },
        { field: 'annualRevenue', formField: 'qualificationAnnualRevenue', label: 'Fatturato annuo' },
        { field: 'currentCompany', formField: 'qualificationCurrentCompany', label: 'Azienda attuale' },
        { field: 'currentPosition', formField: 'qualificationCurrentPosition', label: 'Mansione attuale' },
        { field: 'yearsExperience', formField: 'qualificationYearsExperience', label: 'Anni di esperienza' },
        { field: 'fieldOfStudy', formField: 'qualificationFieldOfStudy', label: 'Campo di studio' },
        { field: 'university', formField: 'qualificationUniversity', label: 'Università' },
      ];
      for (const { field, formField, label } of fieldValidations) {
        if (!visibleFields.includes(field)) continue;
        const fieldConfig = qualConfig[field];
        if (fieldConfig?.enabled && fieldConfig?.required && !formData[formField]?.trim()) {
          setQualificationOpen(true);
          toast({ variant: 'destructive', title: 'Errore', description: `${label} è obbligatorio` });
          return;
        }
      }
    }
    
    submitMutation.mutate(formData);
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto" />
          <p className="mt-4 text-teal-700">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pagina non disponibile</h1>
          <p className="text-gray-600">
            {error?.message || 'Questa pagina non è attiva o non esiste.'}
          </p>
        </div>
      </div>
    );
  }

  const { config, consultant } = data;
  const primaryColor = config?.primaryColor || '#0d9488';
  const qualConfig = config?.qualificationConfig;

  const selectedRole = formData.qualificationRole as RoleType;

  const getRoleSpecificFields = (): string[] => {
    switch (selectedRole) {
      case 'imprenditore':
        return ['companyType', 'sector', 'employeeCount', 'annualRevenue'];
      case 'dipendente':
        return ['currentCompany', 'currentPosition', 'sector'];
      case 'libero_professionista':
        return ['sector', 'yearsExperience'];
      case 'studente':
        return ['fieldOfStudy', 'university'];
      default:
        return [];
    }
  };

  const commonFields = ['motivation', 'biggestProblem', 'goal12Months', 'currentBlocker'];

  const isFieldVisible = (fieldName: string): boolean => {
    if (!qualConfig) return false;
    const fieldConfig = qualConfig[fieldName as keyof QualificationFieldsConfig];
    return fieldConfig?.enabled ?? false;
  };

  const isFieldRequired = (fieldName: string): boolean => {
    if (!qualConfig) return false;
    const fieldConfig = qualConfig[fieldName as keyof QualificationFieldsConfig];
    return fieldConfig?.required ?? false;
  };

  const hasAnyQualificationField = qualConfig && Object.values(qualConfig).some(f => f?.enabled);

  const showAiAssistant = config.showAiChat && config.aiAssistantIframeUrl;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}30)` }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: primaryColor }}>
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Grazie!</h2>
          <p className="text-gray-600">
            {config.thankYouMessage || 'Ti contatteremo presto per fissare un appuntamento.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${primaryColor}05, ${primaryColor}20)` }}>
      {config.backgroundImage && (
        <div 
          className="fixed inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${config.backgroundImage})` }}
        />
      )}
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-lg"
        >
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}>
              {consultant.avatar ? (
                <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-white/30">
                  <AvatarImage src={consultant.avatar} alt={consultant.name} />
                  <AvatarFallback className="text-2xl bg-white/20 text-white">
                    {consultant.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-white" />
                </div>
              )}
              
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {config.headline || `Contatta ${consultant.name}`}
              </h1>
              
              {config.subheadline && (
                <p className="text-white/90 text-lg">{config.subheadline}</p>
              )}
            </div>

            <div className="p-8">
              {config.description && (
                <p className="text-gray-600 text-center mb-6">{config.description}</p>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome *</Label>
                    <Input
                      id="firstName"
                      placeholder="Mario"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      className="h-12"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Cognome</Label>
                    <Input
                      id="lastName"
                      placeholder="Rossi"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      className="h-12"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario@esempio.it"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="pl-10 h-12"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+39 333 1234567"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="pl-10 h-12"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                </div>

                {hasAnyQualificationField && (
                  <Collapsible open={qualificationOpen} onOpenChange={setQualificationOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-between w-full py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          Parlaci di te
                        </span>
                        {qualificationOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4 space-y-5">
                      {isFieldVisible('role') && (
                        <div className="space-y-3">
                          <Label className="text-gray-700 font-medium flex items-center gap-1">
                            Il tuo ruolo {isFieldRequired('role') && <span className="text-red-500">*</span>}
                          </Label>
                          <RadioGroup
                            value={formData.qualificationRole}
                            onValueChange={(value) => setFormData({ ...formData, qualificationRole: value })}
                            className="grid grid-cols-2 gap-2"
                          >
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <div key={value} className="relative">
                                <RadioGroupItem
                                  value={value}
                                  id={`role-${value}`}
                                  className="peer sr-only"
                                />
                                <Label
                                  htmlFor={`role-${value}`}
                                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer transition-all peer-data-[state=checked]:border-2 peer-data-[state=checked]:bg-gray-50 hover:bg-gray-50"
                                  style={{
                                    borderColor: formData.qualificationRole === value ? primaryColor : undefined,
                                    backgroundColor: formData.qualificationRole === value ? `${primaryColor}08` : undefined,
                                  }}
                                >
                                  <span className="text-gray-400">{roleIcons[value]}</span>
                                  <span className="text-sm font-medium text-gray-700">{label}</span>
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}

                      {selectedRole && getRoleSpecificFields().map((field) => {
                        if (!isFieldVisible(field)) return null;
                        
                        const fieldLabels: Record<string, string> = {
                          companyType: 'Tipo di azienda',
                          sector: 'Settore',
                          employeeCount: 'Numero dipendenti',
                          annualRevenue: 'Fatturato annuo',
                          currentCompany: 'Azienda dove lavori',
                          currentPosition: 'La tua mansione',
                          yearsExperience: 'Anni di esperienza',
                          fieldOfStudy: 'Campo di studio',
                          university: 'Università',
                        };
                        
                        const fieldPlaceholders: Record<string, string> = {
                          companyType: 'Es: SRL, SPA, Ditta individuale...',
                          sector: 'Es: Tecnologia, Ristorazione, Consulenza...',
                          employeeCount: 'Es: 5, 10-50, oltre 100...',
                          annualRevenue: 'Es: 100.000€, 500.000€, 1M+...',
                          currentCompany: 'Es: Nome della tua azienda',
                          currentPosition: 'Es: Manager, Developer, Commerciale...',
                          yearsExperience: 'Es: 3 anni, 5-10 anni...',
                          fieldOfStudy: 'Es: Economia, Ingegneria, Marketing...',
                          university: 'Es: Bocconi, Politecnico, La Sapienza...',
                        };
                        
                        return (
                          <div key={field} className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-1">
                              {fieldLabels[field]} {isFieldRequired(field) && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                              value={formData[`qualification${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof FormData]}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                [`qualification${field.charAt(0).toUpperCase() + field.slice(1)}`]: e.target.value 
                              })}
                              placeholder={fieldPlaceholders[field]}
                              className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors"
                              disabled={submitMutation.isPending}
                            />
                          </div>
                        );
                      })}

                      {commonFields.map((field) => {
                        if (!isFieldVisible(field)) return null;
                        
                        const fieldLabels: Record<string, string> = {
                          motivation: 'Cosa ti ha spinto a contattarci?',
                          biggestProblem: 'Qual è il problema più grande che vorresti risolvere?',
                          goal12Months: 'Dove vorresti arrivare nei prossimi 12 mesi?',
                          currentBlocker: 'Cosa ti blocca adesso?',
                        };
                        
                        const fieldPlaceholders: Record<string, string> = {
                          motivation: 'Es: Ho visto un tuo post sui social e mi ha incuriosito...',
                          biggestProblem: 'Es: Faccio fatica a gestire il tempo e le priorità...',
                          goal12Months: 'Es: Vorrei aumentare il fatturato del 30% e lavorare meno ore...',
                          currentBlocker: 'Es: Non so da dove iniziare e mi sento bloccato...',
                        };
                        
                        return (
                          <div key={field} className="space-y-2">
                            <Label className="text-gray-700 font-medium flex items-center gap-1">
                              {fieldLabels[field]} {isFieldRequired(field) && <span className="text-red-500">*</span>}
                            </Label>
                            <Textarea
                              value={formData[`qualification${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof FormData]}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                [`qualification${field.charAt(0).toUpperCase() + field.slice(1)}`]: e.target.value 
                              })}
                              placeholder={fieldPlaceholders[field]}
                              className="min-h-[100px] bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors resize-none"
                              disabled={submitMutation.isPending}
                            />
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full h-14 text-lg font-semibold rounded-xl transition-all hover:scale-[1.02]"
                  style={{ background: primaryColor }}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      {config.ctaText || 'Contattami'}
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      {showAiAssistant && (
        <>
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            onClick={() => setAiChatOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-110"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </motion.button>

          <AnimatePresence>
            {aiChatOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 z-50"
                  onClick={() => setAiChatOpen(false)}
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col"
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        <MessageCircle className="h-5 w-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Assistente AI</h3>
                        <p className="text-xs text-gray-500">Sempre disponibile per te</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAiChatOpen(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <iframe
                      src={config.aiAssistantIframeUrl!}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      className="w-full h-full border-0"
                      title="AI Assistant"
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
