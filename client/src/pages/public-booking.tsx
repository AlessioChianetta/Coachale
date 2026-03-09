import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { 
  format, 
  addDays, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  isSameDay, 
  isSameMonth,
  isBefore, 
  startOfDay,
  getDay 
} from 'date-fns';
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
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const TIMEZONES = [
  { value: 'Europe/Rome', label: 'Central European Time' },
  { value: 'Europe/London', label: 'GMT / British Time' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time' },
];

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTimezone, setSelectedTimezone] = useState('Europe/Rome');
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: slotsData, isLoading: loadingSlots } = useQuery<SlotsResponse>({
    queryKey: ['public-booking-slots', slug, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await fetch(
        `/api/public/booking/${slug}/slots?startDate=${format(monthStart, 'yyyy-MM-dd')}&endDate=${format(monthEnd, 'yyyy-MM-dd')}`
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

  const availableDates = useMemo(() => {
    return slotsData?.slots
      .reduce((dates, slot) => {
        if (!dates.includes(slot.date)) dates.push(slot.date);
        return dates;
      }, [] as string[]) || [];
  }, [slotsData]);

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
    if (step === 'form') {
      setStep('date');
      setSelectedTime(null);
    } else if (step === 'confirm') setStep('form');
  };

  const goToNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
  };

  const goToPrevMonth = () => {
    const prevMonth = addMonths(currentMonth, -1);
    const today = startOfDay(new Date());
    if (!isBefore(startOfMonth(prevMonth), startOfMonth(today))) {
      setCurrentMonth(prevMonth);
    }
  };

  const canGoPrev = !isBefore(
    startOfMonth(addMonths(currentMonth, -1)), 
    startOfMonth(new Date())
  );

  const hasAvailabilityThisMonth = availableDates.some(dateStr => {
    const date = new Date(dateStr);
    return isSameMonth(date, currentMonth);
  });

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  if (infoError || !consultantInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Pagina non disponibile</h1>
            <p className="text-sm text-gray-500">
              {(infoError as Error)?.message || 'Questa pagina di prenotazione non è attiva o il consulente non esiste.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <Card className="border shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-[300px] flex-shrink-0 bg-white p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-200">
              <ConsultantInfoPanel consultantInfo={consultantInfo} />
            </div>

            <div className="flex-1 bg-white p-6 lg:p-8">
              {step === 'success' && bookingResult ? (
                <SuccessScreen result={bookingResult} />
              ) : step === 'form' || step === 'confirm' ? (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    className="mb-6 -ml-2 text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Indietro
                  </Button>

                  {selectedDate && selectedTime && (
                    <div className="mb-6 flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <CalendarDays className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })} alle {selectedTime}
                        </p>
                        <p className="text-xs text-gray-500">{consultantInfo.appointmentDuration} minuti con {consultantInfo.consultantName}</p>
                      </div>
                    </div>
                  )}

                  {step === 'form' && (
                    <BookingForm
                      formData={formData}
                      onChange={setFormData}
                      onSubmit={handleFormSubmit}
                      selectedDate={selectedDate}
                      selectedTime={selectedTime}
                      duration={consultantInfo.appointmentDuration}
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
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    Seleziona Data e Orario
                  </h2>

                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="max-w-[400px]">
                      <CalendarGrid
                        currentMonth={currentMonth}
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onSelectDate={handleDateSelect}
                        onPrevMonth={goToPrevMonth}
                        onNextMonth={goToNextMonth}
                        canGoPrev={canGoPrev}
                        loading={loadingSlots}
                      />

                      {!hasAvailabilityThisMonth && !loadingSlots && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-gray-600 text-sm">
                            Nessuna disponibilita in {format(currentMonth, 'MMMM', { locale: it })}
                          </p>
                          <button 
                            onClick={goToNextMonth}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 mt-1"
                          >
                            Vedi mese successivo <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedDate && (
                      <div className="md:w-[200px] flex-shrink-0 md:border-l md:border-gray-200 md:pl-6">
                        <TimeSlotList
                          date={selectedDate}
                          slots={timeSlotsForSelectedDate}
                          selectedTime={selectedTime}
                          onSelectTime={handleTimeSelect}
                          duration={consultantInfo.appointmentDuration}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Globe className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Fuso orario</span>
                    </div>
                    <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                      <SelectTrigger className="mt-1.5 w-full max-w-xs border-gray-200 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label} ({format(new Date(), 'HH:mm')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ConsultantInfoPanel({ consultantInfo }: { consultantInfo: ConsultantInfo }) {
  return (
    <div className="space-y-5">
      <Avatar className="w-14 h-14 border-2 border-gray-100">
        {consultantInfo.consultantAvatar ? (
          <AvatarImage src={consultantInfo.consultantAvatar} alt={consultantInfo.consultantName} />
        ) : null}
        <AvatarFallback className="text-sm font-semibold bg-gray-900 text-white">
          {consultantInfo.consultantName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{consultantInfo.consultantName}</p>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">
          {consultantInfo.title || 'Consulenza'}
        </h1>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2.5 text-gray-500">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{consultantInfo.appointmentDuration} min</span>
        </div>
        <div className="flex items-center gap-2.5 text-gray-500">
          <Video className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">Google Meet</span>
        </div>
      </div>

      {consultantInfo.description && (
        <p className="text-sm text-gray-500 leading-relaxed pt-2 border-t border-gray-100">
          {consultantInfo.description}
        </p>
      )}
    </div>
  );
}

function CalendarGrid({
  currentMonth,
  availableDates,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  canGoPrev,
  loading,
}: {
  currentMonth: Date;
  availableDates: string[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoPrev: boolean;
  loading: boolean;
}) {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${!canGoPrev ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        
        <h3 className="text-sm font-semibold text-gray-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: it })}
        </h3>
        
        <button
          onClick={onNextMonth}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((dayDate, idx) => {
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(dayDate, currentMonth);
              const isAvailable = availableDates.includes(dateStr);
              const isPast = isBefore(dayDate, today);
              const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
              const isToday = isSameDay(dayDate, today);

              return (
                <button
                  key={idx}
                  onClick={() => isCurrentMonth && !isPast && isAvailable && onSelectDate(dayDate)}
                  disabled={!isCurrentMonth || isPast || !isAvailable}
                  className={`
                    relative aspect-square flex items-center justify-center text-sm rounded-full transition-all
                    ${!isCurrentMonth 
                      ? 'text-gray-300 cursor-default' 
                      : isPast || !isAvailable
                      ? 'text-gray-400 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-900 hover:bg-blue-50 cursor-pointer font-medium'
                    }
                  `}
                >
                  {format(dayDate, 'd')}
                  {isToday && !isSelected && isCurrentMonth && (
                    <span className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TimeSlotList({
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
  if (slots.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm">Nessun orario disponibile</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        {format(date, "EEE d MMM", { locale: it })}
      </h3>
      <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
        {slots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => onSelectTime(slot.time)}
            className={`
              py-2 px-3 rounded-md border text-sm font-medium transition-all text-center
              ${selectedTime === slot.time
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }
            `}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}

function BookingForm({
  formData,
  onChange,
  onSubmit,
  selectedDate,
  selectedTime,
  duration,
}: {
  formData: { clientName: string; clientEmail: string; clientPhone: string; notes: string };
  onChange: (data: typeof formData) => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedDate: Date | null;
  selectedTime: string | null;
  duration: number;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h3 className="font-semibold text-gray-900 mb-4">I tuoi dati</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-gray-700">
            Nome e Cognome *
          </Label>
          <Input
            id="name"
            value={formData.clientName}
            onChange={(e) => onChange({ ...formData, clientName: e.target.value })}
            placeholder="Mario Rossi"
            required
            className="mt-1 border-gray-300"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-gray-700">
            Email *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.clientEmail}
            onChange={(e) => onChange({ ...formData, clientEmail: e.target.value })}
            placeholder="mario@esempio.it"
            required
            className="mt-1 border-gray-300"
          />
        </div>

        <div>
          <Label htmlFor="phone" className="text-gray-700">
            Telefono (opzionale)
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.clientPhone}
            onChange={(e) => onChange({ ...formData, clientPhone: e.target.value })}
            placeholder="+39 333 1234567"
            className="mt-1 border-gray-300"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-gray-700">
            Note (opzionale)
          </Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => onChange({ ...formData, notes: e.target.value })}
            placeholder="Scrivi qui eventuali informazioni utili per la consulenza..."
            rows={3}
            className="mt-1 border-gray-300"
          />
        </div>
      </div>

      <Button type="submit" className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
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
      <h3 className="font-semibold text-gray-900 mb-4">Conferma prenotazione</h3>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500">Consulente:</span>
          <span className="font-medium text-gray-900">{consultantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Data:</span>
          <span className="font-medium text-gray-900">{format(date, "EEEE d MMMM yyyy", { locale: it })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Orario:</span>
          <span className="font-medium text-gray-900">{time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Durata:</span>
          <span className="font-medium text-gray-900">{duration} minuti</span>
        </div>
        <hr className="my-2 border-gray-200" />
        <div className="flex justify-between">
          <span className="text-gray-500">Nome:</span>
          <span className="font-medium text-gray-900">{formData.clientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Email:</span>
          <span className="font-medium text-gray-900">{formData.clientEmail}</span>
        </div>
        {formData.clientPhone && (
          <div className="flex justify-between">
            <span className="text-gray-500">Telefono:</span>
            <span className="font-medium text-gray-900">{formData.clientPhone}</span>
          </div>
        )}
        {formData.notes && (
          <div>
            <span className="text-gray-500">Note:</span>
            <p className="text-sm text-gray-900 mt-1">{formData.notes}</p>
          </div>
        )}
      </div>

      <Button onClick={onConfirm} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
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
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prenotazione Confermata!</h2>
      <p className="text-gray-500 mb-6">
        Riceverai un'email di conferma a breve.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500">Consulente:</span>
          <span className="font-medium text-gray-900">{result.appointmentDetails.consultantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Data:</span>
          <span className="font-medium text-gray-900">
            {format(new Date(result.appointmentDetails.date), "d MMMM yyyy", { locale: it })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Orario:</span>
          <span className="font-medium text-gray-900">{result.appointmentDetails.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Durata:</span>
          <span className="font-medium text-gray-900">{result.appointmentDetails.duration} minuti</span>
        </div>
      </div>

      {result.googleMeetLink && (
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Link alla videochiamata:</p>
          <Button
            variant="outline"
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
            onClick={() => window.open(result.googleMeetLink!, '_blank')}
          >
            <Video className="w-4 h-4 mr-2" />
            Apri Google Meet
          </Button>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Ti consigliamo di salvare il link e di connetterti qualche minuto prima dell'orario previsto.
      </p>
    </div>
  );
}
