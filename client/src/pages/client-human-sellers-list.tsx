import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  Power,
  PowerOff,
  Video,
  Menu,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface HumanSeller {
  id: string;
  sellerName: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export default function ClientHumanSellersList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<HumanSeller | null>(null);

  const { data: sellers = [], isLoading, refetch } = useQuery<HumanSeller[]>({
    queryKey: ['/api/client/human-sellers'],
    queryFn: async () => {
      const res = await fetch('/api/client/human-sellers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Errore nel caricamento');
      return res.json();
    },
  });

  const handleDelete = (seller: HumanSeller) => {
    setSelectedSeller(seller);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedSeller) {
      try {
        const res = await fetch(`/api/client/human-sellers/${selectedSeller.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!res.ok) throw new Error('Errore eliminazione');
        toast({
          title: '✅ Venditore eliminato',
          description: `Il venditore "${selectedSeller.sellerName}" è stato eliminato con successo`,
        });
        refetch();
      } catch (error) {
        toast({
          title: '❌ Errore',
          description: 'Impossibile eliminare il venditore',
          variant: 'destructive',
        });
      }
      setDeleteDialogOpen(false);
      setSelectedSeller(null);
    }
  };

  const handleToggleActive = async (seller: HumanSeller) => {
    try {
      const res = await fetch(`/api/client/human-sellers/${seller.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Errore toggle');
      toast({
        title: '✅ Stato aggiornato',
        description: `Lo stato del venditore è stato ${seller.isActive ? 'disattivato' : 'attivato'}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: '❌ Errore',
        description: 'Impossibile aggiornare lo stato',
        variant: 'destructive',
      });
    }
  };

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
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-600" />
                Venditori Umani
              </h1>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Gestisci i tuoi venditori per le video consulenze
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg"
                  onClick={() => setLocation('/client/human-sellers/new')}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuovo Venditore
                </Button>
              </div>
            </motion.div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-white dark:bg-gray-800 animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sellers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
                  <CardContent className="p-12 text-center">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                      <Users className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Nessun venditore creato
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Aggiungi il tuo primo venditore per iniziare a gestire le video consulenze
                    </p>
                    <Button
                      size="lg"
                      className="bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                      onClick={() => setLocation('/client/human-sellers/new')}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Crea Primo Venditore
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sellers.map((seller, index) => (
                  <motion.div
                    key={seller.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 h-full group">
                      <CardContent className="p-6 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Users className="h-7 w-7 text-white" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={seller.isActive ? 'default' : 'secondary'}
                              className={seller.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'}
                            >
                              {seller.isActive ? (
                                <>
                                  <Power className="h-3 w-3 mr-1" />
                                  Attivo
                                </>
                              ) : (
                                <>
                                  <PowerOff className="h-3 w-3 mr-1" />
                                  Inattivo
                                </>
                              )}
                            </Badge>
                            {seller.meetingsCount > 0 && (
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
                                <Video className="h-3 w-3 mr-1" />
                                {seller.meetingsCount}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                          {seller.sellerName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {seller.displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                          Creato il {new Date(seller.createdAt).toLocaleDateString('it-IT')}
                        </p>

                        <div className="flex-grow" />

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/client/human-sellers/${seller.id}`)}
                            className="text-xs"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Modifica
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/client/human-sellers/${seller.id}/analytics`)}
                            className="text-xs"
                          >
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Analytics
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(seller)}
                            className="text-xs"
                            title={seller.isActive ? 'Disattiva' : 'Attiva'}
                          >
                            {seller.isActive ? <PowerOff className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                            {seller.isActive ? 'Disattiva' : 'Attiva'}
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(seller)}
                          className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Elimina Venditore
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il venditore "{selectedSeller?.sellerName}". Questa azione è irreversibile e
              eliminerà anche tutti i dati e le statistiche associate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
