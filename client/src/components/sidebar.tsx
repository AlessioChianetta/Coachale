import { cn, slugify } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  Home,
  Users,
  ClipboardList,
  TrendingUp,
  Calendar,
  CalendarDays,
  Target,
  FileText,
  BarChart3,
  MessageCircle,
  X,
  BookOpen,
  DollarSign,
  ExternalLink,
  Map,
  CheckSquare,
  GraduationCap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings,
  Mail,
  Inbox,
  ListTodo,
  Zap,
  MessageSquare,
  Bot,
  UserPlus,
  PenSquare,
  Megaphone,
  Key,
  UserCircle,
  History,
  Video,
  Sun,
  Moon,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuthUser, logout } from "@/lib/auth";
import { useState, useEffect } from "react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string;
  color?: string; // Colore dell'icona
}

interface SidebarProps {
  role: "consultant" | "client";
  isOpen?: boolean;
  onClose?: () => void;
  showRoleSwitch?: boolean;
  onRoleSwitch?: (role: "consultant" | "client") => void;
  currentRole?: "consultant" | "client";
}

interface SidebarItemWithChildren extends SidebarItem {
  children?: SidebarItem[];
}

interface SidebarCategory {
  name: string;
  icon?: React.ComponentType<any>;
  items: SidebarItem[];
  defaultExpanded?: boolean;
}

const consultantCategories: SidebarCategory[] = [
  {
    name: "PRINCIPALE",
    icon: Home,
    defaultExpanded: true,
    items: [
      { name: "Dashboard", href: "/consultant", icon: Home, color: "text-blue-600" },
      { name: "AI Assistant", href: "/consultant/ai-assistant", icon: Sparkles, color: "text-fuchsia-600" },
    ]
  },
  {
    name: "GESTIONE CLIENTI",
    icon: Users,
    defaultExpanded: true,
    items: [
      { name: "Lista Clienti", href: "/consultant/clients", icon: Users, badge: "12", color: "text-purple-600" },
      { name: "Stato & Obiettivi", href: "/consultant/client-state", icon: Target, color: "text-green-600" },
      { name: "Task & Feedback", href: "/consultant/client-daily", icon: CheckSquare, color: "text-rose-600" },
      { name: "Appuntamenti", href: "/consultant/appointments", icon: Calendar, color: "text-orange-600" },
      { name: "Task Consulenze", href: "/consultant/tasks", icon: ListTodo, color: "text-pink-600" },
    ]
  },
  {
    name: "FORMAZIONE",
    icon: GraduationCap,
    defaultExpanded: false,
    items: [
      { name: "La Mia Università", href: "/consultant/university", icon: GraduationCap, color: "text-amber-600" },
      { name: "Esercizi Assegnati", href: "/consultant/exercises", icon: ClipboardList, color: "text-cyan-600" },
      { name: "Template Esercizi", href: "/consultant/exercise-templates", icon: BookOpen, color: "text-teal-600" },
      { name: "Libreria Corsi", href: "/consultant/library", icon: BookOpen, color: "text-indigo-600" },
    ]
  },
  {
    name: "COMUNICAZIONE & MARKETING",
    icon: Megaphone,
    defaultExpanded: true,
    items: [
      { name: "Campagne Marketing", href: "/consultant/campaigns", icon: Megaphone, color: "text-amber-600" },
      { name: "Lead & Campagne", href: "/consultant/proactive-leads", icon: UserPlus, color: "text-emerald-600" },
      { name: "Email Automatiche Journey", href: "/consultant/ai-config", icon: Sparkles, color: "text-fuchsia-600" },
      { name: "Email - Storico Invii", href: "/consultant/email-logs", icon: Inbox, color: "text-violet-600" },
      { name: "WhatsApp - Conversazioni", href: "/consultant/whatsapp-conversations", icon: MessageSquare, color: "text-green-600" },
      { name: "Chat con AI Agents", href: "/consultant/whatsapp-agents-chat", icon: Bot, color: "text-cyan-600", badge: "NEW" },
      { name: "Crea Template", href: "/consultant/whatsapp/custom-templates/list", icon: PenSquare, color: "text-purple-600" },
      { name: "Visualizza Template", href: "/consultant/whatsapp-templates", icon: FileText, color: "text-blue-600" },
    ]
  },
  {
    name: "CONFIGURAZIONE",
    icon: Settings,
    defaultExpanded: false,
    items: [
      { name: "Impostazioni API", href: "/consultant/api-keys-unified", icon: Key, color: "text-purple-600" },  
      { name: "Setup Agenti", href: "/consultant/whatsapp", icon: Settings, color: "text-gray-600" },
    ]
  },
  {
    name: "RISORSE",
    icon: BookOpen,
    defaultExpanded: false,
    items: [
      { name: "Guide WhatsApp", href: "/consultant/guide-whatsapp", icon: MessageSquare, color: "text-green-600", badge: "NEW" },
      { name: "Guide Email Marketing", href: "/consultant/guide-email", icon: Mail, color: "text-sky-600", badge: "NEW" },
      { name: "Guide Università", href: "/consultant/guide-university", icon: GraduationCap, color: "text-amber-600", badge: "NEW" },
      { name: "Guide Gestione Clienti", href: "/consultant/guide-clients", icon: Users, color: "text-purple-600", badge: "NEW" },
      { name: "Guide Google Calendar", href: "/consultant/guide-calendar", icon: CalendarDays, color: "text-blue-600", badge: "NEW" },
    ]
  },
  // Adding the new AI Consultations link here
  {
    name: "AI FUNZIONALITÀ",
    icon: Sparkles,
    defaultExpanded: true,
    items: [
      { name: "Consulenze AI", href: "/consultant/ai-consultations", icon: Sparkles, color: "text-purple-600" },
    ]
  }
];

// Flatten consultant categories for backward compatibility (client views, collapsed views)
const consultantItems: SidebarItemWithChildren[] = consultantCategories.flatMap(cat => cat.items);

const clientItems: SidebarItemWithChildren[] = [
  { name: "Dashboard", href: "/client", icon: Home, color: "text-blue-600" },
  { 
    name: "AI Assistant", 
    href: "/client/ai-assistant", 
    icon: Sparkles, 
    color: "text-fuchsia-600",
    children: [
      { name: "Chat AI", href: "/client/ai-assistant", icon: Sparkles, color: "text-fuchsia-600" },
      { name: "Consulenze AI", href: "/client/ai-consultations-history", icon: History, color: "text-purple-600" },
    ]
  },
  { 
    name: "La Mia Università", 
    href: "/client/university", 
    icon: GraduationCap, 
    color: "text-amber-600",
    children: [
      { name: "Università", href: "/client/university", icon: GraduationCap, color: "text-amber-600" },
      { name: "I Miei Esercizi", href: "/client/exercises", icon: ClipboardList, badge: "3", color: "text-cyan-600" },
      { name: "Corsi", href: "/client/library", icon: BookOpen, color: "text-indigo-600" },
    ]
  },
  { 
    name: "Sales Agents AI", 
    href: "/client/sales-agents", 
    icon: Bot, 
    color: "text-blue-600",
    children: [
      { name: "I Miei Agenti", href: "/client/sales-agents", icon: Bot, color: "text-blue-600" },
      { name: "Nuovo Agente", href: "/client/sales-agents/new", icon: UserPlus, color: "text-green-600" },
      { name: "Live Consultation", href: "/live-consultation", icon: Video, color: "text-purple-600" },
      { name: "Vertex AI Analytics", href: "/client/analytics/vertex-ai", icon: BarChart3, color: "text-indigo-600" },
    ]
  },
  { 
    name: "Il Mio Tempo", 
    href: "/client/calendar", 
    icon: CalendarDays, 
    color: "text-emerald-600",
    children: [
      { name: "Calendario", href: "/client/calendar", icon: CalendarDays, color: "text-emerald-600" },
      { name: "Task & Riflessioni", href: "/client/daily-tasks", icon: CheckSquare, color: "text-rose-600" },
      { name: "Momentum", href: "/client/calendar?tab=momentum", icon: Zap, color: "text-violet-600" },
      { name: "Consulenze", href: "/client/consultations", icon: Calendar, color: "text-orange-600" },
    ]
  },
];

export default function Sidebar({ role, isOpen, onClose, showRoleSwitch, onRoleSwitch, currentRole }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sidebar-expanded-items');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // Always initialize with defaults first
    const defaults = new Set<string>();
    if (role === "consultant") {
      consultantCategories.forEach(cat => {
        if (cat.defaultExpanded) {
          defaults.add(cat.name);
        }
      });
    }

    // Then check localStorage and MERGE with defaults
    const saved = localStorage.getItem('sidebar-expanded-categories');
    if (saved) {
      try {
        const savedCategories = new Set(JSON.parse(saved));
        // Merge: keep all defaults + add any from saved
        savedCategories.forEach(cat => defaults.add(cat));
      } catch (e) {
        // If parsing fails, just use defaults
      }
    }

    return defaults;
  });
  const items = role === "consultant" ? consultantItems : clientItems;
  const categories = role === "consultant" ? consultantCategories : null;
  const user = getAuthUser();

  // Non mostrare sidebar per clienti non attivi
  if (role === "client" && user?.isActive === false) {
    return null;
  }

  // Helper function to check if a route is active
  // Prevents false matches like /consultant/calendar matching /consultant/calendar-settings
  const isRouteActive = (href: string, currentLocation: string) => {
    // Special case: Dashboard routes (e.g., /consultant, /client) should ONLY match exactly
    // to prevent highlighting on all child routes
    if (href === `/${role}`) {
      return currentLocation === href;
    }

    // For all other routes, use delimiter-based matching
    return currentLocation === href || 
      currentLocation.startsWith(href + '/') || 
      currentLocation.startsWith(href + '?') || 
      currentLocation.startsWith(href + '#');
  };

  // Save expanded items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sidebar-expanded-items', JSON.stringify(Array.from(expandedItems)));
  }, [expandedItems]);

  // Save expanded categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sidebar-expanded-categories', JSON.stringify(Array.from(expandedCategories)));
  }, [expandedCategories]);

  // Auto-collapse sidebar when AI Assistant page opens
  useEffect(() => {
    const handleAIAssistantOpen = () => {
      if (!isMobile) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('ai-assistant-opened', handleAIAssistantOpen);

    return () => {
      window.removeEventListener('ai-assistant-opened', handleAIAssistantOpen);
    };
  }, [isMobile]);

  // Tour: auto-expand/collapse menu items
  useEffect(() => {
    const handleTourExpandMenu = (e: CustomEvent) => {
      const { menuName } = e.detail;
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(menuName);
        return newSet;
      });
    };

    const handleTourCollapseMenu = (e: CustomEvent) => {
      const { menuName } = e.detail;
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(menuName);
        return newSet;
      });
    };

    window.addEventListener('tour-expand-menu', handleTourExpandMenu as EventListener);
    window.addEventListener('tour-collapse-menu', handleTourCollapseMenu as EventListener);

    return () => {
      window.removeEventListener('tour-expand-menu', handleTourExpandMenu as EventListener);
      window.removeEventListener('tour-collapse-menu', handleTourCollapseMenu as EventListener);
    };
  }, []);

  const handleLogout = () => {
    localStorage.setItem('isLoggingOut', 'true');
    logout();
    setLocation('/login');
  };

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleFinancialClick = () => {
    setIsLoadingFinancial(true);

    // Simulate loading for animation
    setTimeout(() => {
      window.open('https://conorbitale.replit.app', '_blank');
      setIsLoadingFinancial(false);
      if (isMobile && onClose) {
        onClose();
      }
    }, 1000);
  };

  const ThemeToggleInline = ({ isCollapsed }: { isCollapsed: boolean }) => {
    const { theme, setTheme } = useTheme();
    
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full font-semibold text-gray-700 dark:text-gray-300",
          "hover:bg-yellow-50 dark:hover:bg-yellow-950/20 hover:text-yellow-600 dark:hover:text-yellow-400 mb-2",
          isCollapsed ? "justify-center px-2" : "justify-start gap-2"
        )}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={isCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
      >
        {theme === 'dark' ? (
          <Sun size={16} className="text-yellow-400" />
        ) : (
          <Moon size={16} className="text-gray-600" />
        )}
        {!isCollapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
      </Button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo e nome app con pulsante collapse - Design Moderno */}
      {!isCollapsed && <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Consulente Pro
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Platform
              </p>
            </div>
          )}
        </div>
        {!isMobile && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-gradient-to-br from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-md transition-all duration-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-tour={role === "client" ? "client-collapse-button" : undefined}
            title="Riduci sidebar"
          >
            <ChevronLeft size={18} className="text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110" />
          </Button>
        )}
      </div>}

      {/* Navigation Items - Design Migliorato con Categorie */}
      {!isCollapsed && <nav className="space-y-2 flex-1 overflow-y-auto px-2">
        {/* Render categorized sidebar for consultant */}
        {categories && !isCollapsed ? categories.map((category, idx) => {
          const isCategoryExpanded = expandedCategories.has(category.name);

          return (
            <div key={category.name}>
              {/* Separator between categories (except first) */}
              {idx > 0 && (
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent my-3" />
              )}

              <div className="space-y-1">
                {/* Category Header */}
                <button
                  onClick={() => {
                    setExpandedCategories(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(category.name)) {
                        newSet.delete(category.name);
                      } else {
                        newSet.add(category.name);
                      }
                      return newSet;
                    });
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {category.icon && (
                      <category.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="whitespace-nowrap">{category.name}</span>
                  </div>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200",
                    isCategoryExpanded && "rotate-90"
                  )} />
                </button>

                {/* Category Items */}
                {isCategoryExpanded && (
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isRouteActive(item.href, location);

                      return (
                        <Link key={item.href} href={item.href}>
                          <div
                            className={cn(
                              "group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                              isActive
                                ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-500/30 dark:border-blue-400/30 text-gray-900 dark:text-white shadow-sm"
                                : "bg-gray-50/50 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:shadow-md hover:scale-[1.02] border border-transparent"
                            )}
                            data-testid={`link-${slugify(item.name)}`}
                            onClick={handleLinkClick}
                          >
                            <div className={cn(
                              "p-2 rounded-lg transition-all duration-200",
                              isActive
                                ? "bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 shadow-inner"
                                : "bg-white dark:bg-gray-800 shadow-sm group-hover:shadow-md"
                            )}>
                              <Icon className={cn(
                                "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                                isActive
                                  ? "text-blue-600 dark:text-blue-400"
                                  : item.color || "text-gray-600 dark:text-gray-400"
                              )} />
                            </div>

                            <div className="flex-1 flex items-center justify-between">
                              <span className={cn(
                                "font-semibold",
                                isActive && "text-gray-900 dark:text-white"
                              )}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2">
                                {item.badge && (
                                  <span className={cn(
                                    "px-2.5 py-0.5 text-xs font-bold rounded-full shadow-sm",
                                    isActive 
                                      ? "bg-blue-500 text-white" 
                                      : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                  )}>
                                    {item.badge}
                                  </span>
                                )}
                                {isActive && (
                                  <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        }) : null}

        {/* Render old style for clients or when collapsed */}
        {(!categories || isCollapsed) && items.map((item) => {
          const Icon = item.icon;
      const hasChildren = 'children' in item && item.children && item.children.length > 0;

      // Parent is active if:
      // 1. Current location matches parent href, OR
      // 2. Any child route is active (for items with children)
      const isActive = isRouteActive(item.href, location) || 
        (hasChildren && item.children!.some(child => isRouteActive(child.href, location)));

      const isExpanded = expandedItems.has(item.name);

          return (
            <div key={item.href}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-500/30 dark:border-blue-400/30 text-gray-900 dark:text-white shadow-sm"
                      : "bg-gray-50/50 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:shadow-md hover:scale-[1.02] border border-transparent",
                    isCollapsed && "justify-center px-2"
                  )}
                  data-testid={`link-${slugify(item.name)}`}
                  data-tour={role === "client" ? `client-${slugify(item.name)}` : undefined}
                  onClick={(e) => {
                    if (hasChildren && !isCollapsed) {
                      e.preventDefault();
                      setExpandedItems(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(item.name)) {
                          newSet.delete(item.name);
                        } else {
                          newSet.add(item.name);
                        }
                        return newSet;
                      });
                    } else if (!hasChildren) {
                      handleLinkClick();
                    }
                  }}
                  title={isCollapsed ? item.name : undefined}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 shadow-inner"
                      : "bg-white dark:bg-gray-800 shadow-sm group-hover:shadow-md"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : item.color || "text-gray-600 dark:text-gray-400"
                    )} />
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span className={cn(
                        "font-semibold",
                        isActive && "text-gray-900 dark:text-white"
                      )}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <span className={cn(
                            "px-2.5 py-0.5 text-xs font-bold rounded-full shadow-sm",
                            isActive 
                              ? "bg-blue-500 text-white" 
                              : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          )}>
                            {item.badge}
                          </span>
                        )}
                        {hasChildren ? (
                          <ChevronRight className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            isExpanded && "rotate-90",
                            isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                          )} />
                        ) : isActive && (
                          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              {/* Submenu */}
              {hasChildren && isExpanded && !isCollapsed && (
                <div 
                  className="ml-4 mt-1.5 space-y-1 border-l-2 border-blue-200 dark:border-blue-800/50 pl-3"
                  data-tour={role === "client" ? `client-${slugify(item.name)}-submenu` : undefined}
                >
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = isRouteActive(child.href, location);

                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                            isChildActive
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800"
                              : "bg-gray-50/50 dark:bg-gray-800/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40 hover:shadow-sm hover:scale-[1.02] border border-transparent"
                          )}
                          data-testid={`link-${slugify(child.name)}`}
                          data-tour={role === "client" ? `client-submenu-${slugify(child.name)}` : undefined}
                          onClick={handleLinkClick}
                        >
                          <div className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isChildActive
                              ? "bg-blue-200 dark:bg-blue-800/50"
                              : "bg-white dark:bg-gray-800/50"
                          )}>
                            <ChildIcon className={cn(
                              "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                              isChildActive
                                ? "text-blue-600 dark:text-blue-400"
                                : child.color || "text-gray-500 dark:text-gray-500"
                            )} />
                          </div>
                          <span className="font-medium">{child.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Financial Management Section - Only for clients */}
        {role === "client" && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {!isCollapsed && (
              <h3 className="px-4 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Servizi Esterni
              </h3>
            )}
            <div
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer mx-2",
                "bg-gray-50/50 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:shadow-md hover:scale-[1.02] border border-transparent",
                isLoadingFinancial && "bg-gray-100 dark:bg-gray-800 animate-pulse",
                isCollapsed && "justify-center px-2"
              )}
              onClick={handleFinancialClick}
              data-testid="link-gestione-finanziaria"
              title={isCollapsed ? "Gestione Finanziaria" : undefined}
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 shadow-sm group-hover:shadow-md transition-all duration-200">
                <DollarSign 
                  className={cn(
                    "h-5 w-5 text-green-600 dark:text-green-400 transition-transform duration-200 group-hover:scale-110",
                    isLoadingFinancial && "animate-spin"
                  )} 
                />
              </div>
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-semibold">
                    Gestione Finanziaria
                  </span>
                  <ExternalLink 
                    className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" 
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </nav>}

      {/* User info e logout - agganciato in basso */}
      {!isCollapsed && (
      <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className={cn(
          "flex items-center gap-2 mb-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
          isCollapsed && "justify-center px-2"
        )}>
          <Avatar className="w-10 h-10 border-2 border-gray-200 dark:border-gray-600">
            <AvatarImage src={user?.avatar || undefined} alt={user?.firstName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                {user?.role === 'consultant' ? 'Consulente' : 'Cliente'}
              </p>
            </div>
          )}
          {role === "consultant" && (
            <Link href="/consultant/profile-settings">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Impostazioni Profilo"
              >
                <UserCircle size={16} />
              </Button>
            </Link>
          )}
          {role === "client" && (
            <Link href="/client/settings">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Impostazioni"
                data-tour="client-user-settings"
              >
                <Settings size={16} />
              </Button>
            </Link>
          )}
        </div>

        {/* Role switcher se disponibile */}
        {!isCollapsed && showRoleSwitch && onRoleSwitch && (
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex mb-3 mx-1">
            <Button
              variant={currentRole === "consultant" ? "default" : "ghost"}
              size="sm"
              onClick={() => onRoleSwitch("consultant")}
              className={cn(
                "flex-1 text-xs font-semibold",
                currentRole === "consultant" 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "hover:bg-gray-200 dark:hover:bg-gray-600"
              )}
            >
              Consulente
            </Button>
            <Button
              variant={currentRole === "client" ? "default" : "ghost"}
              size="sm"
              onClick={() => onRoleSwitch("client")}
              className={cn(
                "flex-1 text-xs font-semibold",
                currentRole === "client" 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "hover:bg-gray-200 dark:hover:bg-gray-600"
              )}
            >
              Cliente
            </Button>
          </div>
        )}

        {/* Theme Toggle Button */}
        <ThemeToggleInline isCollapsed={isCollapsed} />

        {/* Logout button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "w-full font-semibold text-gray-700 dark:text-gray-300",
            "hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400",
            isCollapsed ? "justify-center px-2" : "justify-start gap-2"
          )} 
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut size={16} />
          {!isCollapsed && "Logout"}
        </Button>
      </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-80 p-0" style={{ animationDuration: "250ms" }} data-testid="sidebar-mobile" data-tour="client-sidebar">
          <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-br from-background to-muted/20">
            <SheetTitle className="text-left flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Home className="text-white" size={18} />
              </div>
              <div>
                <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Consulente Pro
                </span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Platform</p>
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 h-[calc(100vh-5rem)] flex flex-col overflow-y-auto">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop version
  return (
    <>
      {!isMobile && isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-6 left-6 z-50 h-10 w-10 bg-gradient-to-br from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-md transition-all duration-200 rounded-lg"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title="Espandi sidebar"
        >
          <ChevronRight size={20} className="text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110" />
        </Button>
      )}
      {!isCollapsed && (
      <div 
        className="hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 transition-all duration-150 h-screen sticky top-0 w-72"
        data-testid="sidebar"
        data-tour="client-sidebar"
      >
        <SidebarContent />
      </div>
      )}
    </>
  );
}