import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Activity, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
  id?: string;
  userId?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  selectedDate?: { start: Date; end: Date; allDay: boolean } | null;
}

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Blu' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Arancione' },
  { value: '#ef4444', label: 'Rosso' },
  { value: '#8b5cf6', label: 'Viola' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#64748b', label: 'Grigio' },
];

export default function EventModal({ isOpen, onClose, event, selectedDate }: EventModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<CalendarEvent>({
    title: '',
    description: '',
    start: new Date(),
    end: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    allDay: false,
    color: '#3b82f6',
  });

  const isCheckin = event && (event as any).type === 'checkin';

  // Initialize form when event or selectedDate changes
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        color: event.color || '#3b82f6',
      });
    } else if (selectedDate) {
      setFormData({
        title: '',
        description: '',
        start: selectedDate.start,
        end: selectedDate.end,
        allDay: selectedDate.allDay,
        color: '#3b82f6',
      });
    }
  }, [event, selectedDate]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CalendarEvent) => {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: 'Evento creato',
        description: 'L\'evento è stato creato con successo.',
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Errore',
        description: 'Impossibile creare l\'evento.',
        variant: 'destructive',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CalendarEvent> }) => {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: 'Evento aggiornato',
        description: 'L\'evento è stato aggiornato con successo.',
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare l\'evento.',
        variant: 'destructive',
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: 'Evento eliminato',
        description: 'L\'evento è stato eliminato con successo.',
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Errore',
        description: 'Impossibile eliminare l\'evento.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Errore',
        description: 'Il titolo è obbligatorio.',
        variant: 'destructive',
      });
      return;
    }

    if (event?.id) {
      updateEventMutation.mutate({
        id: event.id,
        data: formData,
      });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (event?.id && confirm('Sei sicuro di voler eliminare questo evento?')) {
      deleteEventMutation.mutate(event.id);
    }
  };

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (isCheckin) {
    const checkinData = event as any;
    const timestamp = new Date(checkinData.timestamp);
    const endTime = new Date(timestamp.getTime() + 30 * 60000); // 30 minuti dopo
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className={`p-2 rounded-lg ${checkinData.isProductive ? 'bg-green-100 dark:bg-green-900' : 'bg-orange-100 dark:bg-orange-900'}`}>
                <Activity className={`h-6 w-6 ${checkinData.isProductive ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`} />
              </div>
              Dettagli Check-in
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Header con badge */}
            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Badge 
                variant={checkinData.isProductive ? "default" : "secondary"}
                className={`px-3 py-1 text-sm ${checkinData.isProductive ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}
              >
                {checkinData.isProductive ? '✅ Attività Produttiva' : '☕ Pausa / Relax'}
              </Badge>
              {checkinData.category && (
                <Badge variant="outline" className="px-3 py-1 text-sm capitalize">
                  {checkinData.category}
                </Badge>
              )}
            </div>

            {/* Attività - più prominente */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <Label className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
                Descrizione Attività
              </Label>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {checkinData.activityDescription}
              </p>
            </div>

            {/* Data e Orario - più dettagliato */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
                  📅 Data e Orario
                </Label>
                <div className="space-y-1">
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                    {timestamp.toLocaleDateString('it-IT', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    🕐 Dalle {timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} 
                    {' '}alle {endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    <span className="ml-2 text-xs text-gray-500">(~30 minuti)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Umore ed Energia - side by side se presenti */}
            {((checkinData.mood !== undefined && checkinData.mood !== null) || 
              (checkinData.energy !== undefined && checkinData.energy !== null)) && (
              <div className="grid grid-cols-2 gap-4">
                {(checkinData.mood !== undefined && checkinData.mood !== null) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <Label className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2 block">
                      😊 Umore
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">
                        {checkinData.mood >= 4 ? '😊' : checkinData.mood >= 3 ? '😐' : '😔'}
                      </div>
                      <div>
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {checkinData.mood}/5
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {checkinData.mood >= 4 ? 'Ottimo' : checkinData.mood >= 3 ? 'Buono' : 'Da migliorare'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {(checkinData.energy !== undefined && checkinData.energy !== null) && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <Label className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-2 block">
                      ⚡ Energia
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">
                        {checkinData.energy >= 4 ? '⚡' : checkinData.energy >= 3 ? '🔋' : '🪫'}
                      </div>
                      <div>
                        <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                          {checkinData.energy}/5
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          {checkinData.energy >= 4 ? 'Alta' : checkinData.energy >= 3 ? 'Media' : 'Bassa'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Note aggiuntive */}
            {checkinData.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-l-4 border-amber-400">
                <Label className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 block flex items-center gap-2">
                  📝 Note Aggiuntive
                </Label>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {checkinData.notes}
                </p>
              </div>
            )}

            {/* Info aggiuntive */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                💡 Questo check-in è stato registrato tramite <strong>Momentum</strong>
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/client/momentum')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Vai a Momentum
            </Button>
            <Button 
              type="button" 
              onClick={onClose}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Modifica Evento' : 'Nuovo Evento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Titolo dell'evento"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione (opzionale)"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="allDay"
              checked={formData.allDay}
              onCheckedChange={(checked) => setFormData({ ...formData, allDay: checked })}
            />
            <Label htmlFor="allDay">Evento giornata intera</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Data Inizio *</Label>
              <Input
                id="start"
                type={formData.allDay ? 'date' : 'datetime-local'}
                value={formData.allDay ? formatDateLocal(formData.start) : formatDateTimeLocal(formData.start)}
                onChange={(e) => setFormData({ ...formData, start: new Date(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end">Data Fine *</Label>
              <Input
                id="end"
                type={formData.allDay ? 'date' : 'datetime-local'}
                value={formData.allDay ? formatDateLocal(formData.end) : formatDateTimeLocal(formData.end)}
                onChange={(e) => setFormData({ ...formData, end: new Date(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Colore</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: colorOption.value })}
                  className={`flex items-center gap-2 p-2 rounded-md border-2 transition-all ${
                    formData.color === colorOption.value
                      ? 'border-gray-900 dark:border-white'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  title={colorOption.label}
                >
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: colorOption.value }}
                  />
                  <span className="text-xs">{colorOption.label}</span>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div>
              {event && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteEventMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending || updateEventMutation.isPending}
              >
                {event ? 'Salva' : 'Crea'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
