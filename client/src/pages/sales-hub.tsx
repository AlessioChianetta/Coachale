import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  FileText,
  Video,
  Menu,
  Users,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/sidebar';
import { useRoleSwitch } from '@/hooks/use-role-switch';
import { getAuthUser } from '@/lib/auth';
import ClientSalesAgentsList from './client-sales-agents-list';
import ClientScriptManager from './client-script-manager';
import LiveConsultation from './live-consultation';

type HubTab = 'agents' | 'scripts' | 'live';

const tabs: { id: HubTab; label: string; icon: React.ElementType; gradient: string }[] = [
  {
    id: 'agents',
    label: 'Agenti AI',
    icon: Bot,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'scripts',
    label: 'Script Manager',
    icon: FileText,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    id: 'live',
    label: 'Live Consultation',
    icon: Video,
    gradient: 'from-purple-500 to-pink-500',
  },
];

export default function SalesHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('agents');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const authUser = getAuthUser();
  const isConsultant = authUser?.role === 'consultant';
  const sidebarRole = isConsultant ? 'consultant' : 'client';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex h-screen">
        <Sidebar
          role={sidebarRole as 'client' | 'consultant'}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showRoleSwitch={showRoleSwitch}
          currentRole={currentRole}
          onRoleSwitch={handleRoleSwitch}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
            <div className="px-4 md:px-6 py-3 flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {isConsultant ? 'Venditori Autonomi' : 'Dipendenti AI'}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                    Centro di comando vendita AI
                  </p>
                </div>
              </div>

              <div className="flex-1" />

              <Badge variant="outline" className="hidden sm:flex gap-1.5 px-3 py-1 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                AI Powered
              </Badge>
            </div>

            <div className="px-4 md:px-6 pb-0">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl
                        transition-all duration-200 whitespace-nowrap min-w-fit
                        ${isActive
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-b-0 border-gray-200 dark:border-gray-700 -mb-px'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                        }
                      `}
                    >
                      <div className={`
                        h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-200
                        ${isActive
                          ? `bg-gradient-to-br ${tab.gradient} text-white shadow-sm`
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }
                      `}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span>{tab.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeTabIndicator"
                          className={`absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r ${tab.gradient} rounded-full`}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800 border-x border-gray-200/50 dark:border-gray-700/50">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-auto"
              >
                {activeTab === 'agents' && (
                  <div className="p-4 sm:p-6">
                    <ClientSalesAgentsList embedded />
                  </div>
                )}
                {activeTab === 'scripts' && (
                  <div className="h-full">
                    <ClientScriptManager embedded />
                  </div>
                )}
                {activeTab === 'live' && (
                  <div className="h-full">
                    <LiveConsultation embedded />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
