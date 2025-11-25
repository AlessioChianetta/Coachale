import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import Sidebar from '@/components/sidebar';
import UnifiedClientHeader from '@/components/layout/UnifiedClientHeader';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import EventModal from '@/components/event-modal';
import { Button } from '@/components/ui/button';
import CheckinModal from '@/components/momentum/CheckinModal';
import GoalsManager from '@/components/momentum/GoalsManager';
import MomentumSettings from '@/components/momentum/MomentumSettings';
import DailyReflectionForm from '@/components/daily-reflection-form';
import { PageLoader } from '@/components/page-loader';

const Calendar = lazy(() => import('@/components/calendar'));
const MomentumDashboard = lazy(() => import('@/components/momentum/MomentumDashboard'));
const MomentumSidebar = lazy(() => import('@/components/layout/MomentumSidebar'));
import { useCheckinScheduler } from '@/hooks/use-checkin-scheduler';
import { useToast } from '@/hooks/use-toast';
import { Target, Settings, Plus, CheckSquare } from 'lucide-react';
import { driverConfig } from '@/lib/tour/driver-config';
import { calendarTourSteps } from '@/components/interactive-tour/calendar-tour-steps';

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

export default function ClientCalendar() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  
  // Momentum state
  const [activeTab, setActiveTab] = useState('agenda');
  const [momentumView, setMomentumView] = useState<'dashboard' | 'goals' | 'settings' | 'tasks'>('dashboard');
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  
  // Check-in scheduler hook
  const {
    showCheckinReminder,
    dismissReminder,
    snoozeReminder,
    nextCheckinTime,
  } = useCheckinScheduler();

  // Read tab from URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'momentum') {
      setActiveTab('momentum');
    }
  }, []);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleDateSelect = (start: Date, end: Date, allDay: boolean) => {
    setSelectedDate({ start, end, allDay });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleNewEvent = () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
    
    setSelectedDate({
      start: now,
      end: endTime,
      allDay: false,
    });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  // Track previous reminder state to avoid duplicates
  const previousReminderState = useRef(false);

  // Show check-in reminder toast only when transitioning to true
  useEffect(() => {
    if (showCheckinReminder && !previousReminderState.current) {
      toast({
        title: '⏰ Promemoria Check-in',
        description: 'È ora di registrare cosa stai facendo!',
        action: (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              setIsCheckinModalOpen(true);
              dismissReminder();
            }}>
              Registra
            </Button>
            <Button size="sm" variant="outline" onClick={() => snoozeReminder(15)}>
              Snooze 15min
            </Button>
          </div>
        ),
      });
    }
    previousReminderState.current = showCheckinReminder;
  }, [showCheckinReminder, toast, dismissReminder, snoozeReminder]);

  // Start Calendar Tour function
  const startCalendarTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => setIsTourActive(false),
    });
    driverObj.setSteps(calendarTourSteps);
    driverObj.drive();
  };

  // Get breadcrumb items based on current view
  const getBreadcrumbItems = (): Array<{ label: string; onClick?: () => void }> => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Home', onClick: () => setMomentumView('dashboard') },
      { label: 'Momentum', onClick: () => setMomentumView('dashboard') },
    ];

    if (momentumView === 'goals') {
      items.push({ label: 'Obiettivi' });
    } else if (momentumView === 'settings') {
      items.push({ label: 'Impostazioni' });
    } else if (momentumView === 'tasks') {
      items.push({ label: 'Tasks' });
    }

    return items;
  };

  // Framer Motion variants for tab animations
  const tabVariants = {
    agenda: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
      exit: { opacity: 0, transition: { duration: 0.2 } }
    },
    momentum: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
      exit: { opacity: 0, transition: { duration: 0.2 } }
    }
  };

  // Variants for momentum sub-views
  const momentumSubViewVariants = {
    dashboard: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
      exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
    },
    goals: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
      exit: { opacity: 0, x: 10, transition: { duration: 0.2 } }
    },
    settings: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
      exit: { opacity: 0, x: 10, transition: { duration: 0.2 } }
    },
    tasks: {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
      exit: { opacity: 0, x: 10, transition: { duration: 0.2 } }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-800">
      <Sidebar 
        role="client"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <UnifiedClientHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewEvent={handleNewEvent}
          onNewCheckin={() => setIsCheckinModalOpen(true)}
          onSettings={() => setMomentumView('settings')}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onStartTour={startCalendarTour}
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <div className="max-w-7xl mx-auto p-4 md:p-6">
              <AnimatePresence mode="wait">
                {/* Agenda View */}
                {activeTab === 'agenda' && (
                  <motion.div
                    key="agenda"
                    variants={tabVariants.agenda}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    <Suspense fallback={<PageLoader />}>
                      <Calendar
                        onEventClick={handleEventClick}
                        onDateSelect={handleDateSelect}
                        data-tour="calendar-view"
                      />
                    </Suspense>
                  </motion.div>
                )}

                {/* Momentum View */}
                {activeTab === 'momentum' && (
                  <motion.div
                    key="momentum"
                    variants={tabVariants.momentum}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                  >
                    {/* Breadcrumbs - Always visible */}
                    <Breadcrumbs items={getBreadcrumbItems()} />

                    {/* Content with consistent headers */}
                    <div className="mt-6">
                      <AnimatePresence mode="wait">
                        {momentumView === 'dashboard' && (
                          <motion.div
                            key="dashboard"
                            variants={momentumSubViewVariants.dashboard}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                          >
                            <Suspense fallback={<PageLoader />}>
                              <MomentumDashboard
                                onOpenCheckin={() => setIsCheckinModalOpen(true)}
                                onOpenCalendar={() => setMomentumView('dashboard')}
                                onOpenGoals={() => setMomentumView('goals')}
                                onOpenSettings={() => setMomentumView('settings')}
                                data-tour="momentum-dashboard"
                              />
                            </Suspense>
                          </motion.div>
                        )}

                        {momentumView === 'goals' && (
                          <motion.div
                            key="goals"
                            variants={momentumSubViewVariants.goals}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-6"
                          >
                            {/* Header for Goals */}
                            <div className="flex items-center justify-between" data-tour="momentum-goals-btn">
                              <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  <Target className="h-8 w-8 text-blue-600" />
                                  Obiettivi
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                  Gestisci i tuoi obiettivi e monitora il progresso
                                </p>
                              </div>
                            </div>
                            <GoalsManager data-tour="momentum-active-goals" />
                          </motion.div>
                        )}

                        {momentumView === 'settings' && (
                          <motion.div
                            key="settings"
                            variants={momentumSubViewVariants.settings}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-6"
                          >
                            {/* Header for Settings */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  <Settings className="h-8 w-8 text-blue-600" />
                                  Impostazioni
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                  Configura le tue preferenze Momentum
                                </p>
                              </div>
                            </div>
                            <MomentumSettings />
                          </motion.div>
                        )}

                        {momentumView === 'tasks' && (
                          <motion.div
                            key="tasks"
                            variants={momentumSubViewVariants.tasks}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-6"
                          >
                            {/* Header for Tasks */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  <CheckSquare className="h-8 w-8 text-blue-600" />
                                  Tasks & Riflessioni
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                  Gestisci i tuoi task giornalieri e riflessioni
                                </p>
                              </div>
                            </div>
                            <DailyReflectionForm
                              onSave={async (data) => {
                                try {
                                  const response = await fetch('/api/daily-reflections', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data),
                                  });
                                  if (response.ok) {
                                    toast({
                                      title: 'Riflessione salvata!',
                                      description: 'La tua riflessione giornaliera è stata salvata con successo.',
                                    });
                                  }
                                } catch (error) {
                                  toast({
                                    title: 'Errore',
                                    description: 'Si è verificato un errore durante il salvataggio.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

          {/* Momentum Sidebar - Only visible in Agenda tab */}
          {activeTab === 'agenda' && (
            <Suspense fallback={<div className="hidden md:flex w-80 border-l bg-gray-50 dark:bg-gray-800"><PageLoader /></div>}>
              <MomentumSidebar
                onOpenCheckin={() => setIsCheckinModalOpen(true)}
                onSwitchToMomentum={() => setActiveTab('momentum')}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        selectedDate={selectedDate}
      />

      {/* Check-in Modal */}
      <CheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        onSuccess={() => {
          toast({
            title: 'Check-in completato!',
            description: 'La tua attività è stata registrata.',
          });
        }}
      />
    </div>
  );
}
