import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { z } from 'zod';
import {
  Users,
  Save,
  X,
  Loader2,
  Menu,
  ArrowLeft,
  Wand2,
  Plus,
  Trash2,
  Building2,
  Target,
  Award,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const serviceSchema = z.object({
  name: z.string().min(1, 'Nome servizio obbligatorio'),
  description: z.string().optional(),
  price: z.string().optional(),
});

const humanSellerSchema = z.object({
  sellerName: z.string().min(1, 'Il nome del venditore è obbligatorio'),
  displayName: z.string().min(1, 'Il display name è obbligatorio'),
  description: z.string().optional(),
  ownerEmail: z.string().min(1, 'Email proprietario è obbligatoria').email('Email non valida'),
  isActive: z.boolean(),
  businessName: z.string().optional(),
  businessDescription: z.string().optional(),
  consultantBio: z.string().optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  values: z.array(z.string()).optional(),
  usp: z.string().optional(),
  targetClient: z.string().optional(),
  nonTargetClient: z.string().optional(),
  whatWeDo: z.string().optional(),
  howWeDoIt: z.string().optional(),
  yearsExperience: z.number().min(0).optional(),
  clientsHelped: z.number().min(0).optional(),
  resultsGenerated: z.string().optional(),
  guarantees: z.string().optional(),
  servicesOffered: z.array(serviceSchema).optional(),
  voiceName: z.string().optional(),
});

type HumanSellerFormData = z.infer<typeof humanSellerSchema>;

interface HumanSeller {
  id: string;
  sellerName: string;
  displayName: string;
  description: string | null;
  ownerEmail: string | null;
  isActive: boolean;
  businessName: string | null;
  businessDescription: string | null;
  consultantBio: string | null;
  vision: string | null;
  mission: string | null;
  values: string[];
  usp: string | null;
  targetClient: string | null;
  nonTargetClient: string | null;
  whatWeDo: string | null;
  howWeDoIt: string | null;
  yearsExperience: number | null;
  clientsHelped: number | null;
  resultsGenerated: string | null;
  guarantees: string | null;
  servicesOffered: Array<{ name: string; description: string; price: string }>;
  voiceName: string | null;
  createdAt: string;
}

export default function ClientHumanSellerConfig() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [valuesInput, setValuesInput] = useState('');

  const isNew = id === 'new';

  const form = useForm<HumanSellerFormData>({
    resolver: zodResolver(humanSellerSchema),
    defaultValues: {
      sellerName: '',
      displayName: '',
      description: '',
      ownerEmail: '',
      isActive: true,
      businessName: '',
      businessDescription: '',
      consultantBio: '',
      vision: '',
      mission: '',
      values: [],
      usp: '',
      targetClient: '',
      nonTargetClient: '',
      whatWeDo: '',
      howWeDoIt: '',
      yearsExperience: 0,
      clientsHelped: 0,
      resultsGenerated: '',
      guarantees: '',
      servicesOffered: [],
      voiceName: 'achernar',
    },
  });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: 'servicesOffered',
  });

  useEffect(() => {
    if (!isNew && id) {
      setIsLoading(true);
      fetch(`/api/client/human-sellers/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then(res => {
          if (!res.ok) throw new Error('Venditore non trovato');
          return res.json();
        })
        .then((seller: HumanSeller) => {
          form.reset({
            sellerName: seller.sellerName,
            displayName: seller.displayName,
            description: seller.description || '',
            ownerEmail: seller.ownerEmail || '',
            isActive: seller.isActive,
            businessName: seller.businessName || '',
            businessDescription: seller.businessDescription || '',
            consultantBio: seller.consultantBio || '',
            vision: seller.vision || '',
            mission: seller.mission || '',
            values: seller.values || [],
            usp: seller.usp || '',
            targetClient: seller.targetClient || '',
            nonTargetClient: seller.nonTargetClient || '',
            whatWeDo: seller.whatWeDo || '',
            howWeDoIt: seller.howWeDoIt || '',
            yearsExperience: seller.yearsExperience || 0,
            clientsHelped: seller.clientsHelped || 0,
            resultsGenerated: seller.resultsGenerated || '',
            guarantees: seller.guarantees || '',
            servicesOffered: seller.servicesOffered || [],
            voiceName: seller.voiceName || 'achernar',
          });
          setValuesInput((seller.values || []).join(', '));
        })
        .catch(err => {
          toast({
            title: '❌ Errore',
            description: err.message,
            variant: 'destructive',
          });
          setLocation('/client/human-sellers');
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, isNew, form]);

  const handleMagicButton = async () => {
    if (isNew) {
      toast({
        title: '⚠️ Salva prima il venditore',
        description: 'Devi salvare il venditore prima di usare il Magic Button',
        variant: 'destructive',
      });
      return;
    }

    setIsMagicLoading(true);
    try {
      const res = await fetch(`/api/client/human-sellers/${id}/magic-button`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore durante estrazione dati');
      }

      const data = await res.json();
      const updatedFields: string[] = [];

      if (data.businessName) {
        form.setValue('businessName', data.businessName);
        updatedFields.push('Nome Business');
      }
      if (data.businessDescription) {
        form.setValue('businessDescription', data.businessDescription);
        updatedFields.push('Descrizione Business');
      }
      if (data.consultantBio) {
        form.setValue('consultantBio', data.consultantBio);
        updatedFields.push('Bio Consulente');
      }
      if (data.vision) {
        form.setValue('vision', data.vision);
        updatedFields.push('Vision');
      }
      if (data.mission) {
        form.setValue('mission', data.mission);
        updatedFields.push('Mission');
      }
      if (data.values && data.values.length > 0) {
        form.setValue('values', data.values);
        setValuesInput(data.values.join(', '));
        updatedFields.push('Valori');
      }
      if (data.usp) {
        form.setValue('usp', data.usp);
        updatedFields.push('USP');
      }
      if (data.targetClient) {
        form.setValue('targetClient', data.targetClient);
        updatedFields.push('Cliente Target');
      }
      if (data.nonTargetClient) {
        form.setValue('nonTargetClient', data.nonTargetClient);
        updatedFields.push('Cliente Non Target');
      }
      if (data.whatWeDo) {
        form.setValue('whatWeDo', data.whatWeDo);
        updatedFields.push('Cosa Facciamo');
      }
      if (data.howWeDoIt) {
        form.setValue('howWeDoIt', data.howWeDoIt);
        updatedFields.push('Come lo Facciamo');
      }
      if (data.yearsExperience !== undefined) {
        form.setValue('yearsExperience', data.yearsExperience);
        updatedFields.push('Anni Esperienza');
      }
      if (data.clientsHelped !== undefined) {
        form.setValue('clientsHelped', data.clientsHelped);
        updatedFields.push('Clienti Aiutati');
      }
      if (data.resultsGenerated) {
        form.setValue('resultsGenerated', data.resultsGenerated);
        updatedFields.push('Risultati Generati');
      }
      if (data.guarantees) {
        form.setValue('guarantees', data.guarantees);
        updatedFields.push('Garanzie');
      }
      if (data.servicesOffered && data.servicesOffered.length > 0) {
        form.setValue('servicesOffered', data.servicesOffered);
        updatedFields.push('Servizi');
      }

      toast({
        title: '✨ Dati estratti con successo!',
        description: updatedFields.length > 0
          ? `Campi aggiornati: ${updatedFields.join(', ')}`
          : 'Nessun nuovo dato trovato',
      });
    } catch (error: any) {
      toast({
        title: '❌ Errore Magic Button',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsMagicLoading(false);
    }
  };

  const onSubmit = async (data: HumanSellerFormData) => {
    setIsSaving(true);

    const valuesArray = valuesInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const payload = {
      ...data,
      values: valuesArray,
    };

    try {
      const url = isNew 
        ? '/api/client/human-sellers'
        : `/api/client/human-sellers/${id}`;
      
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nel salvataggio');
      }
      
      toast({
        title: isNew ? '✅ Venditore creato!' : '✅ Venditore aggiornato!',
        description: isNew
          ? `Il venditore "${data.sellerName}" è stato creato con successo`
          : `Le modifiche a "${data.sellerName}" sono state salvate`,
      });
      
      setLocation('/client/human-sellers');
    } catch (error: any) {
      toast({
        title: '❌ Errore',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocation('/client/human-sellers');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/human-sellers')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Venditori Umani
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                {isNew ? 'Nuovo Venditore' : 'Modifica Venditore'}
              </h1>

              {!isNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMagicButton}
                  disabled={isMagicLoading}
                  className="ml-auto border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/30"
                >
                  {isMagicLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Estrazione...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Compila automaticamente
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="bg-white dark:bg-gray-800 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-sm font-bold">
                        <Users className="h-4 w-4" />
                      </span>
                      Configurazione Venditore
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="grid w-full grid-cols-5 mb-6">
                        <TabsTrigger value="basic" className="text-xs sm:text-sm">
                          <Users className="h-4 w-4 mr-1 hidden sm:inline" />
                          Base
                        </TabsTrigger>
                        <TabsTrigger value="business" className="text-xs sm:text-sm">
                          <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
                          Business
                        </TabsTrigger>
                        <TabsTrigger value="positioning" className="text-xs sm:text-sm">
                          <Target className="h-4 w-4 mr-1 hidden sm:inline" />
                          Posizionamento
                        </TabsTrigger>
                        <TabsTrigger value="credentials" className="text-xs sm:text-sm">
                          <Award className="h-4 w-4 mr-1 hidden sm:inline" />
                          Credenziali
                        </TabsTrigger>
                        <TabsTrigger value="services" className="text-xs sm:text-sm">
                          <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
                          Servizi
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="sellerName">Nome Venditore *</Label>
                            <Input
                              id="sellerName"
                              placeholder="es: Marco Bianchi"
                              {...form.register('sellerName')}
                            />
                            {form.formState.errors.sellerName && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {form.formState.errors.sellerName.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name *</Label>
                            <Input
                              id="displayName"
                              placeholder="es: Marco B."
                              {...form.register('displayName')}
                            />
                            {form.formState.errors.displayName && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {form.formState.errors.displayName.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Descrizione</Label>
                          <Textarea
                            id="description"
                            placeholder="Descrivi il venditore, le sue competenze e specializzazioni..."
                            rows={4}
                            {...form.register('description')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ownerEmail">Email Proprietario (per Video Meeting) *</Label>
                          <Input
                            id="ownerEmail"
                            type="email"
                            placeholder="es: venditore@azienda.it"
                            {...form.register('ownerEmail')}
                          />
                          <p className="text-xs text-gray-500">
                            L'email usata per riconoscere il proprietario durante i video meeting con Google Sign-In
                          </p>
                          {form.formState.errors.ownerEmail && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {form.formState.errors.ownerEmail.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="voiceName">Voce AI</Label>
                          <Input
                            id="voiceName"
                            placeholder="es: achernar"
                            {...form.register('voiceName')}
                          />
                          <p className="text-xs text-gray-500">
                            Nome della voce per la sintesi vocale AI (default: achernar)
                          </p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div>
                            <Label htmlFor="isActive" className="text-base font-medium">
                              Venditore Attivo
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              I venditori attivi possono ricevere nuove consulenze
                            </p>
                          </div>
                          <Switch
                            id="isActive"
                            checked={form.watch('isActive')}
                            onCheckedChange={(checked) => form.setValue('isActive', checked)}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="business" className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="businessName">Nome Business</Label>
                          <Input
                            id="businessName"
                            placeholder="es: Consulenza Strategica Bianchi"
                            {...form.register('businessName')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="businessDescription">Descrizione Business</Label>
                          <Textarea
                            id="businessDescription"
                            placeholder="Descrivi il business, cosa offre e a chi si rivolge..."
                            rows={4}
                            {...form.register('businessDescription')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="consultantBio">Bio Consulente</Label>
                          <Textarea
                            id="consultantBio"
                            placeholder="Background, esperienza e competenze del consulente..."
                            rows={4}
                            {...form.register('consultantBio')}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="positioning" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="vision">Vision</Label>
                            <Textarea
                              id="vision"
                              placeholder="La visione a lungo termine..."
                              rows={3}
                              {...form.register('vision')}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="mission">Mission</Label>
                            <Textarea
                              id="mission"
                              placeholder="La missione quotidiana..."
                              rows={3}
                              {...form.register('mission')}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="valuesInput">Valori (separati da virgola)</Label>
                          <Input
                            id="valuesInput"
                            placeholder="es: Integrità, Innovazione, Eccellenza"
                            value={valuesInput}
                            onChange={(e) => setValuesInput(e.target.value)}
                          />
                          <p className="text-xs text-gray-500">
                            Inserisci i valori separati da virgola
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="usp">USP (Unique Selling Proposition)</Label>
                          <Textarea
                            id="usp"
                            placeholder="Cosa rende unico questo business rispetto alla concorrenza..."
                            rows={3}
                            {...form.register('usp')}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="targetClient">Cliente Target</Label>
                            <Textarea
                              id="targetClient"
                              placeholder="Descrizione del cliente ideale..."
                              rows={3}
                              {...form.register('targetClient')}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="nonTargetClient">Cliente NON Target</Label>
                            <Textarea
                              id="nonTargetClient"
                              placeholder="Tipologie di clienti da evitare..."
                              rows={3}
                              {...form.register('nonTargetClient')}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="whatWeDo">Cosa Facciamo</Label>
                            <Textarea
                              id="whatWeDo"
                              placeholder="I servizi e le soluzioni offerte..."
                              rows={3}
                              {...form.register('whatWeDo')}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="howWeDoIt">Come lo Facciamo</Label>
                            <Textarea
                              id="howWeDoIt"
                              placeholder="Il metodo e l'approccio utilizzato..."
                              rows={3}
                              {...form.register('howWeDoIt')}
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="credentials" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="yearsExperience">Anni di Esperienza</Label>
                            <Input
                              id="yearsExperience"
                              type="number"
                              min={0}
                              placeholder="es: 15"
                              {...form.register('yearsExperience', { valueAsNumber: true })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="clientsHelped">Clienti Aiutati</Label>
                            <Input
                              id="clientsHelped"
                              type="number"
                              min={0}
                              placeholder="es: 500"
                              {...form.register('clientsHelped', { valueAsNumber: true })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="resultsGenerated">Risultati Generati</Label>
                          <Textarea
                            id="resultsGenerated"
                            placeholder="Descrivi i risultati concreti ottenuti per i clienti..."
                            rows={4}
                            {...form.register('resultsGenerated')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="guarantees">Garanzie</Label>
                          <Textarea
                            id="guarantees"
                            placeholder="Le garanzie offerte ai clienti..."
                            rows={4}
                            {...form.register('guarantees')}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="services" className="space-y-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium">Servizi Offerti</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendService({ name: '', description: '', price: '' })}
                            className="border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Aggiungi Servizio
                          </Button>
                        </div>

                        {serviceFields.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">
                              Nessun servizio configurato
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              Clicca "Aggiungi Servizio" per iniziare
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {serviceFields.map((field, index) => (
                              <div
                                key={field.id}
                                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                    Servizio #{index + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeService(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Nome *</Label>
                                    <Input
                                      placeholder="es: Consulenza Premium"
                                      {...form.register(`servicesOffered.${index}.name`)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Descrizione</Label>
                                    <Input
                                      placeholder="es: Sessione 1:1 intensiva"
                                      {...form.register(`servicesOffered.${index}.description`)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Prezzo</Label>
                                    <Input
                                      placeholder="es: €997"
                                      {...form.register(`servicesOffered.${index}.price`)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>

                    <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Annulla
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvataggio...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Salva
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
