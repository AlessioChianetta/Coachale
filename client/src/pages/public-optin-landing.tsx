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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

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
    welcomeMessage: string | null;
    showQualificationFields: boolean;
    qualificationConfig: any | null;
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
}

export default function PublicOptinLanding() {
  const { consultantId } = useParams<{ consultantId: string }>();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

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
      const response = await fetch(`/api/public/optin/${consultantId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: submissionData.firstName,
          lastName: submissionData.lastName || null,
          email: submissionData.email,
          phone: submissionData.phone,
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
                    />
                  </div>
                </div>

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

      {config.showAiChat && (
        <>
          <button
            onClick={() => setAiChatOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 z-40"
            style={{ background: primaryColor }}
          >
            <MessageCircle className="h-6 w-6" />
          </button>

          <AnimatePresence>
            {aiChatOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 text-white flex items-center justify-between" style={{ background: primaryColor }}>
                  <span className="font-semibold">Assistente AI</span>
                  <button onClick={() => setAiChatOpen(false)} className="hover:bg-white/20 p-1 rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 h-[calc(100%-60px)] flex items-center justify-center text-gray-500">
                  <p className="text-center">
                    {config.welcomeMessage || 'Ciao! Come posso aiutarti?'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
