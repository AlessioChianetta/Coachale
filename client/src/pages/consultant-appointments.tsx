import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, User, Plus, Edit, Trash2, Save, X, CheckCircle, AlertCircle, XCircle, Users, CalendarDays, CalendarIcon, List, ChevronLeft, ChevronRight, Sparkles, BookOpen, Zap, Star, Activity, ClipboardCheck, Search, Lightbulb, Maximize2, Minimize2, ListTodo, Mail, TrendingUp, FileText, Eye, Send, Loader2, Video, Play, Wand2 } from "lucide-react";
import ConsultationTasksManager from "@/components/consultation-tasks-manager";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { type User as UserType } from "@shared/schema";

const appointmentSchema = z.object({
  clientId: z.string().min(1, "Seleziona un cliente"),
  scheduledAt: z.coerce.date(),
  duration: z.coerce.number().min(15, "La durata minima è 15 minuti"),
  notes: z.string().optional(),
  googleMeetLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  fathomShareLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
});

const updateAppointmentSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  duration: z.coerce.number().min(15, "La durata minima è 15 minuti").optional(),
  notes: z.string().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  googleMeetLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  fathomShareLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  transcript: z.string().optional(),
});

const completionFormSchema = z.object({
  needsResearch: z.boolean().default(false),
  needsExercise: z.boolean().default(false),
  completionNotes: z.string().optional(),
  fathomShareLink: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  transcript: z.string().optional(),
  createFollowUpTask: z.boolean().default(false),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;
type UpdateAppointmentForm = z.infer<typeof updateAppointmentSchema>;
type CompletionForm = z.infer<typeof completionFormSchema>;

// Helper function to get email status indicator for appointments
function getEmailStatusIndicator(apt: any): { dot: string; label: string } | null {
  if (apt.status === 'completed') {
    if (apt.summaryEmailStatus === 'sent' || apt.summaryEmailStatus === 'approved') {
      return { dot: '🟢', label: apt.summaryEmailStatus === 'sent' ? 'Email Inviata' : 'Email Approvata' };
    } else if (apt.summaryEmailStatus === 'draft') {
      return { dot: '🟡', label: 'Bozza Pronta' };
    } else if (apt.summaryEmailStatus === 'saved_for_ai') {
      return { dot: '🟢', label: 'Salvata per AI' };
    } else {
      return { dot: '🔴', label: 'Email Mancante' };
    }
  }
  return null;
}

// Componente Calendario Premium
function PremiumCalendarView({ appointments, onDateClick, selectedDate }: {
  appointments: any[];
  onDateClick: (date: Date) => void;
  selectedDate: Date;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let day = startDate;

  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(new Date(apt.scheduledAt), date)
    );
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  // Calculate monthly email statistics
  const monthlyAppointments = appointments.filter(apt => 
    isSameMonth(new Date(apt.scheduledAt), currentDate)
  );
  const totalConsultations = monthlyAppointments.length;
  const completedConsultations = monthlyAppointments.filter(apt => apt.status === 'completed');
  const emailsSent = completedConsultations.filter(apt => apt.summaryEmailStatus === 'sent').length;
  const draftsReady = completedConsultations.filter(apt => apt.summaryEmailStatus === 'draft').length;
  const emailsMissing = completedConsultations.filter(apt => 
    !apt.summaryEmailStatus || apt.summaryEmailStatus === 'missing'
  ).length;

  return (
    <Card className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 border-0 shadow-2xl">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {format(currentDate, "MMMM yyyy", { locale: it })}
              </CardTitle>
              <p className="text-blue-100 text-sm">Visualizza calendario professionale</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={prevMonth}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={nextMonth}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-2 mb-6">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day, index) => (
            <div key={`header-${day}-${index}`} className="p-3 text-center text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayAppointments = getAppointmentsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dayKey}
                onClick={() => onDateClick(day)}
                data-testid={`calendar-day-${dayKey}`}
                className={`
                  p-3 text-sm cursor-pointer rounded-xl transition-all duration-300 min-h-[80px] flex flex-col
                  relative group shadow-sm hover:shadow-lg transform hover:-translate-y-0.5
                  ${isCurrentMonth ? 
                    isSelected ? 
                      "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30" :
                      isToday ? 
                        "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-orange-500/30" :
                        "bg-white dark:bg-slate-800 text-foreground hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50" 
                    : "text-muted-foreground bg-slate-50 dark:bg-slate-900"}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`font-bold ${isSelected || isToday ? 'text-white' : ''}`}>
                    {format(day, "d")}
                  </span>
                  {dayAppointments.length > 0 && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected || isToday ? 'bg-white/30 text-white' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {dayAppointments.length}
                    </div>
                  )}
                </div>

                {/* Indicatore per aggiungere appuntamento */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  {dayAppointments.slice(0, 2).map((apt, idx) => {
                    const emailIndicator = getEmailStatusIndicator(apt);
                    return (
                      <div
                        key={`${apt.id}-${idx}`}
                        className={`text-xs px-2 py-1 rounded-full text-center truncate font-medium shadow-sm flex items-center justify-center gap-1 ${
                          apt.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : apt.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                        title={emailIndicator ? emailIndicator.label : undefined}
                      >
                        {format(new Date(apt.scheduledAt), "HH:mm")}
                        {emailIndicator && (
                          <span className="text-[10px] ml-0.5">{emailIndicator.dot}</span>
                        )}
                      </div>
                    );
                  })}
                  {dayAppointments.length > 2 && (
                    <div className="text-xs text-center font-medium bg-slate-100 text-slate-600 rounded-full py-1">
                      +{dayAppointments.length - 2} altri
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Monthly Email Statistics Bar */}
        <div className="mt-6 p-4 bg-gradient-to-r from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Totale: <span className="font-bold text-blue-600">{totalConsultations}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🟢</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Inviate: <span className="font-bold text-emerald-600">{emailsSent}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🟡</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Bozze: <span className="font-bold text-amber-600">{draftsReady}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔴</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mancanti: <span className={`font-bold ${emailsMissing > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{emailsMissing}</span>
                </span>
                {emailsMissing > 0 && (
                  <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold">LEGENDA:</span> 🟢 Inviata/Approvata  🟡 Bozza  🔴 Mancante  🔵 Programmata
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function for getting appointment color based on status and email
function getAppointmentColorClasses(appointment: any): { bg: string; border: string; text: string } {
  if (appointment.status === 'completed') {
    if (appointment.summaryEmailStatus === 'sent' || appointment.summaryEmailStatus === 'approved') {
      return { 
        bg: 'bg-emerald-100 dark:bg-emerald-900/40', 
        border: 'border-l-4 border-l-emerald-500', 
        text: 'text-emerald-800 dark:text-emerald-200' 
      };
    } else if (appointment.summaryEmailStatus === 'draft') {
      return { 
        bg: 'bg-amber-100 dark:bg-amber-900/40', 
        border: 'border-l-4 border-l-amber-500', 
        text: 'text-amber-800 dark:text-amber-200' 
      };
    } else {
      return { 
        bg: 'bg-rose-100 dark:bg-rose-900/40', 
        border: 'border-l-4 border-l-rose-500', 
        text: 'text-rose-800 dark:text-rose-200' 
      };
    }
  }
  return { 
    bg: 'bg-blue-100 dark:bg-blue-900/40', 
    border: 'border-l-4 border-l-blue-500', 
    text: 'text-blue-800 dark:text-blue-200' 
  };
}

// Componente Vista Settimanale con Timeline Oraria
function WeeklyCalendarView({ 
  appointments, 
  onDateClick, 
  selectedDate,
  onAppointmentSelect,
  selectedAppointment,
  onEdit,
  onComplete,
  onGenerateEmail
}: {
  appointments: any[];
  onDateClick: (date: Date) => void;
  selectedDate: Date;
  onAppointmentSelect: (apt: any | null) => void;
  selectedAppointment: any | null;
  onEdit: (apt: any) => void;
  onComplete: (apt: any) => void;
  onGenerateEmail: (apt: any) => void;
}) {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(selectedDate, { weekStartsOn: 1 }));

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(new Date(apt.scheduledAt), date)
    ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  };

  const nextWeek = () => {
    setCurrentWeek(addDays(currentWeek, 7));
    onAppointmentSelect(null);
  };

  const prevWeek = () => {
    setCurrentWeek(addDays(currentWeek, -7));
    onAppointmentSelect(null);
  };

  const timeSlots = Array.from({ length: 13 }, (_, index) => index + 8); // 08:00 - 20:00

  const dayLabels = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

  const getEmailStatusDisplay = (apt: any): { icon: string; label: string } => {
    if (apt.status !== 'completed') {
      return { icon: '', label: '' };
    }
    if (apt.summaryEmailStatus === 'sent' || apt.summaryEmailStatus === 'approved') {
      return { icon: '✅', label: 'Inviata' };
    } else if (apt.summaryEmailStatus === 'draft') {
      return { icon: '🟡', label: 'Bozza' };
    } else {
      return { icon: '❌', label: 'Manca' };
    }
  };

  return (
    <div className="flex gap-6 h-[750px]">
      {/* Main Calendar Grid */}
      <Card className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 border-0 shadow-2xl overflow-hidden">
        <CardHeader className="pb-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold uppercase tracking-wide">
                  Settimana {format(weekStart, "d", { locale: it })}-{format(weekEnd, "d MMMM yyyy", { locale: it }).toUpperCase()}
                </CardTitle>
                <p className="text-blue-100 text-sm">Vista settimanale • Orario 08:00-20:00</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={prevWeek}
                className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={nextWeek}
                className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden h-[calc(100%-100px)]">
          <div className="flex flex-col h-full">
            {/* Header giorni */}
            <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900 sticky top-0 z-10">
              <div className="p-3 text-center font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 text-sm">
                Orario
              </div>
              {weekDays.map((day, idx) => (
                <div key={day.toISOString()} className={`p-3 text-center border-l border-slate-200 dark:border-slate-700 ${isSameDay(day, new Date()) ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {dayLabels[idx]}
                  </div>
                  <div className={`text-xs ${isSameDay(day, new Date()) ? 'text-blue-600 dark:text-blue-300 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                    {format(day, "dd/MM")}
                  </div>
                  {isSameDay(day, new Date()) && (
                    <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Griglia orari - 08:00 to 20:00 */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-8">
                {timeSlots.map((hour) => (
                  <React.Fragment key={hour}>
                    <div className="p-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-[50px] flex items-center justify-center">
                      <span className="font-bold">{hour.toString().padStart(2, '0')}:00</span>
                    </div>
                    {weekDays.map((day) => {
                      const dayAppointments = getAppointmentsForDay(day);
                      const hourAppointments = dayAppointments.filter(apt => {
                        const aptHour = new Date(apt.scheduledAt).getHours();
                        return aptHour === hour;
                      });

                      return (
                        <div 
                          key={`${day.toISOString()}-${hour}`}
                          className="relative h-[50px] border-b border-l border-slate-200 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors duration-150 group"
                          onClick={() => {
                            const clickedDate = new Date(day);
                            clickedDate.setHours(hour, 0, 0, 0);
                            onDateClick(clickedDate);
                          }}
                        >
                          {/* Indicatore orario corrente */}
                          {isSameDay(day, new Date()) && new Date().getHours() === hour && (
                            <div 
                              className="absolute left-0 right-0 border-t-2 border-red-500 z-20"
                              style={{
                                top: `${(new Date().getMinutes() / 60) * 100}%`
                              }}
                            >
                              <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1"></div>
                            </div>
                          )}

                          {/* Appuntamenti */}
                          {hourAppointments.map((appointment) => {
                            const colors = getAppointmentColorClasses(appointment);
                            const emailStatus = getEmailStatusDisplay(appointment);
                            const isSelected = selectedAppointment?.id === appointment.id;
                            
                            return (
                              <div
                                key={appointment.id}
                                className={`absolute inset-x-0.5 top-0.5 bottom-0.5 ${colors.bg} ${colors.border} ${colors.text} text-xs p-1 rounded shadow-sm z-10 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAppointmentSelect(appointment);
                                }}
                              >
                                <div className="font-semibold truncate text-[10px] leading-tight">
                                  {appointment.client?.firstName} {appointment.client?.lastName}
                                </div>
                                <div className="text-[9px] opacity-80 flex items-center gap-1">
                                  {format(new Date(appointment.scheduledAt), "HH:mm")}
                                  {emailStatus.icon && (
                                    <span className="text-[8px]">{emailStatus.icon}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Indicatore hover per nuovo appuntamento */}
                          {hourAppointments.length === 0 && (
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-blue-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right Side Detail Panel */}
      <Card className="w-80 bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              {selectedAppointment ? <User className="w-5 h-5" /> : <CalendarDays className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="text-lg font-bold">
                {selectedAppointment ? 'Dettagli Appuntamento' : 'Seleziona Appuntamento'}
              </CardTitle>
              <p className="text-indigo-100 text-xs">
                {selectedAppointment 
                  ? format(new Date(selectedAppointment.scheduledAt), "dd MMMM yyyy", { locale: it })
                  : 'Clicca su un appuntamento'
                }
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-y-auto">
          {selectedAppointment ? (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-700 dark:to-blue-900/30 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedAppointment.client?.firstName} {selectedAppointment.client?.lastName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedAppointment.client?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Date & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-1">
                    <CalendarDays className="w-3 h-3" />
                    Data
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {format(new Date(selectedAppointment.scheduledAt), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    Durata
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedAppointment.duration} minuti
                  </p>
                </div>
              </div>

              {/* Time */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  Orario
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {format(new Date(selectedAppointment.scheduledAt), "HH:mm")} - {format(new Date(new Date(selectedAppointment.scheduledAt).getTime() + selectedAppointment.duration * 60000), "HH:mm")}
                </p>
              </div>

              {/* Status Badge */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                <div className="text-slate-600 dark:text-slate-400 text-xs mb-2">Stato</div>
                <Badge className={`${
                  selectedAppointment.status === 'completed' 
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                    : selectedAppointment.status === 'cancelled'
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-blue-100 text-blue-700 border-blue-200'
                } border text-xs px-3 py-1`}>
                  {selectedAppointment.status === 'completed' ? 'Completato' : 
                   selectedAppointment.status === 'cancelled' ? 'Cancellato' : 'Programmato'}
                </Badge>
              </div>

              {/* Email Status */}
              {selectedAppointment.status === 'completed' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-2">
                    <Mail className="w-3 h-3" />
                    📧 Email
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAppointment.summaryEmailStatus === 'sent' || selectedAppointment.summaryEmailStatus === 'approved' ? (
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        ✅ Inviata
                      </span>
                    ) : selectedAppointment.summaryEmailStatus === 'draft' ? (
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        🟡 Bozza
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        ❌ Manca
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs mb-2">
                    <BookOpen className="w-3 h-3" />
                    Note
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => onEdit(selectedAppointment)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl text-sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Visualizza / Modifica
                </Button>

                {selectedAppointment.status === 'scheduled' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onComplete(selectedAppointment)}
                    className="w-full rounded-xl text-sm border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completa Consulenza
                  </Button>
                )}

                {selectedAppointment.status === 'completed' && 
                 selectedAppointment.transcript && 
                 !selectedAppointment.summaryEmail && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerateEmail(selectedAppointment)}
                    className="w-full rounded-xl text-sm border-purple-300 text-purple-600 hover:bg-purple-50"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Genera Email
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Nessuna selezione</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Clicca su un appuntamento nel calendario per visualizzarne i dettagli
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente Vista Settimanale Premium (Legacy)
function PremiumWeekView({ appointments, onDateClick, selectedDate }: {
  appointments: any[];
  onDateClick: (date: Date) => void;
  selectedDate: Date;
}) {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(selectedDate, { weekStartsOn: 1 }));
  const [isExpanded, setIsExpanded] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(new Date(apt.scheduledAt), date)
    ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  };

  const nextWeek = () => {
    setCurrentWeek(addDays(currentWeek, 7));
  };

  const prevWeek = () => {
    setCurrentWeek(addDays(currentWeek, -7));
  };

  const getAppointmentPosition = (appointment: any, hour: number) => {
    const aptDate = new Date(appointment.scheduledAt);
    const aptHour = aptDate.getHours();
    const aptMinutes = aptDate.getMinutes();

    if (aptHour === hour) {
      const topOffset = (aptMinutes / 60) * 100;
      const height = Math.min((appointment.duration / 60) * 100, 100 - topOffset);
      return { topOffset, height };
    }
    return null;
  };

  const timeSlots = Array.from({ length: 24 }, (_, index) => index); // 00:00 - 23:00

  return (
    <Card className={`${isExpanded ? 'fixed inset-4 z-50' : 'h-full'} bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 border-0 shadow-2xl transition-all duration-300`}>
      <CardHeader className="pb-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Settimana {format(weekStart, "dd", { locale: it })} - {format(addDays(weekStart, 6), "dd MMMM yyyy", { locale: it })}
              </CardTitle>
              <p className="text-blue-100 text-sm">Vista settimanale dettagliata - Slot orari da 1 ora</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              title={isExpanded ? "Riduci" : "Espandi"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={prevWeek}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={nextWeek}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <div className={`flex flex-col ${isExpanded ? 'h-[calc(100vh-200px)]' : 'h-[800px]'}`}>
          {/* Header giorni */}
          <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900 sticky top-0 z-10">
            <div className="p-4 text-center font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800">
              Orario
            </div>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="p-4 text-center border-l border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {format(day, "EEE", { locale: it })}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {format(day, "dd/MM")}
                </div>
                {isSameDay(day, new Date()) && (
                  <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                )}
              </div>
            ))}
          </div>

          {/* Griglia orari - Slot da 1 ora */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-8">
              {timeSlots.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="p-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky left-0 z-5">
                    <div className="font-bold">{hour.toString().padStart(2, '0')}:00</div>
                    <div className="text-xs text-slate-500 dark:text-slate-500">
                      {hour.toString().padStart(2, '0')}:59
                    </div>
                  </div>
                  {weekDays.map((day) => {
                    const dayAppointments = getAppointmentsForDay(day);
                    const hourAppointments = dayAppointments.filter(apt => {
                      const aptHour = new Date(apt.scheduledAt).getHours();
                      return aptHour === hour;
                    });

                    return (
                      <div 
                        key={`${day.toISOString()}-${hour}`}
                        className="relative min-h-[80px] border-b border-l border-slate-200 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors duration-150 group"
                        onClick={() => {
                          const clickedDate = new Date(day);
                          clickedDate.setHours(hour, 0, 0, 0);
                          onDateClick(clickedDate);
                        }}
                      >
                        {/* Indicatore orario corrente */}
                        {isSameDay(day, new Date()) && new Date().getHours() === hour && (
                          <div 
                            className="absolute left-0 right-0 border-t-2 border-red-500 z-20"
                            style={{
                              top: `${(new Date().getMinutes() / 60) * 100}%`
                            }}
                          >
                            <div className="w-3 h-3 bg-red-500 rounded-full -mt-1.5 -ml-1.5"></div>
                          </div>
                        )}

                        {/* Appuntamenti */}
                        {hourAppointments.map((appointment) => {
                          const position = getAppointmentPosition(appointment, hour);
                          if (!position) return null;

                          return (
                            <div
                              key={appointment.id}
                              className="absolute inset-x-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs p-2 rounded-lg shadow-lg z-10 hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                              style={{
                                top: `${position.topOffset}%`,
                                height: `${position.height}%`,
                                minHeight: '40px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Qui potresti aprire un modal con i dettagli dell'appuntamento
                              }}
                            >
                              <div className="font-semibold truncate text-sm">
                                {appointment.client?.firstName} {appointment.client?.lastName}
                              </div>
                              <div className="text-xs opacity-90 mt-1">
                                {format(new Date(appointment.scheduledAt), "HH:mm")} 
                                <span className="mx-1">•</span>
                                {appointment.duration}min
                              </div>
                              {appointment.status && (
                                <div className="text-xs mt-1 opacity-80">
                                  {appointment.status === 'completed' ? '✅' : 
                                   appointment.status === 'cancelled' ? '❌' : '⏳'}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Indicatore hover per nuovo appuntamento */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <div className="bg-blue-500/20 text-blue-600 text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                            + Nuovo appuntamento
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Echo Dashboard Panel Component (inline)
interface EchoStats {
  totalEmails: number;
  totalTasks: number;
  pendingApprovals: number;
  missingEmails: number;
  successRate: number;
}

interface EchoPendingConsultation {
  id: string;
  clientId: string;
  scheduledAt: string;
  duration: number;
  notes: string | null;
  transcript: string | null;
  fathomShareLink: string | null;
  summaryEmailStatus: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface EchoDraftEmail {
  id: string;
  clientId: string;
  scheduledAt: string;
  summaryEmailDraft: {
    subject: string;
    body: string;
    extractedTasks: Array<{
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: string;
      category: string;
    }>;
  };
  summaryEmailGeneratedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  draftTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: string;
    category: string;
  }>;
}

function EchoDashboardPanel() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<EchoStats>({
    queryKey: ["/api/echo/stats"],
    queryFn: async () => {
      const response = await fetch("/api/echo/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: pendingConsultations = [], isLoading: pendingLoading } = useQuery<EchoPendingConsultation[]>({
    queryKey: ["/api/echo/pending-consultations"],
    queryFn: async () => {
      const response = await fetch("/api/echo/pending-consultations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch pending consultations");
      return response.json();
    },
  });

  const { data: draftEmails = [], isLoading: draftsLoading } = useQuery<EchoDraftEmail[]>({
    queryKey: ["/api/echo/draft-emails"],
    queryFn: async () => {
      const response = await fetch("/api/echo/draft-emails", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch draft emails");
      return response.json();
    },
  });

  const generateEmailMutation = useMutation({
    mutationFn: async ({ consultationId, additionalNotes }: { consultationId: string; additionalNotes?: string }) => {
      const response = await fetch("/api/echo/generate-email", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId, additionalNotes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Generata",
        description: "L'email è stata generata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/pending-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveAndSendMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/approve-and-send", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve and send");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Inviata",
        description: "L'email è stata approvata e inviata al cliente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveForAIMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/save-for-ai", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save for AI");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Salvato per AI",
        description: "Il contenuto è stato salvato nel contesto AI.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = statsLoading || pendingLoading || draftsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Email Generate</p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{stats?.totalEmails || 0}</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                <Mail className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Task Estratti</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats?.totalTasks || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">In Attesa</p>
                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{stats?.pendingApprovals || 0}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 border-rose-200 dark:border-rose-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Mancanti</p>
                <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">{stats?.missingEmails || 0}</p>
              </div>
              <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-full">
                <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertCircle className="h-5 w-5" />
              Consulenze Senza Email
            </CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Consulenze completate senza riepilogo email
            </p>
          </CardHeader>
          <CardContent>
            {pendingConsultations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p>Tutte le consulenze hanno già un'email!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {pendingConsultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="p-4 rounded-lg border border-orange-100 dark:border-orange-900 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {consultation.client?.firstName} {consultation.client?.lastName}
                        </span>
                      </div>
                      {consultation.transcript ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <FileText className="h-3 w-3 mr-1" />
                          Trascrizione
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No Trascrizione
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(consultation.scheduledAt), "d MMM yyyy", { locale: it })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(consultation.scheduledAt), { addSuffix: true, locale: it })}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                      disabled={!consultation.transcript || generateEmailMutation.isPending}
                      onClick={() => generateEmailMutation.mutate({ consultationId: consultation.id })}
                    >
                      {generateEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Genera Email
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Clock className="h-5 w-5" />
              Email in Attesa Approvazione
            </CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Bozze pronte per la revisione
            </p>
          </CardHeader>
          <CardContent>
            {draftEmails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nessuna bozza in attesa</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {draftEmails.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 rounded-lg border border-yellow-100 dark:border-yellow-900 bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {email.client?.firstName} {email.client?.lastName}
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        <ClipboardCheck className="h-3 w-3 mr-1" />
                        {email.draftTasks?.length || 0} Task
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">
                      {email.summaryEmailDraft?.subject || "Riepilogo Consulenza"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <Clock className="h-3 w-3" />
                      Generata {formatDistanceToNow(new Date(email.summaryEmailGeneratedAt), { addSuffix: true, locale: it })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveForAIMutation.mutate(email.id)}
                        disabled={saveForAIMutation.isPending}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salva AI
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white"
                        disabled={approveAndSendMutation.isPending}
                        onClick={() => approveAndSendMutation.mutate(email.id)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Approva & Invia
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConsultantAppointments() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<string | null>(null);
  const [completingAppointment, setCompletingAppointment] = useState<string | null>(null);
  const [transcriptMode, setTranscriptMode] = useState<'fathom' | 'full'>('fathom');
  const [fullTranscript, setFullTranscript] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTasksPreview, setShowTasksPreview] = useState(false);
  const isMobile = useIsMobile();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  const [justCompletedConsultationId, setJustCompletedConsultationId] = useState<string | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [selectedWeekAppointment, setSelectedWeekAppointment] = useState<any | null>(null);

  // Ottieni dati utente corrente da localStorage (disponibile immediatamente)
  const currentUser = React.useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      console.log('🔍 Current user from localStorage:', user);
      return user;
    } catch {
      return null;
    }
  }, []);


  // Query per ottenere consultazioni del consulente
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/consultations/consultant"],
    retry: 1,
  });

  // Query per ottenere lista clienti
  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minuti
  });

  // Form per creare nuovi appuntamenti
  const createForm = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: "",
      duration: 60,
      notes: "",
      scheduledAt: selectedDate,
    },
  });

  // Debug info
  console.log("Clients data:", clients);
  console.log("Clients loading:", clientsLoading);
  console.log("Clients error:", clientsError);

  // Form per modificare appuntamenti
  const updateForm = useForm<UpdateAppointmentForm>({
    resolver: zodResolver(updateAppointmentSchema),
  });

  // Form per completamento consulenza
  const completionForm = useForm<CompletionForm>({
    resolver: zodResolver(completionFormSchema),
    defaultValues: {
      needsResearch: false,
      needsExercise: false,
      completionNotes: "",
    },
  });

  // Mutation per creare appuntamento
  const createMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      return apiRequest("POST", "/api/consultations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/consultant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "🎉 Fantastico!",
        description: "Appuntamento creato con successo",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore nella creazione dell'appuntamento",
        variant: "destructive",
      });
    },
  });

  // Mutation per aggiornare appuntamento
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAppointmentForm }) => {
      return apiRequest("PUT", `/api/consultations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/consultant"] });
      toast({
        title: "✨ Perfetto!",
        description: "Appuntamento aggiornato con successo",
      });
      setEditingAppointment(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore nell'aggiornamento dell'appuntamento",
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare appuntamento
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/consultations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/consultant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "🗑️ Rimosso!",
        description: "Appuntamento eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore nell'eliminazione dell'appuntamento",
        variant: "destructive",
      });
    },
  });

  // Mutation per completare appuntamento
  const completeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompletionForm }) => {
      const completionNotes = data.completionNotes || "";
      const reminders = [];

      if (data.needsResearch) {
        reminders.push("📋 PROMEMORIA: Fare ricerca approfondita sulla consulenza");
      }
      if (data.needsExercise) {
        reminders.push("💪 PROMEMORIA: Creare esercizio personalizzato per il cliente");
      }

      const finalNotes = reminders.length > 0 
        ? `${completionNotes}\n\n${reminders.join("\n")}`
        : completionNotes;

      // Aggiorna la consulenza con lo stato completed e il link Fathom
      const updateData: any = {
        status: "completed",
        notes: finalNotes,
      };

      if (data.fathomShareLink) {
        updateData.fathomShareLink = data.fathomShareLink;
      }

      // CRITICAL: Always send transcript (even if empty) to allow clearing
      // Empty string/null/undefined will clear the existing transcript
      updateData.transcript = data.transcript || null;

      await apiRequest("PUT", `/api/consultations/${id}`, updateData);

      // Se richiesto, crea task di follow-up
      if (data.createFollowUpTask) {
        const appointment = (appointments as any[]).find((apt: any) => apt.id === id);
        if (appointment) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 3); // Task scade tra 3 giorni

          await apiRequest("POST", "/api/consultation-tasks", {
            clientId: appointment.clientId,
            title: "Follow-up consulenza",
            description: `Follow-up per la consulenza del ${format(new Date(appointment.scheduledAt), "dd/MM/yyyy 'alle' HH:mm", { locale: it })}`,
            dueDate: dueDate.toISOString(),
            priority: "medium",
            category: "follow-up",
            consultationId: id,
          });
        }
      }

      return { success: true, consultationId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/consultant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
      toast({
        title: "✅ Consulenza Completata!",
        description: "Lo stato è stato aggiornato e i promemoria sono stati salvati",
      });

      const completedConsultation = (appointments as any[]).find((apt: any) => apt.id === data.consultationId);

      setCompletingAppointment(null);
      completionForm.reset();

      if (completedConsultation?.transcript) {
        setJustCompletedConsultationId(data.consultationId);
        setIsEmailDialogOpen(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore nel completamento della consulenza",
        variant: "destructive",
      });
    },
  });

  const generateEmailMutation = useMutation({
    mutationFn: async ({ consultationId, additionalNotes }: { consultationId: string; additionalNotes?: string }) => {
      return apiRequest("POST", `/api/consultations/${consultationId}/generate-summary-email`, {
        additionalNotes: additionalNotes || undefined,
      });
    },
    onMutate: () => {
      toast({
        title: "🤖 Generazione in corso...",
        description: "L'AI sta analizzando la trascrizione e creando l'email. Richiede circa 30-40 secondi.",
        className: "bg-blue-50 border-blue-200",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/consultant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/email-drafts"] });
      toast({
        title: "✅ Bozza email generata!",
        description: "La troverai nella sezione Gestione Email AI",
        className: "bg-green-50 border-green-200",
      });
      setIsEmailDialogOpen(false);
      setAdditionalNotes("");
      setJustCompletedConsultationId(null);
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast({
          title: "⚠️ Attenzione",
          description: error.message || "Email già generata per questa consulenza",
          className: "bg-yellow-50 border-yellow-200",
        });
      } else {
        toast({
          title: "❌ Errore",
          description: error.message || "Errore nella generazione dell'email",
          variant: "destructive",
        });
      }
      setIsEmailDialogOpen(false);
      setAdditionalNotes("");
      setJustCompletedConsultationId(null);
    },
  });

  const onCreateSubmit = (data: AppointmentForm) => {
    createMutation.mutate(data);
  };

  const onUpdateSubmit = (data: UpdateAppointmentForm) => {
    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment, data });
    }
  };

  const handleEdit = (appointment: any) => {
    console.log('Edit clicked for appointment:', appointment.id);
    console.log('🔍 Full appointment data:', appointment);
    console.log('🔍 Client ID from appointment:', appointment.clientId);
    console.log('🔍 Current user ID:', currentUser?.id);
    setEditingAppointment(appointment.id);
    updateForm.reset({
      scheduledAt: new Date(appointment.scheduledAt),
      duration: appointment.duration,
      notes: appointment.notes || "",
      status: appointment.status,
      googleMeetLink: appointment.googleMeetLink || "",
      fathomShareLink: appointment.fathomShareLink || "",
      transcript: appointment.transcript || "",
    });
  };

  const handleDelete = (id: string) => {
    console.log('Delete clicked for appointment:', id);
    if (confirm("Sei sicuro di voler eliminare questo appuntamento?")) {
      console.log('Confirmed delete for:', id);
      deleteMutation.mutate(id);
    }
  };

  const handleComplete = (appointment: any) => {
    setCompletingAppointment(appointment.id);
    completionForm.reset({
      needsResearch: false,
      needsExercise: false,
      completionNotes: "",
      fathomShareLink: appointment.fathomShareLink || "",
      createFollowUpTask: false,
    });
  };

  const onCompleteSubmit = (data: CompletionForm) => {
    if (completingAppointment) {
      completeMutation.mutate({ id: completingAppointment, data });
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Imposta automaticamente la data nel form di creazione con orario di default
    const defaultTime = new Date(date);
    defaultTime.setHours(9, 0, 0, 0); // Ore 9:00 di default
    createForm.setValue("scheduledAt", defaultTime);
    // Apri automaticamente il dialog di creazione
    setIsCreateDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      scheduled: { 
        label: "Programmato",
        icon: CalendarDays,
        gradient: "from-blue-500 to-indigo-600",
        shadow: "shadow-blue-500/30"
      },
      completed: { 
        label: "Completato",
        icon: CheckCircle,
        gradient: "from-emerald-500 to-green-600",
        shadow: "shadow-emerald-500/30"
      },
      cancelled: { 
        label: "Cancellato",
        icon: XCircle,
        gradient: "from-rose-500 to-red-600",
        shadow: "shadow-rose-500/30"
      },
    };

    const statusConfig = config[status as keyof typeof config] || config.scheduled;
    const IconComponent = statusConfig.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${statusConfig.gradient} ${statusConfig.shadow} shadow-lg`}>
        <IconComponent className="w-4 h-4" />
        {statusConfig.label}
      </div>
    );
  };

  // Filtra appuntamenti per la data selezionata
  const appointmentsForSelectedDate = (appointments as any[]).filter(apt => 
    isSameDay(new Date(apt.scheduledAt), selectedDate)
  );

  // Ordina gli appuntamenti per data
  const sortedAppointments = [...(appointments as any[])].sort(
    (a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // Stato per filtro lista
  const [listFilter, setListFilter] = useState<'all' | 'need_data' | 'ready_email' | 'email_sent'>('all');

  // Calcola statistiche per i filtri
  const filterStats = {
    all: sortedAppointments.length,
    need_data: sortedAppointments.filter(apt => 
      apt.status === 'completed' && (!apt.transcript || apt.transcript.trim() === '')
    ).length,
    ready_email: sortedAppointments.filter(apt => 
      apt.status === 'completed' && 
      apt.transcript && apt.transcript.trim() !== '' && 
      (!apt.summaryEmailStatus || apt.summaryEmailStatus === 'missing' || apt.summaryEmailStatus === 'draft')
    ).length,
    email_sent: sortedAppointments.filter(apt => 
      apt.summaryEmailStatus === 'sent' || apt.summaryEmailStatus === 'approved' || apt.summaryEmailStatus === 'saved_for_ai'
    ).length,
  };

  // Filtra appuntamenti in base al filtro selezionato
  const filteredListAppointments = sortedAppointments.filter(apt => {
    switch (listFilter) {
      case 'need_data':
        return apt.status === 'completed' && (!apt.transcript || apt.transcript.trim() === '');
      case 'ready_email':
        return apt.status === 'completed' && 
               apt.transcript && apt.transcript.trim() !== '' && 
               (!apt.summaryEmailStatus || apt.summaryEmailStatus === 'missing' || apt.summaryEmailStatus === 'draft');
      case 'email_sent':
        return apt.summaryEmailStatus === 'sent' || apt.summaryEmailStatus === 'approved' || apt.summaryEmailStatus === 'saved_for_ai';
      default:
        return true;
    }
  });

  // Helper per controllare lo stato di completamento di un appuntamento
  const getAppointmentProgress = (apt: any) => ({
    hasGoogleMeet: !!apt.googleMeetLink,
    isCompleted: apt.status === 'completed',
    hasFathomLink: !!apt.fathomShareLink,
    hasTranscript: !!apt.transcript && apt.transcript.trim() !== '',
    emailStatus: apt.summaryEmailStatus || 'missing'
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex h-[calc(100vh-80px)]">
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />
          <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
            <Card className="p-8 shadow-2xl bg-white/80 backdrop-blur-sm border-0">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
                </div>
                <p className="mt-6 text-slate-700 font-semibold text-lg">Caricamento appuntamenti...</p>
                <p className="text-slate-500 text-sm mt-2">Preparazione della tua agenda professionale</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950" data-testid="consultant-appointments-page">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header Premium */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Gestione Appuntamenti
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">Organizza e monitora le tue consulenze professionali</p>
                  </div>
                </div>
              </div>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 transition-all duration-300 rounded-2xl px-8 py-4"
                    data-testid="button-create-appointment"
                  >
                    <Plus className="w-6 h-6 mr-3" />
                    <span className="font-semibold text-lg">Nuovo Appuntamento</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-0 shadow-3xl rounded-3xl">
                  <DialogHeader className="space-y-4 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl">
                        <CalendarDays className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                          Crea Nuovo Appuntamento
                        </DialogTitle>
                        <p className="text-slate-600 dark:text-slate-400">Programma una nuova consulenza professionale</p>
                      </div>
                    </div>
                  </DialogHeader>

                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                      <FormField
                        control={createForm.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Cliente
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger 
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 bg-slate-50 dark:bg-slate-800"
                                  data-testid="select-client"
                                >
                                  <SelectValue placeholder={
                                    clientsLoading ? "Caricamento clienti..." :
                                    (clients as any[]).length === 0 ? "Nessun cliente disponibile" :
                                    "Seleziona un cliente"
                                  } />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl border-0 shadow-2xl">
                                {clientsLoading ? (
                                  <div className="p-4 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3"></div>
                                    <p className="text-slate-600 font-medium">Caricamento clienti...</p>
                                  </div>
                                ) : clientsError ? (
                                  <div className="p-4 text-center">
                                    <Users className="w-12 h-12 mx-auto text-red-400 mb-3" />
                                    <p className="text-red-600 font-medium">Errore nel caricamento</p>
                                    <p className="text-red-400 text-sm">Riprova più tardi</p>
                                  </div>
                                ) : (clients as any[]).length === 0 ? (
                                  <div className="p-4 text-center">
                                    <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                                    <p className="text-slate-600 font-medium">Nessun cliente associato</p>
                                    <p className="text-slate-400 text-sm">I clienti dovranno registrarsi al sistema per apparire qui</p>
                                    <p className="text-slate-400 text-xs mt-2">Condividi il link di registrazione con i tuoi clienti</p>
                                  </div>
                                ) : (
                                  (clients as any[]).map((client: any) => (
                                    <SelectItem key={client.id} value={client.id || `client-${client.id}`} className="rounded-lg p-3 m-1">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                                          <User className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="font-medium">{client.firstName} {client.lastName}</span>
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />



                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={createForm.control}
                          name="scheduledAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Data e Ora
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 bg-slate-50 dark:bg-slate-800"
                                  {...field}
                                  value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                                  onChange={(e) => field.onChange(new Date(e.target.value))}
                                  data-testid="input-scheduled-at"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={createForm.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Durata (minuti)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 bg-slate-50 dark:bg-slate-800"
                                  {...field}
                                  data-testid="input-duration"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={createForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              Note aggiuntive (opzionale)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[100px] rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 bg-slate-50 dark:bg-slate-800 resize-none"
                                rows={4}
                                {...field}
                                placeholder="Aggiungi note specifiche per questa consulenza..."
                                data-testid="textarea-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-6">
                        <FormField
                          control={createForm.control}
                          name="googleMeetLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M15 12c0 1.654-1.346 3-3 3s-3-1.346-3-3 1.346-3 3-3 3 1.346 3 3zm9-.449s-4.252 8.449-11.985 8.449c-7.18 0-12.015-8.449-12.015-8.449s4.446-7.551 12.015-7.551c7.694 0 11.985 7.551 11.985 7.551zm-7 .449c0-2.757-2.243-5-5-5s-5 2.243-5 5 2.243 5 5 5 5-2.243 5-5z"/>
                                </svg>
                                Link Google Meet (opzionale)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 bg-slate-50 dark:bg-slate-800"
                                  {...field}
                                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                  data-testid="input-google-meet-link"
                                />
                              </FormControl>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Il cliente vedrà un pulsante per entrare direttamente nella call
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={createForm.control}
                          name="fathomShareLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                Link Registrazione Fathom (opzionale)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-purple-500 bg-slate-50 dark:bg-slate-800"
                                  {...field}
                                  placeholder="https://fathom.video/share/..."
                                  data-testid="input-fathom-link"
                                />
                              </FormControl>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Puoi aggiungere questo link anche dopo aver completato la consulenza
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          className="px-8 py-3 rounded-xl border-2 border-slate-300 hover:border-slate-400 font-semibold"
                          data-testid="button-cancel"
                        >
                          Annulla
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending}
                          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold"
                          data-testid="button-submit"
                        >
                          {createMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                              Creazione...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Crea Appuntamento
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Dialog per modifica appuntamento */}
              <Dialog open={!!editingAppointment} onOpenChange={() => {
                setEditingAppointment(null);
                setTranscriptMode('fathom');
                setFullTranscript('');
              }}>
                <DialogContent className="sm:max-w-3xl bg-white dark:bg-slate-900 border-0 shadow-3xl rounded-3xl max-h-[90vh] overflow-y-auto">
                  {editingAppointment && (() => {
                    const currentAppointment = (appointments as any[]).find((apt: any) => apt.id === editingAppointment);
                    const isCompleted = currentAppointment?.status === 'completed';
                    const hasTranscript = !!currentAppointment?.transcript;
                    const hasFathomLink = !!currentAppointment?.fathomShareLink;
                    const hasGoogleMeet = !!currentAppointment?.googleMeetLink;
                    
                    return (
                      <>
                        <DialogHeader className="space-y-4 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-orange-600 to-yellow-600'}`}>
                                {isCompleted ? <CheckCircle className="w-6 h-6 text-white" /> : <Edit className="w-6 h-6 text-white" />}
                              </div>
                              <div>
                                <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                                  {currentAppointment?.client?.firstName} {currentAppointment?.client?.lastName}
                                </DialogTitle>
                                <p className="text-slate-600 dark:text-slate-400">
                                  {currentAppointment?.scheduledAt ? format(new Date(currentAppointment.scheduledAt), "EEEE d MMMM yyyy 'alle' HH:mm", { locale: it }) : ''}
                                </p>
                              </div>
                            </div>
                            {/* Status Badge */}
                            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                              isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              currentAppointment?.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {isCompleted ? 'Completata' : currentAppointment?.status === 'cancelled' ? 'Cancellata' : 'Programmata'}
                            </div>
                          </div>
                          
                          {/* Progress Steps */}
                          <div className="flex items-center gap-2 pt-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${hasGoogleMeet ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${hasGoogleMeet ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Link Call
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Completata
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${hasFathomLink ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${hasFathomLink ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Registrazione
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${hasTranscript ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${hasTranscript ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Trascrizione
                            </div>
                          </div>
                        </DialogHeader>

                        <Form {...updateForm}>
                          <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-6">
                            
                            {/* SEZIONE 1: Informazioni Base */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                Informazioni Consulenza
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={updateForm.control}
                                  name="scheduledAt"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-slate-600 dark:text-slate-400">Data e Ora</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="datetime-local"
                                          className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                          {...field}
                                          value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                                          onChange={(e) => field.onChange(new Date(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={updateForm.control}
                                  name="duration"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-slate-600 dark:text-slate-400">Durata (minuti)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={updateForm.control}
                                  name="status"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-slate-600 dark:text-slate-400">Stato</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                            <SelectValue placeholder="Seleziona stato" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border-0 shadow-2xl">
                                          <SelectItem value="scheduled" className="rounded-lg p-3 m-1">
                                            <div className="flex items-center gap-3">
                                              <CalendarDays className="w-4 h-4 text-blue-600" />
                                              <span>Programmato</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="completed" className="rounded-lg p-3 m-1">
                                            <div className="flex items-center gap-3">
                                              <CheckCircle className="w-4 h-4 text-green-600" />
                                              <span>Completato</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="cancelled" className="rounded-lg p-3 m-1">
                                            <div className="flex items-center gap-3">
                                              <XCircle className="w-4 h-4 text-red-600" />
                                              <span>Cancellato</span>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              {/* Note */}
                              <div className="mt-4">
                                <FormField
                                  control={updateForm.control}
                                  name="notes"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-slate-600 dark:text-slate-400">Note private</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          className="min-h-[80px] rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
                                          rows={3}
                                          {...field}
                                          placeholder="Note interne sulla consulenza..."
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                            
                            {/* SEZIONE 2: Prima della Call */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-200 dark:border-blue-800">
                              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                                <Video className="w-5 h-5" />
                                Prima della Call
                                {hasGoogleMeet && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                              </h3>
                              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                                Inserisci il link della videochiamata per permettere al cliente di partecipare
                              </p>
                              <FormField
                                control={updateForm.control}
                                name="googleMeetLink"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.09.18 2.13.51 3.11l-.01-.03L6 18h12l3.5-2.92.01.03c.33-.98.51-2.02.51-3.11 0-5.52-4.48-10-10-10zm0 8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-6 5c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4H6z"/>
                                          </svg>
                                        </div>
                                        <Input
                                          type="url"
                                          className="h-12 pl-12 rounded-xl border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800"
                                          {...field}
                                          placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                          data-testid="input-google-meet-link-update"
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* SEZIONE 3: Dopo la Call */}
                            <div className={`p-5 rounded-2xl border ${isCompleted ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'}`}>
                              <h3 className={`text-lg font-bold flex items-center gap-2 mb-2 ${isCompleted ? 'text-purple-800 dark:text-purple-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                <FileText className="w-5 h-5" />
                                Dopo la Call
                                {(hasFathomLink && hasTranscript) && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                              </h3>
                              <p className={`text-sm mb-4 ${isCompleted ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                                {isCompleted ? 'Aggiungi la registrazione e trascrizione per abilitare le funzioni AI' : 'Completa prima la consulenza per aggiungere questi dati'}
                              </p>
                              
                              <div className="space-y-4">
                                <FormField
                                  control={updateForm.control}
                                  name="fathomShareLink"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className={`text-sm font-medium flex items-center gap-2 ${isCompleted ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400'}`}>
                                        <Play className="w-4 h-4" />
                                        Link Registrazione Fathom
                                        {hasFathomLink && <CheckCircle className="w-3 h-3 text-green-500" />}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          type="url"
                                          className={`h-11 rounded-xl ${isCompleted ? 'border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800' : 'border-slate-200 bg-slate-100'}`}
                                          {...field}
                                          placeholder="https://fathom.video/share/..."
                                          data-testid="input-fathom-link-update"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {/* Tabs per Riassunto */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <FileText className={`w-4 h-4 ${isCompleted ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400'}`} />
                                    <span className={`text-sm font-medium ${isCompleted ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400'}`}>
                                      Riassunto Consulenza
                                    </span>
                                    {hasTranscript && <CheckCircle className="w-3 h-3 text-green-500" />}
                                  </div>
                                  
                                  {isCompleted && (
                                    <>
                                      {/* Tab Selector */}
                                      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                        <button
                                          type="button"
                                          onClick={() => setTranscriptMode('fathom')}
                                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            transcriptMode === 'fathom' 
                                              ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm' 
                                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                          }`}
                                        >
                                          <span className="flex items-center gap-2 justify-center">
                                            <Sparkles className="w-4 h-4" />
                                            Da Fathom
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setTranscriptMode('full')}
                                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            transcriptMode === 'full' 
                                              ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm' 
                                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                                          }`}
                                        >
                                          <span className="flex items-center gap-2 justify-center">
                                            <Wand2 className="w-4 h-4" />
                                            Da Trascrizione Completa
                                          </span>
                                        </button>
                                      </div>

                                      {/* Tab Content */}
                                      {transcriptMode === 'fathom' ? (
                                        <FormField
                                          control={updateForm.control}
                                          name="transcript"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Textarea
                                                  className="min-h-[150px] rounded-xl resize-y text-sm border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800"
                                                  rows={8}
                                                  {...field}
                                                  placeholder="Incolla qui il riassunto bullet-point da Fathom...&#10;&#10;• Punto chiave 1&#10;• Punto chiave 2&#10;• Action items&#10;• Insights AI"
                                                />
                                              </FormControl>
                                              <p className="text-xs text-purple-500 mt-1">
                                                Incolla il riassunto già formattato da Fathom (bullet points, action items, note)
                                              </p>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      ) : (
                                        <div className="space-y-3">
                                          <Textarea
                                            className="min-h-[150px] rounded-xl resize-y text-sm border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800"
                                            rows={8}
                                            value={fullTranscript}
                                            onChange={(e) => setFullTranscript(e.target.value)}
                                            placeholder="Incolla qui la trascrizione completa della chiamata...&#10;&#10;L'AI genererà automaticamente un riassunto bullet-point."
                                          />
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs text-purple-500">
                                              La trascrizione NON viene salvata - solo il riassunto generato
                                            </p>
                                            <Button
                                              type="button"
                                              size="sm"
                                              disabled={!fullTranscript.trim() || isGeneratingSummary}
                                              onClick={async () => {
                                                if (!fullTranscript.trim()) return;
                                                setIsGeneratingSummary(true);
                                                try {
                                                  const response = await fetch('/api/echo/generate-summary-from-transcript', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({
                                                      fullTranscript: fullTranscript,
                                                      clientName: currentAppointment?.client?.firstName + ' ' + currentAppointment?.client?.lastName
                                                    })
                                                  });
                                                  if (!response.ok) throw new Error('Errore nella generazione');
                                                  const data = await response.json();
                                                  updateForm.setValue('transcript', data.summary);
                                                  setTranscriptMode('fathom');
                                                  setFullTranscript('');
                                                  toast({
                                                    title: "✅ Riassunto Generato",
                                                    description: "Il riassunto è stato creato dall'AI e inserito nel campo",
                                                  });
                                                } catch (error) {
                                                  toast({
                                                    title: "❌ Errore",
                                                    description: "Impossibile generare il riassunto",
                                                    variant: "destructive",
                                                  });
                                                } finally {
                                                  setIsGeneratingSummary(false);
                                                }
                                              }}
                                              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg"
                                            >
                                              {isGeneratingSummary ? (
                                                <>
                                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                  Generazione...
                                                </>
                                              ) : (
                                                <>
                                                  <Wand2 className="w-4 h-4 mr-2" />
                                                  Genera Riassunto AI
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {!isCompleted && (
                                    <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-xl text-center">
                                      <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Completa prima la consulenza per aggiungere il riassunto
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Task Manager - Solo per consulenze con cliente */}
                            {currentUser?.id && currentAppointment?.clientId && (
                              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-700">
                                <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-2 mb-2">
                                  <ListTodo className="w-5 h-5" />
                                  Task del Cliente
                                </h3>
                                <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-4">
                                  Crea task da assegnare al cliente come follow-up di questa consulenza
                                </p>
                                <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
                                  <ConsultationTasksManager
                                    clientId={currentAppointment.clientId}
                                    consultantId={currentUser.id}
                                    consultationId={editingAppointment}
                                    readonly={false}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingAppointment(null)}
                                className="px-6 py-2.5 rounded-xl border-2 border-slate-300 hover:border-slate-400 font-medium"
                              >
                                Annulla
                              </Button>
                              <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                              >
                                {updateMutation.isPending ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                    Salvataggio...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salva Modifiche
                                  </>
                                )}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* Dialog per completamento consulenza */}
              <Dialog open={!!completingAppointment} onOpenChange={() => setCompletingAppointment(null)}>
                <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-0 shadow-3xl rounded-3xl">
                  <DialogHeader className="space-y-4 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                          Completa Consulenza
                        </DialogTitle>
                        <p className="text-slate-600 dark:text-slate-400">Segna come completata e imposta promemoria</p>
                      </div>
                    </div>
                  </DialogHeader>

                  <Form {...completionForm}>
                    <form onSubmit={completionForm.handleSubmit(onCompleteSubmit)} className="space-y-6">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                          <ClipboardCheck className="w-5 h-5" />
                          Promemoria Post-Consulenza
                        </h3>

                        <div className="space-y-4">
                          <FormField
                            control={completionForm.control}
                            name="needsResearch"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-1"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    Fare ricerca approfondita sulla consulenza
                                  </FormLabel>
                                  <p className="text-sm text-blue-600 dark:text-blue-300">
                                    Ricorda di approfondire argomenti specifici emersi durante la sessione
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={completionForm.control}
                            name="needsExercise"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="mt-1"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" />
                                    Creare esercizio personalizzato per il cliente
                                  </FormLabel>
                                  <p className="text-sm text-blue-600 dark:text-blue-300">
                                    Sviluppa un esercizio specifico basato sui bisogni identificati
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={completionForm.control}
                        name="completionNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              Note di completamento (opzionale)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[100px] rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 bg-slate-50 dark:bg-slate-800 resize-none"
                                rows={4}
                                {...field}
                                placeholder="Aggiungi note specifiche sul completamento della consulenza..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={completionForm.control}
                        name="fathomShareLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                              Link Registrazione Fathom (opzionale)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-purple-500 bg-slate-50 dark:bg-slate-800"
                                {...field}
                                placeholder="https://fathom.video/share/..."
                                data-testid="input-fathom-link-completion"
                              />
                            </FormControl>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Aggiungi il link alla registrazione Fathom per permettere al cliente di rivedere la consulenza
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={completionForm.control}
                        name="transcript"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              Trascrizione Fathom (opzionale)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[150px] rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-purple-500 bg-slate-50 dark:bg-slate-800 resize-y font-mono text-sm"
                                rows={8}
                                {...field}
                                placeholder="Incolla qui la trascrizione completa della consulenza da Fathom...&#10;&#10;Puoi includere: &#10;- Testo della conversazione&#10;- Note chiave&#10;- Action items&#10;- Insights AI"
                              />
                            </FormControl>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              La trascrizione sarà utilizzata dall'AI per dare risposte personalizzate al cliente
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Gestione Task collegate alla consulenza */}
                      {(() => {
                        const currentAppointment = (appointments as any[]).find(apt => apt.id === completingAppointment);
                        return currentAppointment && currentUser?.id ? (
                          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                            <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2">
                              <ListTodo className="w-5 h-5" />
                              Task per questa Consulenza
                            </h3>
                            <p className="text-sm text-indigo-600 dark:text-indigo-300 mb-4">
                              Crea task specifiche collegate a questa consulenza per il cliente
                            </p>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                              <ConsultationTasksManager
                                clientId={currentAppointment.clientId}
                                consultantId={currentUser.id}
                                readonly={false}
                              />
                            </div>
                          </div>
                        ) : null;
                      })()}

                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-6 rounded-2xl border border-purple-200 dark:border-purple-800">
                        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                          <ListTodo className="w-5 h-5" />
                          Task Automatiche
                        </h3>

                        <FormField
                          control={completionForm.control}
                          name="createFollowUpTask"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="mt-1"
                                  data-testid="checkbox-create-followup-task"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-base font-medium text-purple-800 dark:text-purple-200 flex items-center gap-2">
                                  <Star className="w-4 h-4" />
                                  Crea task di follow-up automatica
                                </FormLabel>
                                <p className="text-sm text-purple-600 dark:text-purple-300">
                                  Crea automaticamente una task di follow-up programmata tra 3 giorni per verificare i progressi del cliente
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCompletingAppointment(null)}
                          className="px-8 py-3 rounded-xl border-2 border-slate-300 hover:border-slate-400 font-semibold"
                        >
                          Annulla
                        </Button>
                        <Button
                          type="submit"
                          disabled={completeMutation.isPending}
                          className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold"
                        >
                          {completeMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                              Completamento...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Completa Consulenza
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Dialog per generazione email riepilogo */}
              <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-0 shadow-3xl rounded-3xl">
                  <DialogHeader className="space-y-4 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl">
                        <span className="text-3xl">📧</span>
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white">
                          Genera Email Riepilogo Consulenza
                        </DialogTitle>
                        <p className="text-slate-600 dark:text-slate-400">
                          Vuoi generare un'email di riepilogo AI per questa consulenza? Verrà creata come bozza da rivedere prima dell'invio.
                        </p>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div>
                      <label className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4" />
                        Appunti Aggiuntivi (opzionale)
                      </label>
                      <Textarea
                        className="min-h-[120px] rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 bg-slate-50 dark:bg-slate-800 resize-none"
                        rows={5}
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder="Aggiungi note extra per l'AI (opzionale)..."
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        Questi appunti saranno usati dall'AI solo per generare l'email, non verranno salvati
                      </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEmailDialogOpen(false);
                          setAdditionalNotes("");
                          setJustCompletedConsultationId(null);
                        }}
                        className="px-8 py-3 rounded-xl border-2 border-slate-300 hover:border-slate-400 font-semibold"
                        disabled={generateEmailMutation.isPending}
                      >
                        Salta
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (justCompletedConsultationId) {
                            generateEmailMutation.mutate({
                              consultationId: justCompletedConsultationId,
                              additionalNotes: additionalNotes || undefined,
                            });
                          }
                        }}
                        disabled={generateEmailMutation.isPending}
                        className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-semibold"
                      >
                        {generateEmailMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Generazione...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Genera Bozza
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Tabs Premium - Main navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <TabsList className="grid w-full max-w-2xl grid-cols-4 p-1 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border-0">
                <TabsTrigger 
                  value="calendar" 
                  className="flex items-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Mese
                </TabsTrigger>
                <TabsTrigger 
                  value="week" 
                  className="flex items-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <Calendar className="w-4 h-4" />
                  Settimana
                </TabsTrigger>
                <TabsTrigger 
                  value="list" 
                  className="flex items-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <List className="w-4 h-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger 
                  value="echo" 
                  className="flex items-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                >
                  <Mail className="w-4 h-4" />
                  Echo
                </TabsTrigger>
              </TabsList>
              
              {/* Month/Week toggle reminder - visible at top */}
              {(activeTab === "calendar" || activeTab === "week") && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Vista: {activeTab === "calendar" ? "Mensile" : "Settimanale"}
                  </span>
                </div>
              )}
            </div>

            {/* Vista Calendario Premium */}
            <TabsContent value="calendar" className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 h-[700px]">
                {/* Calendario principale */}
                <div className="xl:col-span-3">
                  <PremiumCalendarView 
                    appointments={appointments as any[]}
                    onDateClick={handleDateClick}
                    selectedDate={selectedDate}
                  />
                </div>

                {/* Pannello laterale premium */}
                <div className="space-y-6">
                  <Card className="bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold">
                            {format(selectedDate, "dd MMMM yyyy", { locale: it })}
                          </CardTitle>
                          <p className="text-indigo-100 text-sm">Consulenze programmate</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {appointmentsForSelectedDate.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-blue-500" />
                          </div>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Giornata libera</h3>
                          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Nessun appuntamento programmato</p>
                          <Button 
                            size="sm" 
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl px-6 py-2"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Aggiungi Appuntamento
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {appointmentsForSelectedDate.map((appointment: any) => (
                            <div 
                              key={appointment.id}
                              className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900 hover:shadow-lg transition-all duration-300"
                              data-testid={`appointment-${appointment.id}`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                                    {appointment.client.firstName} {appointment.client.lastName}
                                  </p>
                                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    <Clock className="w-4 h-4" />
                                    {format(new Date(appointment.scheduledAt), "HH:mm")} • {appointment.duration} min
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {appointment.status === "scheduled" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleComplete(appointment)}
                                      className="rounded-lg border-green-300 hover:bg-green-50 hover:text-green-700 text-green-600"
                                      data-testid={`button-complete-${appointment.id}`}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('Edit button clicked for:', appointment.id);
                                      handleEdit(appointment);
                                    }}
                                    className="rounded-lg border-slate-300 hover:bg-blue-50"
                                    data-testid={`button-edit-${appointment.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('Delete button clicked for:', appointment.id);
                                      handleDelete(appointment.id);
                                    }}
                                    className="rounded-lg border-slate-300 hover:bg-red-50 hover:text-red-600"
                                    data-testid={`button-delete-${appointment.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              {getStatusBadge(appointment.status)}
                              {appointment.notes && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{appointment.notes}</p>
                                </div>
                              )}
                              {appointment.summaryEmail && (
                                <div className="mt-3">
                                  <details className="group">
                                    <summary className="cursor-pointer list-none p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Mail className="w-4 h-4 text-purple-600" />
                                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                            📧 Email Riepilogo Generata
                                          </span>
                                        </div>
                                        <svg className="w-5 h-5 text-purple-600 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
                                        Generata il {appointment.summaryEmailGeneratedAt ? format(new Date(appointment.summaryEmailGeneratedAt), "dd MMM yyyy 'alle' HH:mm", { locale: it }) : 'N/A'}
                                      </p>
                                    </summary>
                                    <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700 overflow-hidden shadow-lg">
                                      <div className="max-h-[600px] overflow-y-auto">
                                        <div 
                                          className="prose prose-sm max-w-none p-4"
                                          dangerouslySetInnerHTML={{ __html: appointment.summaryEmail }}
                                        />
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Vista Settimanale con Timeline Oraria */}
            <TabsContent value="week" className="space-y-8">
              <WeeklyCalendarView 
                appointments={appointments as any[]}
                onDateClick={handleDateClick}
                selectedDate={selectedDate}
                onAppointmentSelect={setSelectedWeekAppointment}
                selectedAppointment={selectedWeekAppointment}
                onEdit={handleEdit}
                onComplete={handleComplete}
                onGenerateEmail={(apt) => {
                  setJustCompletedConsultationId(apt.id);
                  setIsEmailDialogOpen(true);
                }}
              />
            </TabsContent>

            {/* Vista Lista Compatta con Timeline */}
            <TabsContent value="list" className="space-y-6">
              {/* Filtri Rapidi */}
              <div className="flex flex-wrap gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <Button
                  variant={listFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('all')}
                  className={`rounded-full ${listFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  <List className="w-4 h-4 mr-2" />
                  Tutti ({filterStats.all})
                </Button>
                <Button
                  variant={listFilter === 'need_data' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('need_data')}
                  className={`rounded-full ${listFilter === 'need_data' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Da Completare ({filterStats.need_data})
                </Button>
                <Button
                  variant={listFilter === 'ready_email' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('ready_email')}
                  className={`rounded-full ${listFilter === 'ready_email' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-300 text-purple-700 hover:bg-purple-50'}`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Pronte Email ({filterStats.ready_email})
                </Button>
                <Button
                  variant={listFilter === 'email_sent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListFilter('email_sent')}
                  className={`rounded-full ${listFilter === 'email_sent' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Inviate ({filterStats.email_sent})
                </Button>
              </div>

              {filteredListAppointments.length === 0 ? (
                <Card className="bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardContent className="p-16 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      {listFilter === 'all' ? <Calendar className="w-12 h-12 text-blue-500" /> :
                       listFilter === 'need_data' ? <AlertCircle className="w-12 h-12 text-amber-500" /> :
                       listFilter === 'ready_email' ? <Mail className="w-12 h-12 text-purple-500" /> :
                       <CheckCircle className="w-12 h-12 text-green-500" />}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
                      {listFilter === 'all' ? 'Nessun appuntamento' :
                       listFilter === 'need_data' ? 'Tutto a posto!' :
                       listFilter === 'ready_email' ? 'Nessuna email da generare' :
                       'Nessuna email inviata'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-lg mb-6">
                      {listFilter === 'all' ? 'Crea il tuo primo appuntamento per iniziare.' :
                       listFilter === 'need_data' ? 'Tutte le consulenze completate hanno già il riassunto.' :
                       listFilter === 'ready_email' ? 'Completa prima i riassunti delle consulenze.' :
                       'Genera e invia le email riepilogo ai tuoi clienti.'}
                    </p>
                    {listFilter === 'all' && (
                      <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-2xl shadow-xl"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Crea Appuntamento
                      </Button>
                    )}
                    {listFilter !== 'all' && (
                      <Button
                        variant="outline"
                        onClick={() => setListFilter('all')}
                        className="rounded-xl"
                      >
                        Mostra tutti gli appuntamenti
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredListAppointments.map((appointment: any) => {
                    const progress = getAppointmentProgress(appointment);
                    
                    return (
                      <Card 
                        key={appointment.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300"
                        data-testid={`card-appointment-${appointment.id}`}
                      >
                        <CardContent className="p-5">
                          {/* Header con info cliente e badge */}
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${
                                progress.isCompleted 
                                  ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                                  : appointment.status === 'cancelled'
                                  ? 'bg-gradient-to-br from-rose-500 to-red-600'
                                  : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                              }`}>
                                <User className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 truncate">
                                  {appointment.client.firstName} {appointment.client.lastName}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                  <Calendar className="w-4 h-4" />
                                  <span>{format(new Date(appointment.scheduledAt), "EEEE d MMMM yyyy", { locale: it })}</span>
                                  <span className="text-slate-400">•</span>
                                  <Clock className="w-4 h-4" />
                                  <span>{format(new Date(appointment.scheduledAt), "HH:mm")}</span>
                                  <span className="text-slate-400">•</span>
                                  <span>{appointment.duration} min</span>
                                </div>
                              </div>
                            </div>
                            <Badge className={`${
                              progress.isCompleted 
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                : appointment.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200'
                            } border px-3 py-1`}>
                              {progress.isCompleted ? 'Completata' : 
                               appointment.status === 'cancelled' ? 'Cancellata' : 'Programmata'}
                            </Badge>
                          </div>

                          {/* Indicatori di progresso */}
                          <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${progress.hasGoogleMeet ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${progress.hasGoogleMeet ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Link Call
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${progress.isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${progress.isCompleted ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Completata
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${progress.hasFathomLink ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${progress.hasFathomLink ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Registrazione
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${progress.hasTranscript ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${progress.hasTranscript ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                              Riassunto
                            </div>
                          </div>

                          {/* Stato Email e Azioni Contestuali */}
                          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            {/* Stato email */}
                            <div className="flex-1">
                              {progress.isCompleted && (
                                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                                  progress.emailStatus === 'sent' || progress.emailStatus === 'approved' || progress.emailStatus === 'saved_for_ai'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : progress.hasTranscript
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {progress.emailStatus === 'sent' || progress.emailStatus === 'approved' ? (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Email inviata
                                    </>
                                  ) : progress.emailStatus === 'saved_for_ai' ? (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Salvata per AI
                                    </>
                                  ) : progress.emailStatus === 'draft' ? (
                                    <>
                                      <FileText className="w-4 h-4" />
                                      Bozza pronta - Vai a ECHO
                                    </>
                                  ) : progress.hasTranscript ? (
                                    <>
                                      <Mail className="w-4 h-4" />
                                      Pronta per generare email
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="w-4 h-4" />
                                      Manca riassunto
                                    </>
                                  )}
                                </div>
                              )}
                              {appointment.status === 'scheduled' && (
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-blue-50 text-blue-700 border border-blue-200">
                                  <CalendarDays className="w-4 h-4" />
                                  In attesa della call
                                </div>
                              )}
                            </div>

                            {/* Azioni */}
                            <div className="flex gap-2 flex-shrink-0">
                              {/* Pulsante Completa */}
                              {appointment.status === "scheduled" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleComplete(appointment)}
                                  className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                                  data-testid={`button-complete-${appointment.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Completa
                                </Button>
                              )}
                              
                              {/* Pulsante Aggiungi Riassunto */}
                              {progress.isCompleted && !progress.hasTranscript && (
                                <Button
                                  size="sm"
                                  onClick={() => handleEdit(appointment)}
                                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Aggiungi Riassunto
                                </Button>
                              )}
                              
                              {/* Pulsante Genera Email */}
                              {progress.isCompleted && progress.hasTranscript && 
                               (progress.emailStatus === 'missing' || !progress.emailStatus) && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setJustCompletedConsultationId(appointment.id);
                                    setIsEmailDialogOpen(true);
                                  }}
                                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Genera Email
                                </Button>
                              )}
                              
                              {/* Pulsante Vai a ECHO */}
                              {progress.emailStatus === 'draft' && (
                                <Button
                                  size="sm"
                                  onClick={() => window.location.href = '/consultant/echo'}
                                  className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                  <Send className="w-4 h-4 mr-2" />
                                  Vai a ECHO
                                </Button>
                              )}
                              
                              {/* Pulsante Modifica */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(appointment)}
                                className="rounded-xl border-slate-300 hover:bg-blue-50"
                                data-testid={`button-edit-${appointment.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              
                              {/* Pulsante Elimina */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(appointment.id)}
                                className="rounded-xl border-slate-300 hover:bg-red-50 hover:text-red-600"
                                data-testid={`button-delete-${appointment.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Vista Echo Dashboard */}
            <TabsContent value="echo" className="space-y-8">
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">Echo Dashboard</CardTitle>
                      <p className="text-orange-100 text-sm">Gestisci le email di riepilogo delle consulenze</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <EchoDashboardPanel />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}