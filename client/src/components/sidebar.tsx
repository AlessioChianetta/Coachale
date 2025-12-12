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
  Database,
  Plug,
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
import { useState, useEffect, useRef, useCallback } from "react";

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

interface SidebarCategoryExtended extends SidebarCategory {
  isGridLayout?: boolean;
  alwaysVisible?: boolean;
}

const consultantCategories: SidebarCategoryExtended[] = [
  {
    name: "PRINCIPALE",
    icon: Home,
    defaultExpanded: true,
    alwaysVisible: true,
    items: [
      { name: "Dashboard", href: "/consultant", icon: Home, color: "text-blue-500" },
      { name: "AI Assistant", href: "/consultant/ai-assistant", icon: Sparkles, color: "text-fuchsia-500" },
      { name: "Setup Iniziale", href: "/consultant/setup-wizard", icon: Zap, color: "text-emerald-500", badge: "NEW" },
    ]
  },
  {
    name: "LAVORO QUOTIDIANO",
    icon: Users,
    defaultExpanded: true,
    items: [
      { name: "Clienti", href: "/consultant/clients", icon: Users, badge: "12", color: "text-purple-500" },
      { name: "Calendario", href: "/consultant/appointments", icon: Calendar, color: "text-orange-500" },
      { name: "Task", href: "/consultant/tasks", icon: ListTodo, color: "text-pink-500" },
      { name: "Email Journey", href: "/consultant/ai-config", icon: Sparkles, color: "text-fuchsia-500" },
    ]
  },
  {
    name: "COMUNICAZIONE",
    icon: Megaphone,
    defaultExpanded: true,
    items: [
      { name: "Setup Agenti", href: "/consultant/whatsapp", icon: Settings, color: "text-gray-500" },
      { name: "WhatsApp", href: "/consultant/whatsapp-conversations", icon: MessageSquare, color: "text-green-500" },
      { name: "Lead", href: "/consultant/proactive-leads", icon: UserPlus, color: "text-emerald-500" },
      { name: "Template", href: "/consultant/whatsapp-templates", icon: FileText, color: "text-blue-500" },
    ]
  },
  {
    name: "FORMAZIONE",
    icon: GraduationCap,
    defaultExpanded: false,
    items: [
      { name: "Università", href: "/consultant/university", icon: GraduationCap, color: "text-amber-500" },
      { name: "Esercizi", href: "/consultant/exercises", icon: ClipboardList, color: "text-cyan-500" },
      { name: "Template", href: "/consultant/exercise-templates", icon: BookOpen, color: "text-teal-500" },
      { name: "Corsi", href: "/consultant/library", icon: BookOpen, color: "text-indigo-500" },
    ]
  },
  {
    name: "BASE DI CONOSCENZA",
    icon: Database,
    defaultExpanded: false,
    items: [
      { name: "Documenti", href: "/consultant/knowledge-documents", icon: FileText, color: "text-amber-500" },
      { name: "API Esterne", href: "/consultant/knowledge-apis", icon: Plug, color: "text-cyan-500" },
    ]
  },
  {
    name: "IMPOSTAZIONI",
    icon: Settings,
    defaultExpanded: false,
    items: [
    
      { name: "API Keys", href: "/consultant/api-keys-unified", icon: Key, color: "text-purple-500" },  
    ]
  },
  {
    name: "GUIDE",
    icon: BookOpen,
    defaultExpanded: false,
    items: [
      { name: "WhatsApp", href: "/consultant/guide-whatsapp", icon: MessageSquare, color: "text-green-500" },
      { name: "Email", href: "/consultant/guide-email", icon: Mail, color: "text-sky-500" },
      { name: "Università", href: "/consultant/guide-university", icon: GraduationCap, color: "text-amber-500" },
      { name: "Clienti", href: "/consultant/guide-clients", icon: Users, color: "text-purple-500" },
      { name: "Calendar", href: "/consultant/guide-calendar", icon: CalendarDays, color: "text-blue-500" },
    ]
  },
  {
    name: "AI AVANZATO",
    icon: Sparkles,
    defaultExpanded: false,
    items: [
      { name: "Consulenze AI", href: "/consultant/ai-consultations", icon: Sparkles, color: "text-purple-500" },
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
  
  { 
    name: "Agenti AI", 
    href: "/client/sales-agents", 
    icon: Bot, 
    color: "text-blue-600",
    children: [
      { name: "I Miei Agenti AI", href: "/client/sales-agents", icon: Bot, color: "text-blue-600" },
      { name: "Nuovo Agente AI", href: "/client/sales-agents/new", icon: UserPlus, color: "text-green-600" },
      { name: "Script Manager", href: "/client/scripts", icon: FileText, color: "text-amber-600" },
      { name: "Live Consultation", href: "/live-consultation", icon: Video, color: "text-purple-600" },
      { name: "AI Analytics", href: "/client/analytics/vertex-ai", icon: BarChart3, color: "text-indigo-600" },
    ]
  },
 
  { 
    name: "Venditori Umani", 
    href: "/client/human-sellers", 
    icon: Video, 
    color: "text-purple-600",
    children: [
      { name: "I Miei Venditori", href: "/client/human-sellers", icon: Users, color: "text-purple-600" },
      { name: "Video Meetings", href: "/client/human-sellers/meetings", icon: Video, color: "text-blue-600" },
      { name: "Analytics Venditori", href: "/client/human-sellers/analytics", icon: BarChart3, color: "text-indigo-600" },
    ]
  },
  { 
    name: "Base di Conoscenza", 
    href: "/client/knowledge-documents", 
    icon: BookOpen, 
    color: "text-teal-600",
    children: [
      { name: "Documenti", href: "/client/knowledge-documents", icon: FileText, color: "text-teal-600" },
      { name: "API Esterne", href: "/client/knowledge-apis", icon: Zap, color: "text-cyan-600" },
    ]
  },
];

export default function Sidebar({ role, isOpen, onClose, showRoleSwitch, onRoleSwitch, currentRole }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sidebar-expanded-items');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const navRef = useRef<HTMLElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Preserve scroll position when expanding/collapsing categories
  const handleCategoryToggle = useCallback((categoryName: string) => {
    // Save current scroll position
    if (navRef.current) {
      scrollPositionRef.current = navRef.current.scrollTop;
    }
    
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });

    // Restore scroll position after render
    requestAnimationFrame(() => {
      if (navRef.current) {
        navRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  }, []);

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo e nome app - Modern Clean Style */}
      {!isCollapsed && <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500 rounded-lg">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Consulente Pro
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Platform
            </p>
          </div>
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-tour={role === "client" ? "client-collapse-button" : undefined}
            title="Riduci sidebar"
          >
            <ChevronLeft size={16} />
          </Button>
        )}
      </div>}

      {/* Navigation Items - Modern SaaS Style */}
      {!isCollapsed && <nav ref={navRef} className="space-y-1 flex-1 overflow-y-auto">
        {/* Render categorized sidebar for consultant */}
        {categories && !isCollapsed ? (categories as SidebarCategoryExtended[]).map((category, idx) => {
          const isCategoryExpanded = expandedCategories.has(category.name);
          const isAlwaysVisible = category.alwaysVisible;
          const isGridLayout = category.isGridLayout;

          return (
            <div key={category.name}>
              {/* Separator between categories (except first) */}
              {idx > 0 && !isAlwaysVisible && (
                <div className="h-px bg-gray-100 dark:bg-gray-700/50 my-2 mx-2" />
              )}

              <div className="space-y-0.5">
                {/* Category Header - hide for always visible sections */}
                {!isAlwaysVisible && (
                  <button
                    onClick={() => handleCategoryToggle(category.name)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  >
                    <span>{category.name}</span>
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isCategoryExpanded && "rotate-90"
                    )} />
                  </button>
                )}

                {/* Category Items */}
                {(isCategoryExpanded || isAlwaysVisible) && (
                  <div className={cn(
                    isGridLayout ? "grid grid-cols-2 gap-1 px-1" : "space-y-0.5"
                  )}>
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isRouteActive(item.href, location);

                      return (
                        <Link key={item.href} href={item.href}>
                          <div
                            className={cn(
                              "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                              isActive
                                ? "bg-blue-50/80 dark:bg-blue-950/30 text-gray-900 dark:text-white"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                            )}
                            data-testid={`link-${slugify(item.name)}`}
                            onClick={handleLinkClick}
                          >
                            {/* Active indicator bar */}
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                            )}

                            {/* Icon without box */}
                            <Icon className={cn(
                              "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150",
                              isActive
                                ? "text-blue-500"
                                : item.color || "text-gray-400 dark:text-gray-500"
                            )} />

                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className={cn(
                                "font-medium truncate",
                                isActive ? "font-semibold" : ""
                              )}>
                                {item.name}
                              </span>
                              
                              {/* Badge with dot style */}
                              {item.badge && (
                                <span className={cn(
                                  "flex items-center gap-1 text-xs font-medium ml-1",
                                  item.badge === "NEW" 
                                    ? "text-emerald-500" 
                                    : "text-gray-500 dark:text-gray-400"
                                )}>
                                  {item.badge !== "NEW" && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  )}
                                  <span>{item.badge}</span>
                                </span>
                              )}
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

        {/* Render Modern SaaS style for clients or when collapsed */}
        {(!categories || isCollapsed) && items.map((item) => {
          const Icon = item.icon;
          const hasChildren = 'children' in item && item.children && item.children.length > 0;
          const isActive = isRouteActive(item.href, location) || 
            (hasChildren && item.children!.some(child => isRouteActive(child.href, location)));
          const isExpanded = expandedItems.has(item.name);

          return (
            <div key={item.href}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-blue-50/80 dark:bg-blue-950/30 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white",
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
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                  )}

                  {/* Icon without box */}
                  <Icon className={cn(
                    "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150",
                    isActive
                      ? "text-blue-500"
                      : item.color || "text-gray-400 dark:text-gray-500"
                  )} />

                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className={cn(
                        "font-medium truncate",
                        isActive ? "font-semibold" : ""
                      )}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>{item.badge}</span>
                          </span>
                        )}
                        {hasChildren && (
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200 text-gray-400",
                            isExpanded && "rotate-90"
                          )} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              {/* Submenu - Modern style */}
              {hasChildren && isExpanded && !isCollapsed && (
                <div 
                  className="ml-6 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3"
                  data-tour={role === "client" ? `client-${slugify(item.name)}-submenu` : undefined}
                >
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = isRouteActive(child.href, location);

                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={cn(
                            "group relative flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-all duration-150 cursor-pointer",
                            isChildActive
                              ? "bg-blue-50/80 dark:bg-blue-950/30 text-gray-900 dark:text-white"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300"
                          )}
                          data-testid={`link-${slugify(child.name)}`}
                          data-tour={role === "client" ? `client-submenu-${slugify(child.name)}` : undefined}
                          onClick={handleLinkClick}
                        >
                          {isChildActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full" />
                          )}
                          <ChildIcon className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isChildActive
                              ? "text-blue-500"
                              : child.color || "text-gray-400"
                          )} />
                          <span className={cn(
                            "font-medium",
                            isChildActive && "font-semibold"
                          )}>{child.name}</span>
                          {child.badge && (
                            <span className="flex items-center gap-1 text-xs font-medium text-gray-400 ml-auto">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span>{child.badge}</span>
                            </span>
                          )}
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
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            {!isCollapsed && (
              <h3 className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Servizi Esterni
              </h3>
            )}
            <div
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white",
                isLoadingFinancial && "bg-gray-50 dark:bg-gray-800 animate-pulse",
                isCollapsed && "justify-center px-2"
              )}
              onClick={handleFinancialClick}
              data-testid="link-gestione-finanziaria"
              title={isCollapsed ? "Gestione Finanziaria" : undefined}
            >
              <DollarSign 
                className={cn(
                  "h-[18px] w-[18px] flex-shrink-0 text-emerald-500",
                  isLoadingFinancial && "animate-spin"
                )} 
              />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="font-medium truncate">
                    Finanziaria
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        )}
      </nav>}

      {/* User info e logout - agganciato in basso */}
      {!isCollapsed && (
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
          <Avatar className="w-9 h-9 border-2 border-gray-200 dark:border-gray-600 flex-shrink-0">
            <AvatarImage src={user?.avatar || undefined} alt={user?.firstName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
              {user?.role === 'consultant' ? 'Consulente' : 'Cliente'}
            </p>
          </div>
          {/* Action buttons - inline */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {role === "consultant" && (
              <Link href="/consultant/profile-settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Impostazioni"
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
                  className="h-8 w-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Impostazioni"
                  data-tour="client-user-settings"
                >
                  <Settings size={16} />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-yellow-600 dark:text-gray-400 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        {/* Role switcher se disponibile */}
        {showRoleSwitch && onRoleSwitch && (
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex mt-2 mx-1">
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