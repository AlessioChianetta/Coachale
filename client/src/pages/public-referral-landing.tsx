import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  CheckCircle,
  Mail,
  Phone,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  Heart,
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

interface ReferralLandingData {
  success: boolean;
  code: string;
  codeType: 'consultant' | 'client';
  consultant: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
  referrer: {
    firstName: string;
    lastName: string;
  } | null;
  landing: {
    headline: string | null;
    description: string | null;
    bonusText: string | null;
    profileImageUrl: string | null;
    preferredChannel: 'email' | 'whatsapp' | 'call' | 'all';
    showAiChat: boolean;
    aiAssistantIframeUrl: string | null;
    agentConfigId: string | null;
    accentColor: string | null;
    ctaButtonText: string | null;
    welcomeMessage: string | null;
    qualificationFieldsConfig: QualificationFieldsConfig | null;
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

export default function PublicReferralLanding() {
  const { code } = useParams<{ code: string }>();
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

  const { data, isLoading, error } = useQuery<ReferralLandingData>({
    queryKey: ['/public/referral', code],
    queryFn: async () => {
      const response = await fetch(`/api/public/referral/${code}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Invalid referral code');
        throw new Error('Failed to load');
      }
      return response.json();
    },
    enabled: !!code,
  });

  const submitMutation = useMutation({
    mutationFn: async (submissionData: FormData) => {
      const config = data?.landing?.qualificationFieldsConfig;
      const getFieldValue = (fieldName: keyof QualificationFieldsConfig, formValue: string): string | null => {
        if (!config?.[fieldName]?.enabled) return null;
        return formValue.trim() || null;
      };
      
      const response = await fetch(`/api/public/referral/${code}/submit`, {
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
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Richiesta inviata!',
        description: 'Ti contatteremo presto.',
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

    const config = data?.landing?.qualificationFieldsConfig;
    if (config) {
      if (config.role?.enabled && config.role?.required && !formData.qualificationRole) {
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
        const fieldConfig = config[field];
        if (fieldConfig?.enabled && fieldConfig?.required && !formData[formField]?.trim()) {
          setQualificationOpen(true);
          toast({ variant: 'destructive', title: 'Errore', description: `${label} è obbligatorio` });
          return;
        }
      }
    }
    
    submitMutation.mutate(formData);
  };

  const accentColor = data?.landing?.accentColor || '#6366f1';
  const config = data?.landing?.qualificationFieldsConfig;

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
    if (!config) return false;
    const fieldConfig = config[fieldName as keyof QualificationFieldsConfig];
    return fieldConfig?.enabled ?? false;
  };

  const isFieldRequired = (fieldName: string): boolean => {
    if (!config) return false;
    const fieldConfig = config[fieldName as keyof QualificationFieldsConfig];
    return fieldConfig?.required ?? false;
  };

  const hasAnyQualificationField = config && Object.values(config).some(f => f?.enabled);

  const showAiAssistant = data?.landing?.showAiChat && data?.landing?.aiAssistantIframeUrl;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 text-lg">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-md w-full p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Codice Non Valido</h2>
          <p className="text-gray-500">
            Il codice referral richiesto non esiste o non è più attivo.
          </p>
        </motion.div>
      </div>
    );
  }

  const { consultant, referrer, landing } = data;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-md w-full p-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <CheckCircle className="h-10 w-10" style={{ color: accentColor }} />
          </motion.div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Grazie per la tua richiesta!</h2>
          <p className="text-gray-500 mb-6">
            Abbiamo ricevuto i tuoi dati. {consultant?.firstName} ti contatterà presto.
          </p>
          {landing.bonusText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 rounded-xl border"
              style={{ 
                backgroundColor: `${accentColor}08`,
                borderColor: `${accentColor}30`
              }}
            >
              <Gift className="h-6 w-6 mx-auto mb-2" style={{ color: accentColor }} />
              <p className="text-gray-700 font-medium">
                Il tuo bonus: {landing.bonusText}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {landing.profileImageUrl ? (
              <Avatar className="w-20 h-20 mx-auto mb-5 ring-4 ring-white shadow-lg">
                <AvatarImage src={landing.profileImageUrl} alt={consultant?.firstName} />
                <AvatarFallback 
                  className="text-xl font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {consultant?.firstName?.[0]}{consultant?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div 
                className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center ring-4 ring-white shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <User className="h-10 w-10 text-white" />
              </div>
            )}
          </motion.div>

          {referrer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-pink-50 border border-pink-100"
            >
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              <span className="text-pink-700 text-sm font-medium">
                Invitato da {referrer.firstName} {referrer.lastName}
              </span>
            </motion.div>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            {landing.headline || `Inizia con ${consultant?.firstName}`}
          </h1>

          <p className="text-lg text-gray-500 max-w-md mx-auto leading-relaxed">
            {landing.description || 'Siamo qui per aiutarti a raggiungere i tuoi obiettivi.'}
          </p>
        </motion.div>

        {landing.bonusText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <div 
              className="rounded-2xl border p-5 flex items-center gap-4"
              style={{ 
                backgroundColor: `${accentColor}08`,
                borderColor: `${accentColor}25`
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Sparkles className="h-6 w-6" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                  Bonus Esclusivo
                </h3>
                <p className="text-gray-900 font-medium">
                  {landing.bonusText}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-gray-700 font-medium flex items-center gap-1">
                      Nome <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Mario"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors"
                      disabled={submitMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-gray-700 font-medium flex items-center gap-1">
                      Cognome
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Rossi"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mario.rossi@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors"
                    disabled={submitMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-700 font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    Telefono <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+39 123 456 7890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400 transition-colors"
                    disabled={submitMutation.isPending}
                  />
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
                                    borderColor: formData.qualificationRole === value ? accentColor : undefined,
                                    backgroundColor: formData.qualificationRole === value ? `${accentColor}08` : undefined,
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
                  className="w-full h-12 text-base font-semibold transition-all duration-300 hover:opacity-90 shadow-md rounded-xl"
                  style={{ 
                    backgroundColor: accentColor,
                    color: 'white',
                  }}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      {landing.ctaButtonText || 'Richiedi il tuo bonus'}
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 text-center">
          <p className="text-gray-400 text-sm">
            {consultant?.firstName} {consultant?.lastName} • {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {showAiAssistant && (
        <>
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            onClick={() => setAiChatOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-110"
            style={{ backgroundColor: accentColor }}
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
                        style={{ backgroundColor: `${accentColor}15` }}
                      >
                        <MessageCircle className="h-5 w-5" style={{ color: accentColor }} />
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
                      src={landing.aiAssistantIframeUrl!}
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
