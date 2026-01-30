import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { format, addDays, startOfWeek, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  CalendarDays,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Video,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface ConsultantInfo {
  consultantName: string;
  consultantAvatar: string | null;
  title: string;
  description: string | null;
  appointmentDuration: number;
  timezone: string;
}

interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
}

interface SlotsResponse {
  slots: TimeSlot[];
  appointmentDuration: number;
  timezone: string;
}

interface BookingResult {
  success: boolean;
  bookingId: string;
  googleMeetLink: string | null;
  message: string;
  appointmentDetails: {
    date: string;
    time: string;
    duration: number;
    consultantName: string;
  };
}

type BookingStep = 'date' | 'time' | 'form' | 'confirm' | 'success';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  });
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const { data: consultantInfo, isLoading: loadingInfo, error: infoError } = useQuery<ConsultantInfo>({
    queryKey: ['public-booking-info', slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/booking/${slug}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nel caricamento');
      }
      return res.json();
    },
    enabled: !!slug,
  });

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  const { data: slotsData, isLoading: loadingSlots } = useQuery<SlotsResponse>({
    queryKey: ['public-booking-slots', slug, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await fetch(
        `/api/public/booking/${slug}/slots?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      if (!res.ok) {
        throw new Error('Errore nel caricamento degli slot');
      }
      return res.json();
    },
    enabled: !!slug && !!consultantInfo,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error('Seleziona data e orario');
      
      const res = await fetch(`/api/public/booking/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
          clientName: formData.clientName,
          clientEmail: formData.clientEmail,
          clientPhone: formData.clientPhone || undefined,
          notes: formData.notes || undefined,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nella prenotazione');
      }
      
      return res.json() as Promise<BookingResult>;
    },
    onSuccess: (result) => {
      setBookingResult(result);
      setStep('success');
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Backend returns only available slots, no need to filter by .available
  const availableDates = slotsData?.slots
    .reduce((dates, slot) => {
      if (!dates.includes(slot.date)) dates.push(slot.date);
      return dates;
    }, [] as string[]) || [];

  // Backend returns only available slots, no need to filter by .available
  const timeSlotsForSelectedDate = selectedDate
    ? slotsData?.slots.filter(
        slot => slot.date === format(selectedDate, 'yyyy-MM-dd')
      ) || []
    : [];

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (availableDates.includes(dateStr)) {
      setSelectedDate(date);
      setSelectedTime(null);
      setStep('time');
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('form');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.clientEmail) {
      toast({
        title: 'Dati mancanti',
        description: 'Inserisci nome e email per procedere',
        variant: 'destructive',
      });
      return;
    }
    setStep('confirm');
  };

  const handleConfirmBooking = () => {
    bookMutation.mutate();
  };

  const goBack = () => {
    if (step === 'time') setStep('date');
    else if (step === 'form') setStep('time');
    else if (step === 'confirm') setStep('form');
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  if (infoError || !consultantInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Pagina non disponibile</h1>
            <p className="text-muted-foreground">
              {(infoError as Error)?.message || 'Questa pagina di prenotazione non è attiva o il consulente non esiste.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                {consultantInfo.consultantAvatar ? (
                  <AvatarImage src={consultantInfo.consultantAvatar} alt={consultantInfo.consultantName} />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {consultantInfo.consultantName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Prenota un appuntamento con</p>
                <CardTitle className="text-2xl">{consultantInfo.consultantName}</CardTitle>
              </div>
            </div>
            <CardDescription className="text-base mt-4">
              {consultantInfo.title}
            </CardDescription>
            {consultantInfo.description && (
              <p className="text-sm text-muted-foreground mt-2">{consultantInfo.description}</p>
            )}
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {consultantInfo.appointmentDuration} minuti
              </span>
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                Google Meet
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {step !== 'date' && step !== 'success' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                className="mb-4 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Indietro
              </Button>
            )}

            {step === 'date' && (
              <DateSelector
                weekStart={weekStart}
                availableDates={availableDates}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
                onPrevWeek={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                onNextWeek={() => setWeekOffset(prev => prev + 1)}
                canGoPrev={weekOffset > 0}
                loading={loadingSlots}
              />
            )}

            {step === 'time' && selectedDate && (
              <TimeSelector
                date={selectedDate}
                slots={timeSlotsForSelectedDate}
                selectedTime={selectedTime}
                onSelectTime={handleTimeSelect}
                duration={consultantInfo.appointmentDuration}
              />
            )}

            {step === 'form' && (
              <BookingForm
                formData={formData}
                onChange={setFormData}
                onSubmit={handleFormSubmit}
              />
            )}

            {step === 'confirm' && selectedDate && selectedTime && (
              <ConfirmStep
                consultantName={consultantInfo.consultantName}
                date={selectedDate}
                time={selectedTime}
                duration={consultantInfo.appointmentDuration}
                formData={formData}
                onConfirm={handleConfirmBooking}
                loading={bookMutation.isPending}
              />
            )}

            {step === 'success' && bookingResult && (
              <SuccessScreen result={bookingResult} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DateSelector({
  weekStart,
  availableDates,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  canGoPrev,
  loading,
}: {
  weekStart: Date;
  availableDates: string[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoPrev: boolean;
  loading: boolean;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          Seleziona una data
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevWeek}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextWeek}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {format(weekStart, "d MMMM", { locale: it })} - {format(addDays(weekStart, 6), "d MMMM yyyy", { locale: it })}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isAvailable = availableDates.includes(dateStr);
            const isPast = isBefore(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={dateStr}
                onClick={() => !isPast && isAvailable && onSelectDate(day)}
                disabled={isPast || !isAvailable}
                className={`
                  p-3 rounded-lg text-center transition-all
                  ${isPast || !isAvailable
                    ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                    : isSelected
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-white dark:bg-slate-800 hover:bg-primary/10 border hover:border-primary cursor-pointer'
                  }
                `}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {format(day, 'EEE', { locale: it })}
                </div>
                <div className="text-lg font-semibold">
                  {format(day, 'd')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {availableDates.length === 0 && !loading && (
        <p className="text-center text-muted-foreground py-8">
          Nessuna disponibilità in questa settimana. Prova con un'altra settimana.
        </p>
      )}
    </div>
  );
}

function TimeSelector({
  date,
  slots,
  selectedTime,
  onSelectTime,
  duration,
}: {
  date: Date;
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  duration: number;
}) {
  return (
    <div>
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        Seleziona un orario
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {format(date, "EEEE d MMMM yyyy", { locale: it })} • {duration} minuti
      </p>

      {slots.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nessun orario disponibile per questa data.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((slot) => (
            <Button
              key={slot.time}
              variant={selectedTime === slot.time ? 'default' : 'outline'}
              onClick={() => onSelectTime(slot.time)}
              className="h-12"
            >
              {slot.time}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingForm({
  formData,
  onChange,
  onSubmit,
}: {
  formData: { clientName: string; clientEmail: string; clientPhone: string; notes: string };
  onChange: (data: typeof formData) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-primary" />
        I tuoi dati
      </h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="flex items-center gap-1">
            <User className="w-4 h-4" />
            Nome e Cognome *
          </Label>
          <Input
            id="name"
            value={formData.clientName}
            onChange={(e) => onChange({ ...formData, clientName: e.target.value })}
            placeholder="Mario Rossi"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email" className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            Email *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.clientEmail}
            onChange={(e) => onChange({ ...formData, clientEmail: e.target.value })}
            placeholder="mario@esempio.it"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phone" className="flex items-center gap-1">
            <Phone className="w-4 h-4" />
            Telefono (opzionale)
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.clientPhone}
            onChange={(e) => onChange({ ...formData, clientPhone: e.target.value })}
            placeholder="+39 333 1234567"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Note (opzionale)
          </Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => onChange({ ...formData, notes: e.target.value })}
            placeholder="Scrivi qui eventuali informazioni utili per la consulenza..."
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      <Button type="submit" className="w-full mt-6">
        Continua
      </Button>
    </form>
  );
}

function ConfirmStep({
  consultantName,
  date,
  time,
  duration,
  formData,
  onConfirm,
  loading,
}: {
  consultantName: string;
  date: Date;
  time: string;
  duration: number;
  formData: { clientName: string; clientEmail: string; clientPhone: string; notes: string };
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <CheckCircle className="w-5 h-5 text-primary" />
        Conferma prenotazione
      </h3>

      <div className="bg-muted rounded-lg p-4 space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Consulente:</span>
          <span className="font-medium">{consultantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Data:</span>
          <span className="font-medium">{format(date, "EEEE d MMMM yyyy", { locale: it })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Orario:</span>
          <span className="font-medium">{time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Durata:</span>
          <span className="font-medium">{duration} minuti</span>
        </div>
        <hr className="my-2" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nome:</span>
          <span className="font-medium">{formData.clientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Email:</span>
          <span className="font-medium">{formData.clientEmail}</span>
        </div>
        {formData.clientPhone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Telefono:</span>
            <span className="font-medium">{formData.clientPhone}</span>
          </div>
        )}
        {formData.notes && (
          <div>
            <span className="text-muted-foreground">Note:</span>
            <p className="text-sm mt-1">{formData.notes}</p>
          </div>
        )}
      </div>

      <Button onClick={onConfirm} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Prenotazione in corso...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Conferma Prenotazione
          </>
        )}
      </Button>
    </div>
  );
}

function SuccessScreen({ result }: { result: BookingResult }) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="text-2xl font-bold mb-2">Prenotazione Confermata!</h2>
      <p className="text-muted-foreground mb-6">
        Riceverai un'email di conferma a breve.
      </p>

      <div className="bg-muted rounded-lg p-4 text-left space-y-2 mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Consulente:</span>
          <span className="font-medium">{result.appointmentDetails.consultantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Data:</span>
          <span className="font-medium">
            {format(new Date(result.appointmentDetails.date), "d MMMM yyyy", { locale: it })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Orario:</span>
          <span className="font-medium">{result.appointmentDetails.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Durata:</span>
          <span className="font-medium">{result.appointmentDetails.duration} minuti</span>
        </div>
      </div>

      {result.googleMeetLink && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Link alla videochiamata:</p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(result.googleMeetLink!, '_blank')}
          >
            <Video className="w-4 h-4 mr-2" />
            Apri Google Meet
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Ti consigliamo di salvare il link e di connetterti qualche minuto prima dell'orario previsto.
      </p>
    </div>
  );
}
