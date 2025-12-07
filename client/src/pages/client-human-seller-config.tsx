import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const humanSellerSchema = z.object({
  sellerName: z.string().min(1, 'Il nome del venditore è obbligatorio'),
  displayName: z.string().min(1, 'Il display name è obbligatorio'),
  description: z.string().optional(),
  ownerEmail: z.string().email('Email non valida').optional().or(z.literal('')),
  isActive: z.boolean(),
});

type HumanSellerFormData = z.infer<typeof humanSellerSchema>;

interface HumanSeller {
  id: string;
  sellerName: string;
  displayName: string;
  description: string | null;
  ownerEmail: string | null;
  isActive: boolean;
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

  const isNew = id === 'new';

  const form = useForm<HumanSellerFormData>({
    resolver: zodResolver(humanSellerSchema),
    defaultValues: {
      sellerName: '',
      displayName: '',
      description: '',
      ownerEmail: '',
      isActive: true,
    },
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
          });
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

  const onSubmit = async (data: HumanSellerFormData) => {
    setIsSaving(true);
    
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
        body: JSON.stringify(data),
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
            </div>
          </div>

          <div className="max-w-3xl mx-auto p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white dark:bg-gray-800 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-sm font-bold">
                      <Users className="h-4 w-4" />
                    </span>
                    Informazioni Venditore
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Label htmlFor="ownerEmail">Email Proprietario (per Video Meeting)</Label>
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

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
