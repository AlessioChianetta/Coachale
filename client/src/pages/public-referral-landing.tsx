import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import {
  Gift,
  Users,
  CheckCircle,
  Mail,
  Phone,
  MessageSquare,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  Heart,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

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
    agentConfigId: string | null;
    accentColor: string | null;
  };
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
}

export default function PublicReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

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
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/public/referral/${code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          notes: formData.message || undefined,
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
    
    submitMutation.mutate(formData);
  };

  const accentColor = data?.landing?.accentColor || '#6366f1';

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 50%, #0f172a 100%)`,
        }}
      >
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" style={{ color: accentColor }} />
          <p className="text-white text-lg">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <Card className="bg-white/10 border-white/20 max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Codice Non Valido</h2>
            <p className="text-white/70">
              Il codice referral richiesto non esiste o non è più attivo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { consultant, referrer, landing } = data;

  if (submitted) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}10 50%, #0f172a 100%)`,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div 
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}30` }}
              >
                <CheckCircle className="h-10 w-10" style={{ color: accentColor }} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Grazie per la tua richiesta!</h2>
              <p className="text-white/70 mb-6">
                Abbiamo ricevuto i tuoi dati. {consultant?.firstName} ti contatterà presto.
              </p>
              {landing.bonusText && (
                <div 
                  className="p-4 rounded-lg border"
                  style={{ 
                    backgroundColor: `${accentColor}15`,
                    borderColor: `${accentColor}30`
                  }}
                >
                  <Gift className="h-6 w-6 mx-auto mb-2" style={{ color: accentColor }} />
                  <p className="text-white font-medium">
                    Il tuo bonus: {landing.bonusText}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}10 50%, #0f172a 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
      
      <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {landing.profileImageUrl ? (
            <Avatar className="w-28 h-28 mx-auto mb-6 ring-4 ring-white/20 shadow-2xl">
              <AvatarImage src={landing.profileImageUrl} alt={consultant?.firstName} />
              <AvatarFallback 
                className="text-2xl font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {consultant?.firstName?.[0]}{consultant?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div 
              className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center ring-4 ring-white/20 shadow-2xl"
              style={{ backgroundColor: accentColor }}
            >
              <User className="h-14 w-14 text-white" />
            </div>
          )}

          {referrer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm"
            >
              <Heart className="h-4 w-4 text-pink-400" />
              <span className="text-white/80 text-sm">
                Invitato da {referrer.firstName} {referrer.lastName}
              </span>
            </motion.div>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {landing.headline || `Inizia con ${consultant?.firstName}`}
          </h1>

          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            {landing.description || 'Siamo qui per aiutarti a raggiungere i tuoi obiettivi.'}
          </p>
        </motion.div>

        {landing.bonusText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card 
              className="border-2 backdrop-blur-sm overflow-hidden"
              style={{ 
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}50`
              }}
            >
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accentColor}30` }}
                >
                  <Gift className="h-8 w-8" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 justify-center sm:justify-start">
                    <Sparkles className="h-5 w-5" style={{ color: accentColor }} />
                    Bonus Esclusivo
                  </h3>
                  <p className="text-white/90 text-lg font-medium">
                    {landing.bonusText}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: accentColor }} />
                Compila il modulo di contatto
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white flex items-center gap-1">
                      Nome <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Mario"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      disabled={submitMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white">Cognome</Label>
                    <Input
                      id="lastName"
                      placeholder="Rossi"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      disabled={submitMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mario.rossi@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    disabled={submitMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefono <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+39 123 456 7890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    disabled={submitMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Messaggio (opzionale)
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Raccontaci brevemente le tue esigenze..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                    disabled={submitMutation.isPending}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full py-6 text-lg font-semibold transition-all duration-300 hover:shadow-lg"
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
                      Invia Richiesta
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {landing.showAiChat && landing.agentConfigId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <p className="text-white/60 mb-4">oppure</p>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => window.open(`/ai/${landing.agentConfigId}`, '_blank')}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Parla con l'assistente AI
            </Button>
          </motion.div>
        )}

        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm">
            Powered by {consultant?.firstName} {consultant?.lastName} • {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
