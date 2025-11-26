import { useMomentumSnapshot } from '@/hooks/use-momentum-snapshot';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Menu, 
  Flame, 
  Activity, 
  TrendingUp, 
  CalendarDays, 
  Zap, 
  Plus, 
  Settings,
  Calendar as CalendarIcon,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedClientHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewEvent?: () => void;
  onNewCheckin?: () => void;
  onSettings?: () => void;
  onMenuClick?: () => void;
  onStartTour?: () => void;
}

export default function UnifiedClientHeader({
  activeTab,
  onTabChange,
  onNewEvent,
  onNewCheckin,
  onSettings,
  onMenuClick,
  onStartTour,
}: UnifiedClientHeaderProps) {
  const { streak, todayCheckins, productivityScore, isLoading } = useMomentumSnapshot();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
      <div className="container mx-auto px-4 py-3">
        {/* Mobile Layout */}
        <div className="lg:hidden space-y-4">
          {/* Top Row: Menu + Logo + Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onMenuClick && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onMenuClick}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-6 w-6 text-[#1a73e8]" />
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Calendar
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onStartTour && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onStartTour}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
                  title="Guida Interattiva"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              )}
              {onNewEvent && (
                <Button 
                  size="sm" 
                  onClick={onNewEvent}
                  data-tour="calendar-new-event-btn"
                  className="bg-[#1a73e8] hover:bg-[#1557b0] hover:brightness-105 text-white gap-1.5 transition-all duration-150 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Evento
                </Button>
              )}
              {onSettings && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onSettings}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Momentum Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div data-tour="momentum-streak">
              <MetricCard
                icon={Flame}
                value={streak}
                label="Streak"
                color="text-orange-600 dark:text-orange-400"
                bgColor="bg-orange-50 dark:bg-orange-900/20"
                isLoading={isLoading}
              />
            </div>
            <MetricCard
              icon={Activity}
              value={todayCheckins}
              label="Check-ins"
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/20"
              isLoading={isLoading}
            />
            <div data-tour="momentum-productivity-score">
              <MetricCard
                icon={TrendingUp}
                value={`${productivityScore}%`}
                label="Score"
                color="text-blue-600 dark:text-blue-400"
                bgColor="bg-blue-50 dark:bg-blue-900/20"
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <TabButton
              active={activeTab === 'agenda'}
              onClick={() => onTabChange('agenda')}
              icon={CalendarDays}
              data-tour="calendar-tab-agenda"
            >
              Agenda
            </TabButton>
            <TabButton
              active={activeTab === 'momentum'}
              onClick={() => onTabChange('momentum')}
              icon={Zap}
              data-tour="calendar-tab-momentum"
            >
              Momentum
            </TabButton>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex items-center justify-between gap-6">
          {/* Left: Logo + Menu */}
          <div className="flex items-center gap-4">
            {onMenuClick && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onMenuClick}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-7 w-7 text-[#1a73e8]" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Calendar
              </h1>
            </div>
          </div>

          {/* Center: Tabs + Metrics */}
          <div className="flex-1 flex items-center gap-6">
            {/* Tabs */}
            <div className="flex gap-2">
              <TabButton
                active={activeTab === 'agenda'}
                onClick={() => onTabChange('agenda')}
                icon={CalendarDays}
              >
                Calendario
              </TabButton>
              <TabButton
                active={activeTab === 'momentum'}
                onClick={() => onTabChange('momentum')}
                icon={Zap}
              >
                Momentum
              </TabButton>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />

            {/* Momentum Metrics */}
            <div className="flex gap-3">
              <MetricCard
                icon={Flame}
                value={streak}
                label="Streak"
                color="text-orange-600 dark:text-orange-400"
                bgColor="bg-orange-50 dark:bg-orange-900/20"
                isLoading={isLoading}
                compact
              />
              <MetricCard
                icon={Activity}
                value={todayCheckins}
                label="Check-ins"
                color="text-green-600 dark:text-green-400"
                bgColor="bg-green-50 dark:bg-green-900/20"
                isLoading={isLoading}
                compact
              />
              <MetricCard
                icon={TrendingUp}
                value={`${productivityScore}%`}
                label="Score"
                color="text-blue-600 dark:text-blue-400"
                bgColor="bg-blue-50 dark:bg-blue-900/20"
                isLoading={isLoading}
                compact
              />
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-2">
            {onStartTour && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onStartTour}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
                title="Guida Interattiva"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            )}
            {onNewCheckin && (
              <Button 
                variant="outline"
                onClick={onNewCheckin}
                data-tour="momentum-checkin-btn"
                className="gap-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
              >
                <Zap className="h-4 w-4" />
                Check-in
              </Button>
            )}
            {onNewEvent && (
              <Button 
                onClick={onNewEvent}
                data-tour="calendar-new-event-btn"
                className="bg-[#1a73e8] hover:bg-[#1557b0] hover:brightness-105 text-white gap-2 shadow-sm transition-all duration-150 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Nuovo Evento
              </Button>
            )}
            {onSettings && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onSettings}
                data-tour="momentum-settings-btn"
                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 active:scale-95"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  'data-tour'?: string;
}

function TabButton({ active, onClick, icon: Icon, children, ...props }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      {...props}
      className={cn(
        "relative px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-150 flex items-center gap-2 whitespace-nowrap",
        active
          ? "bg-[#1a73e8] text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50 hover:brightness-105"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-[1.02]",
        "active:scale-[0.98]"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "animate-pulse")} />
      {children}
    </button>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  color: string;
  bgColor: string;
  isLoading: boolean;
  compact?: boolean;
}

function MetricCard({ 
  icon: Icon, 
  value, 
  label, 
  color, 
  bgColor, 
  isLoading,
  compact = false 
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div className={cn(
        "rounded-lg border border-gray-200 dark:border-gray-700",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}>
        <Skeleton className={cn("h-4 w-full", compact ? "mb-1" : "mb-2")} />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  const isStreakCard = label === 'Streak';

  return (
    <div className={cn(
      "rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-gray-300 dark:hover:border-gray-600 cursor-default",
      bgColor,
      compact ? "px-3 py-2" : "px-4 py-3"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn(
          compact ? "h-4 w-4" : "h-5 w-5", 
          color,
          isStreakCard && typeof value === 'number' && value > 0 && "animate-pulse-glow"
        )} />
        <div>
          <div className={cn(
            "font-bold text-gray-900 dark:text-white animate-count-up",
            compact ? "text-base" : "text-lg"
          )}>
            {value}
          </div>
          <div className={cn(
            "text-gray-600 dark:text-gray-400 font-medium",
            compact ? "text-[10px]" : "text-xs"
          )}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
