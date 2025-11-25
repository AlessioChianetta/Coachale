import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { CheckCircle2, Coffee, Smile, Meh, Frown, Zap, Battery, BatteryMedium, BatteryLow } from 'lucide-react';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTimestamp?: Date;
  onSuccess?: () => void;
}

const moodEmojis = [
  { value: 1, icon: Frown, label: 'Pessimo', color: 'text-red-500' },
  { value: 2, icon: Meh, label: 'Scarso', color: 'text-orange-500' },
  { value: 3, icon: Meh, label: 'Ok', color: 'text-yellow-500' },
  { value: 4, icon: Smile, label: 'Buono', color: 'text-green-500' },
  { value: 5, icon: Smile, label: 'Ottimo', color: 'text-emerald-500' },
];

const energyLevels = [
  { value: 1, icon: BatteryLow, label: 'Molto basso', color: 'text-red-500' },
  { value: 2, icon: BatteryMedium, label: 'Basso', color: 'text-orange-500' },
  { value: 3, icon: BatteryMedium, label: 'Medio', color: 'text-yellow-500' },
  { value: 4, icon: Battery, label: 'Alto', color: 'text-green-500' },
  { value: 5, icon: Zap, label: 'Massimo', color: 'text-emerald-500' },
];

export default function CheckinModal({
  isOpen,
  onClose,
  prefilledTimestamp,
  onSuccess,
}: CheckinModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activityDescription, setActivityDescription] = useState('');
  const [isProductive, setIsProductive] = useState<boolean | null>(null);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [relativeMinutes, setRelativeMinutes] = useState(30);

  // Fetch settings for categories
  const { data: settings } = useQuery({
    queryKey: ['/api/momentum/settings'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
  });

  

  const createCheckinMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("🔍 [MUTATION] Sending request with data:", JSON.stringify(data, null, 2));

      const response = await fetch('/api/momentum/checkins', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log("🔍 [MUTATION] Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ [MUTATION] Server error response:", error);
        throw new Error(error.message || 'Failed to create check-in');
      }

      const result = await response.json();
      console.log("✅ [MUTATION] Success response:", result);
      return result;
    },
    onSuccess: async (checkin) => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/checkins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/checkins/daily-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/checkins/weekly-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/checkins/current-streak'] });

      // I check-in vengono già visualizzati nel calendario tramite la funzionalità showCheckins
      // Non è necessario creare eventi duplicati
      
      toast({
        title: 'Check-in registrato!',
        description: 'La tua attività è stata salvata.',
      });

      onClose();
    },
  });

  const handleClose = () => {
    setActivityDescription('');
    setIsProductive(null);
    setCategory('');
    setNotes('');
    setMood(null);
    setEnergyLevel(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🔍 [CHECKIN MODAL] Submit started");
    console.log("🔍 [CHECKIN MODAL] Activity description:", activityDescription);
    console.log("🔍 [CHECKIN MODAL] Is productive:", isProductive);
    console.log("🔍 [CHECKIN MODAL] Category:", category);
    console.log("🔍 [CHECKIN MODAL] Relative minutes:", relativeMinutes);

    if (!activityDescription.trim()) {
      toast({
        title: 'Errore',
        description: 'Per favore descrivi l\'attività',
        variant: 'destructive',
      });
      return;
    }

    if (activityDescription.trim().length < 3) {
      toast({
        title: 'Errore',
        description: 'La descrizione deve essere di almeno 3 caratteri',
        variant: 'destructive',
      });
      return;
    }

    if (isProductive === null) {
      toast({
        title: 'Errore',
        description: 'Seleziona il tipo di attività (Produttiva o Pausa)',
        variant: 'destructive',
      });
      return;
    }

    // Calcola il timestamp basato sui minuti relativi
    const timestampDate = new Date(Date.now() - relativeMinutes * 60 * 1000);
    console.log("🔍 [CHECKIN MODAL] Calculated relative timestamp:", timestampDate.toISOString());

    const payload = {
      activityDescription: activityDescription.trim(),
      isProductive,
      category: category || undefined,
      notes: notes.trim() || undefined,
      mood: mood || undefined,
      energyLevel: energyLevel || undefined,
      timestamp: timestampDate.toISOString(),
    };

    console.log("🔍 [CHECKIN MODAL] Payload to send:", JSON.stringify(payload, null, 2));

    createCheckinMutation.mutate(payload);
  };

  const availableCategories = isProductive === true
    ? settings?.defaultProductiveCategories || ['lavoro', 'studio', 'esercizio fisico']
    : isProductive === false
    ? settings?.defaultBreakCategories || ['pausa', 'relax', 'social']
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {isProductive ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <Coffee className="h-6 w-6 text-orange-600" />
            )}
            Registra Check-in
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Timestamp Selector */}
          <div className="space-y-3">
            <Label htmlFor="relative-time">Quando hai svolto questa attività?</Label>
            <Select
              value={relativeMinutes.toString()}
              onValueChange={(value) => setRelativeMinutes(parseInt(value))}
            >
              <SelectTrigger id="relative-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Adesso</SelectItem>
                <SelectItem value="5">5 minuti fa</SelectItem>
                <SelectItem value="10">10 minuti fa</SelectItem>
                <SelectItem value="15">15 minuti fa</SelectItem>
                <SelectItem value="20">20 minuti fa</SelectItem>
                <SelectItem value="30">30 minuti fa</SelectItem>
                <SelectItem value="45">45 minuti fa</SelectItem>
                <SelectItem value="60">1 ora fa</SelectItem>
                <SelectItem value="90">1 ora e 30 minuti fa</SelectItem>
                <SelectItem value="120">2 ore fa</SelectItem>
                <SelectItem value="150">2 ore e 30 minuti fa</SelectItem>
                <SelectItem value="180">3 ore fa</SelectItem>
                <SelectItem value="240">4 ore fa</SelectItem>
                <SelectItem value="300">5 ore fa</SelectItem>
                <SelectItem value="360">6 ore fa</SelectItem>
                <SelectItem value="480">8 ore fa</SelectItem>
                <SelectItem value="600">10 ore fa</SelectItem>
                <SelectItem value="720">12 ore fa</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(() => {
                const startTime = new Date(Date.now() - relativeMinutes * 60 * 1000);
                const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
                const formatTime = (date: Date) => date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                
                if (relativeMinutes === 0) {
                  return `L'attività sarà registrata tra le ${formatTime(startTime)} e le ${formatTime(endTime)}`;
                }
                return `L'attività sarà registrata tra le ${formatTime(startTime)} e le ${formatTime(endTime)}`;
              })()}
            </p>
          </div>

          {/* Productive/Break Toggle */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Tipo di attività *</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={isProductive === true ? "default" : "outline"}
                className={`h-auto py-4 flex flex-col items-center gap-2 ${
                  isProductive === true
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-950'
                }`}
                onClick={() => setIsProductive(true)}
              >
                <CheckCircle2 className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Attività Produttiva</div>
                  <div className="text-xs opacity-80">Lavoro, studio, esercizio fisico</div>
                </div>
              </Button>
              <Button
                type="button"
                variant={isProductive === false ? "default" : "outline"}
                className={`h-auto py-4 flex flex-col items-center gap-2 ${
                  isProductive === false
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-950'
                }`}
                onClick={() => setIsProductive(false)}
              >
                <Coffee className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Pausa / Non Produttivo</div>
                  <div className="text-xs opacity-80">Pausa, relax, tempo libero</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Activity Description */}
          <div className="space-y-2">
            <Label htmlFor="activity">Cosa stai facendo? *</Label>
            <Textarea
              id="activity"
              placeholder="Es: Lavorando sul progetto X, studiando per l'esame, facendo una pausa caffè..."
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              className="min-h-[80px] resize-none"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una categoria (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mood Selector */}
          <div className="space-y-3">
            <Label>Come ti senti?</Label>
            <div className="flex justify-between gap-2">
              {moodEmojis.map(({ value, icon: Icon, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMood(value)}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                    mood === value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${mood === value ? color : 'text-gray-400'}`} />
                  <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy Level */}
          <div className="space-y-3">
            <Label>Livello di Energia</Label>
            <div className="flex justify-between gap-2">
              {energyLevels.map(({ value, icon: Icon, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEnergyLevel(value)}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                    energyLevel === value
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${energyLevel === value ? color : 'text-gray-400'}`} />
                  <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Note Aggiuntive</Label>
            <Textarea
              id="notes"
              placeholder="Aggiungi eventuali note o riflessioni..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={createCheckinMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {createCheckinMutation.isPending ? 'Salvataggio...' : 'Salva Check-in'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}