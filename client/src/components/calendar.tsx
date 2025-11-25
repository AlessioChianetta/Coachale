import { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MomentumCheckin {
  id: string;
  userId: string;
  timestamp: string;
  activityDescription: string;
  isProductive: boolean;
  category?: string;
  mood?: number;
  energy?: number;
  notes?: string;
}

interface CalendarProps {
  onEventClick?: (event: CalendarEvent | any) => void;
  onDateSelect?: (start: Date, end: Date, allDay: boolean) => void;
}

export default function Calendar({ onEventClick, onDateSelect }: CalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('timeGridWeek');
  const [showCheckins, setShowCheckins] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendar-show-checkins');
    return saved !== null ? saved === 'true' : true;
  });
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar/events'],
  });

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery<MomentumCheckin[]>({
    queryKey: ['/api/momentum/checkins', { limit: 100 }],
    queryFn: async () => {
      const response = await fetch('/api/momentum/checkins?limit=100', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch check-ins');
      }
      return response.json();
    },
  });

  useEffect(() => {
    localStorage.setItem('calendar-show-checkins', String(showCheckins));
  }, [showCheckins]);

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) => {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
  });

  const normalEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: new Date(event.start),
    end: new Date(event.end),
    allDay: event.allDay,
    backgroundColor: event.color || '#039be5',
    borderColor: event.color || '#039be5',
    extendedProps: {
      type: 'event',
      description: event.description,
    },
  }));

  const checkinEvents = checkins.map(checkin => ({
    id: `checkin-${checkin.id}`,
    title: `${checkin.isProductive ? '✅' : '☕'} ${checkin.activityDescription}`,
    start: new Date(checkin.timestamp),
    end: new Date(new Date(checkin.timestamp).getTime() + 30 * 60000),
    allDay: false,
    backgroundColor: checkin.isProductive ? '#0b8043' : '#f6bf26',
    borderColor: checkin.isProductive ? '#0b8043' : '#f6bf26',
    editable: false,
    extendedProps: {
      type: 'checkin',
      isProductive: checkin.isProductive,
      category: checkin.category,
      mood: checkin.mood,
      energy: checkin.energy,
      notes: checkin.notes,
      timestamp: checkin.timestamp,
      activityDescription: checkin.activityDescription,
    },
    classNames: ['checkin-event'],
  }));

  const fullCalendarEvents = showCheckins 
    ? [...normalEvents, ...checkinEvents] 
    : normalEvents;

  const handleEventClick = (info: EventClickArg) => {
    if (info.event.extendedProps.type === 'checkin') {
      if (onEventClick) {
        onEventClick(info.event.extendedProps);
      }
    } else {
      const event = events.find(e => e.id === info.event.id);
      if (event && onEventClick) {
        onEventClick(event);
      }
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(selectInfo.start, selectInfo.end, selectInfo.allDay);
    }
  };

  const handleEventDrop = (info: EventDropArg) => {
    if (info.event.extendedProps.type === 'checkin') {
      info.revert();
      return;
    }

    if (!info.event.start || !info.event.end) return;

    updateEventMutation.mutate({
      id: info.event.id,
      updates: {
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay,
      },
    }, {
      onError: () => {
        info.revert();
      },
    });
  };

  const handleEventResize = (info: EventResizeDoneArg) => {
    if (info.event.extendedProps.type === 'checkin') {
      info.revert();
      return;
    }

    if (!info.event.start || !info.event.end) return;

    updateEventMutation.mutate({
      id: info.event.id,
      updates: {
        start: info.event.start,
        end: info.event.end,
      },
    }, {
      onError: () => {
        info.revert();
      },
    });
  };

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  const handleViewChange = (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  };

  const getTitle = () => {
    return calendarRef.current?.getApi().view.title || '';
  };

  const [title, setTitle] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTitle(getTitle());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || checkinsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const toggleShowCheckins = () => {
    setShowCheckins(!showCheckins);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1f1f1f] p-4 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="h-10 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleToday}
            className="px-4 h-10 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Oggi
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-10 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="ml-4 flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-[#5f6368]" />
            <h2 className="text-xl font-normal text-[#3c4043] dark:text-[#e8eaed]" style={{ fontFamily: "'Product Sans', 'Google Sans', 'Roboto', sans-serif" }}>
              {title}
            </h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant={showCheckins ? 'default' : 'ghost'}
            onClick={toggleShowCheckins}
            size="sm"
            className={cn(
              "px-3 sm:px-4 h-9 font-medium transition-all whitespace-nowrap",
              showCheckins 
                ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc] dark:bg-[#1a73e8] dark:text-white" 
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <Activity className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline ml-2">Check-ins</span>
          </Button>
          
          <div className="flex items-center gap-1 flex-1 sm:flex-initial">
            <Button
              variant={currentView === 'dayGridMonth' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('dayGridMonth')}
              size="sm"
              className={cn(
                "px-2 sm:px-4 h-9 font-medium transition-all flex-1 sm:flex-initial whitespace-nowrap text-xs sm:text-sm",
                currentView === 'dayGridMonth' 
                  ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc] dark:bg-[#1a73e8] dark:text-white" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              Mese
            </Button>
            <Button
              variant={currentView === 'timeGridWeek' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('timeGridWeek')}
              size="sm"
              className={cn(
                "px-2 sm:px-4 h-9 font-medium transition-all flex-1 sm:flex-initial whitespace-nowrap text-xs sm:text-sm",
                currentView === 'timeGridWeek' 
                  ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc] dark:bg-[#1a73e8] dark:text-white" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              Settimana
            </Button>
            <Button
              variant={currentView === 'timeGridDay' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('timeGridDay')}
              size="sm"
              className={cn(
                "px-2 sm:px-4 h-9 font-medium transition-all flex-1 sm:flex-initial whitespace-nowrap text-xs sm:text-sm",
                currentView === 'timeGridDay' 
                  ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc] dark:bg-[#1a73e8] dark:text-white" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              Giorno
            </Button>
          </div>
        </div>
      </div>

      <div className={cn(
        "bg-white dark:bg-[#1f1f1f] rounded-lg border border-[#dadce0] dark:border-[#3c4043] overflow-hidden shadow-sm",
        "calendar-container"
      )} style={{ scrollBehavior: 'smooth', maxHeight: 'calc(100vh - 200px)' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          headerToolbar={false}
          height="calc(100vh - 220px)"
          events={fullCalendarEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          locale="it"
          buttonText={{
            today: 'Oggi',
            month: 'Mese',
            week: 'Settimana',
            day: 'Giorno',
          }}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={true}
          nowIndicator={true}
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          scrollTime="08:00:00"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600&display=swap');

        .calendar-container .fc {
          --fc-border-color: #e0e0e0;
          --fc-button-bg-color: #1a73e8;
          --fc-button-border-color: #1a73e8;
          --fc-button-hover-bg-color: #1765cc;
          --fc-button-hover-border-color: #1765cc;
          --fc-button-active-bg-color: #1557b0;
          --fc-button-active-border-color: #1557b0;
          --fc-today-bg-color: rgba(232, 240, 254, 0.3);
          font-family: 'Product Sans', 'Google Sans', 'Roboto', sans-serif;
        }
        
        .dark .calendar-container .fc {
          --fc-border-color: #3c4043;
          --fc-page-bg-color: #1f1f1f;
          --fc-neutral-bg-color: #2d2e30;
          --fc-today-bg-color: rgba(138, 180, 248, 0.15);
        }

        .calendar-container .fc-theme-standard td,
        .calendar-container .fc-theme-standard th {
          border-color: var(--fc-border-color);
          border-width: 1px;
        }

        .calendar-container .fc-scrollgrid {
          border-color: var(--fc-border-color);
          border-width: 1px;
          border-radius: 8px;
          overflow: hidden;
        }

        .calendar-container .fc-daygrid-day-number {
          color: #3c4043;
          padding: 8px;
          font-weight: 400;
          font-size: 12px;
          text-align: center;
        }

        .dark .calendar-container .fc-daygrid-day-number {
          color: #e8eaed;
        }

        .calendar-container .fc-daygrid-day-top {
          display: flex;
          justify-content: flex-end;
          padding: 4px;
        }

        .calendar-container .fc-col-header-cell {
          background: #ffffff;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.8px;
          color: #70757a;
          padding: 16px 0 8px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .dark .calendar-container .fc-col-header-cell {
          background: #1f1f1f;
          color: #9aa0a6;
          border-bottom: 1px solid #3c4043;
        }

        .calendar-container .fc-col-header-cell-cushion {
          padding: 0;
          display: block;
          text-decoration: none !important;
          font-size: 11px;
          font-weight: 500;
        }

        /* Stile Google Calendar per l'header del giorno corrente */
        .calendar-container .fc-day-today .fc-col-header-cell {
          position: relative;
        }

        .calendar-container .fc-day-today .fc-daygrid-day-number,
        .calendar-container .fc-day-today .fc-col-header-cell-cushion {
          color: #1a73e8 !important;
          font-weight: 600;
        }

        /* Cerchio blu per il numero del giorno corrente */
        .calendar-container .fc-day-today .fc-daygrid-day-top {
          justify-content: center;
        }

        .calendar-container .fc-day-today .fc-daygrid-day-number {
          background-color: #1a73e8;
          color: white !important;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4px auto 0;
          font-weight: 500;
        }

        .calendar-container .fc-timegrid-slot-label {
          color: #70757a;
          font-size: 11px;
          text-align: right;
          padding-right: 12px;
          vertical-align: top;
          padding-top: 0;
          font-weight: 400;
        }

        .dark .calendar-container .fc-timegrid-slot-label {
          color: #9aa0a6;
        }

        .calendar-container .fc-event {
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          border: none !important;
          font-weight: 500;
          transition: all 150ms ease;
          box-shadow: none;
          position: relative;
          overflow: hidden;
        }

        .calendar-container .fc-event:hover {
          filter: brightness(0.95);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .calendar-container .fc-event:active {
          cursor: grabbing;
          transform: scale(0.98);
        }

        /* Eventi all-day stile Google Calendar */
        .calendar-container .fc-daygrid-event {
          margin: 1px 2px;
          white-space: nowrap;
          border-left: 3px solid rgba(0,0,0,0.15) !important;
        }

        .calendar-container .fc-daygrid-event-harness {
          margin-top: 2px;
          margin-bottom: 2px;
        }

        /* All day slot */
        .calendar-container .fc-timegrid-divider {
          padding: 0 !important;
        }

        .calendar-container .fc-timegrid-slot-label {
          font-size: 10px;
          color: #70757a;
        }

        .calendar-container .fc-h-event {
          border: none;
        }

        .calendar-container .fc-timegrid-slot {
          height: 60px;
          border-bottom: 1px solid #f1f3f4;
          transition: background-color 150ms ease;
        }

        .calendar-container .fc-timegrid-slot:hover {
          background-color: rgba(0,0,0,0.01);
        }

        .dark .calendar-container .fc-timegrid-slot {
          border-bottom: 1px solid #3c4043;
        }

        .dark .calendar-container .fc-timegrid-slot:hover {
          background-color: rgba(255,255,255,0.02);
        }

        .calendar-container .fc-timegrid-slot-minor {
          border-top-style: dotted;
          border-color: #f1f3f4;
        }

        .dark .calendar-container .fc-timegrid-slot-minor {
          border-color: #3c4043;
        }

        .calendar-container .fc-timegrid-event {
          border-radius: 8px;
          border: none !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
          margin: 2px 3px !important;
          transition: all 200ms ease;
        }

        .calendar-container .fc-timegrid-event:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1);
          transform: translateY(-1px);
        }

        .calendar-container .fc-timegrid-event .fc-event-main {
          padding: 8px 10px;
        }

        .calendar-container .fc-timegrid-event .fc-event-time {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 3px;
          opacity: 0.95;
          letter-spacing: 0.2px;
        }

        .calendar-container .fc-timegrid-event .fc-event-title {
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .calendar-container .fc-timegrid-now-indicator-line {
          border-color: #ea4335;
          border-width: 2px;
          box-shadow: 0 0 8px rgba(234, 67, 53, 0.3);
          animation: pulse-line 2s ease-in-out infinite;
        }

        @keyframes pulse-line {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 8px rgba(234, 67, 53, 0.3);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 12px rgba(234, 67, 53, 0.5);
          }
        }

        .calendar-container .fc-timegrid-now-indicator-arrow {
          border-color: #ea4335;
          border-top-color: #ea4335;
          filter: drop-shadow(0 0 4px rgba(234, 67, 53, 0.4));
        }

        .calendar-container .fc-day-today {
          background-color: rgba(232, 240, 254, 0.2) !important;
          position: relative;
        }

        .dark .calendar-container .fc-day-today {
          background-color: rgba(138, 180, 248, 0.08) !important;
        }

        .calendar-container .fc-timegrid-axis {
          border-right: 1px solid var(--fc-border-color);
        }

        .calendar-container .fc-scrollgrid-sync-inner {
          padding: 4px 0;
        }

        .calendar-container .fc-timegrid-axis-cushion {
          font-size: 11px;
          color: #70757a;
          text-transform: uppercase;
          padding-right: 8px;
        }

        .dark .calendar-container .fc-timegrid-axis-cushion {
          color: #9aa0a6;
        }

        .calendar-container .fc-timegrid-event.fc-event-start,
        .calendar-container .fc-timegrid-event.fc-event-end {
          border-radius: 4px;
        }

        .calendar-container .fc-daygrid-day-frame {
          min-height: 100px;
          padding: 4px;
        }

        .calendar-container .fc-timegrid-divider {
          padding: 0;
          background-color: #f8f9fa;
        }

        .dark .calendar-container .fc-timegrid-divider {
          background-color: #2d2e30;
        }

        /* Righe all-day più compatte */
        .calendar-container .fc-daygrid-body {
          max-height: 60px !important;
          overflow-y: auto;
        }

        .calendar-container .fc-daygrid-day-frame {
          min-height: 40px !important;
          padding: 2px !important;
        }

        .calendar-container .fc-daygrid-event {
          margin: 1px 1px !important;
          padding: 1px 4px !important;
          font-size: 11px !important;
          line-height: 1.2;
        }

        .calendar-container .fc-daygrid-event-harness {
          margin-top: 1px !important;
          margin-bottom: 1px !important;
        }

        .calendar-container .fc-col-header-cell {
          padding: 8px 0 4px 0 !important;
        }

        .calendar-container .fc-daygrid-body-unbalanced .fc-daygrid-day-events {
          min-height: 20px !important;
        }

        .calendar-container .fc-event-title {
          font-weight: 500;
        }

        .calendar-container .fc-event-time {
          font-weight: 400;
          opacity: 0.9;
        }

        .calendar-container .fc-view-harness {
          transition: opacity 200ms ease;
        }

        .calendar-container .fc-scroller {
          overflow-y: auto !important;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .calendar-container .fc-scroller::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }

        .calendar-container .fc-scroller::-webkit-scrollbar-track {
          background: #f8f9fa;
          border-radius: 6px;
          margin: 4px;
        }

        .dark .calendar-container .fc-scroller::-webkit-scrollbar-track {
          background: #2d2e30;
        }

        .calendar-container .fc-scroller::-webkit-scrollbar-thumb {
          background: #dadce0;
          border-radius: 6px;
          border: 3px solid #f8f9fa;
          transition: all 0.2s ease;
        }

        .dark .calendar-container .fc-scroller::-webkit-scrollbar-thumb {
          background: #5f6368;
          border-color: #2d2e30;
        }

        .calendar-container .fc-scroller::-webkit-scrollbar-thumb:hover {
          background: #1a73e8;
          border-color: #f8f9fa;
        }

        .dark .calendar-container .fc-scroller::-webkit-scrollbar-thumb:hover {
          background: #8ab4f8;
          border-color: #2d2e30;
        }

        .calendar-container .fc-scroller::-webkit-scrollbar-thumb:active {
          background: #1557b0;
        }

        .dark .calendar-container .fc-scroller::-webkit-scrollbar-thumb:active {
          background: #669df6;
        }

        .calendar-container .checkin-event {
          opacity: 0.9;
          border-left: 3px solid rgba(255,255,255,0.3) !important;
        }

        .calendar-container .checkin-event:hover {
          opacity: 1;
          transform: translateY(-1px) scale(1.01);
        }

        .calendar-container .checkin-event::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);
        }
      `}</style>
    </div>
  );
}
