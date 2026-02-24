import { cn, slugify } from "@/lib/utils";
import { preloadOnHover, cancelHoverPreload } from "@/lib/route-preloader";
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
  ChevronDown,
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
  FileSearch,
  Star,
  Gift,
  Phone,
  // Content Studio icons
  Lightbulb,
  Palette,
  Image,
  LayoutGrid,
  PenLine,
  CreditCard,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { useBrandContext } from "@/contexts/BrandContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuthUser, logout, getToken, setToken, setAuthUser } from "@/lib/auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAutonomyNotifications } from "@/contexts/AutonomyNotificationContext";

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
  defaultCollapsed?: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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

const ICON_BADGE: Record<string, { text: string; bg: string; bgActive: string }> = {
  violet:  { text: "text-violet-500",  bg: "bg-violet-500/15",  bgActive: "bg-violet-500"  },
  fuchsia: { text: "text-fuchsia-500", bg: "bg-fuchsia-500/15", bgActive: "bg-fuchsia-500" },
  cyan:    { text: "text-cyan-500",    bg: "bg-cyan-500/15",    bgActive: "bg-cyan-500"    },
  blue:    { text: "text-blue-500",    bg: "bg-blue-500/15",    bgActive: "bg-blue-500"    },
  emerald: { text: "text-emerald-500", bg: "bg-emerald-500/15", bgActive: "bg-emerald-500" },
  amber:   { text: "text-amber-500",   bg: "bg-amber-500/15",   bgActive: "bg-amber-500"   },
  rose:    { text: "text-rose-500",    bg: "bg-rose-500/15",    bgActive: "bg-rose-500"    },
  teal:    { text: "text-teal-500",    bg: "bg-teal-500/15",    bgActive: "bg-teal-500"    },
  red:     { text: "text-red-500",     bg: "bg-red-500/15",     bgActive: "bg-red-500"     },
  green:   { text: "text-green-500",   bg: "bg-green-500/15",   bgActive: "bg-green-500"   },
  sky:     { text: "text-sky-500",     bg: "bg-sky-500/15",     bgActive: "bg-sky-500"     },
  orange:  { text: "text-orange-500",  bg: "bg-orange-500/15",  bgActive: "bg-orange-500"  },
  purple:  { text: "text-purple-500",  bg: "bg-purple-500/15",  bgActive: "bg-purple-500"  },
  indigo:  { text: "text-indigo-500",  bg: "bg-indigo-500/15",  bgActive: "bg-indigo-500"  },
  yellow:  { text: "text-yellow-500",  bg: "bg-yellow-500/15",  bgActive: "bg-yellow-500"  },
  pink:    { text: "text-pink-500",    bg: "bg-pink-500/15",    bgActive: "bg-pink-500"    },
  slate:   { text: "text-slate-400",   bg: "bg-slate-500/15",   bgActive: "bg-slate-500"   },
};

const consultantCategories: SidebarCategoryExtended[] = [
  {
    name: "PRINCIPALE",
    icon: Home,
    defaultExpanded: true,
    alwaysVisible: true,
    items: [
      { name: "Dashboard", href: "/consultant", icon: Home, color: "violet" },
      { name: "AI Assistant", href: "/consultant/ai-assistant", icon: Sparkles, color: "fuchsia" },
      { name: "Setup Iniziale", href: "/consultant/setup-wizard", icon: Zap, color: "cyan" },
    ]
  },
  {
    name: "LAVORO QUOTIDIANO",
    icon: Users,
    defaultExpanded: true,
    items: [
      { name: "Clienti", href: "/consultant/clients", icon: Users, color: "blue" },
      { name: "Calendario", href: "/consultant/appointments", icon: Calendar, color: "emerald" },
      { name: "Task", href: "/consultant/tasks", icon: ListTodo, color: "amber" },
      { name: "Email Journey", href: "/consultant/ai-config", icon: Sparkles, color: "rose" },
      { name: "Analisi Dati", href: "/consultant/client-data-analysis", icon: BarChart3, color: "teal" },
      { name: "Consulenze AI", href: "/consultant/ai-consultations", icon: Sparkles, color: "violet" },
    ]
  },
  {
    name: "COMUNICAZIONE",
    icon: Megaphone,
    defaultExpanded: true,
    items: [
      { name: "HUB Lead", href: "/consultant/lead-hub", icon: Target, color: "red" },
      { name: "I tuoi dipendenti", href: "/consultant/whatsapp", icon: MessageSquare, color: "green" },
      { name: "Email Hub", href: "/consultant/email-hub", icon: Mail, color: "sky" },
      { name: "Chiamate Voice", href: "/consultant/voice-calls", icon: Phone, color: "orange" },
      { name: "AI Autonomo", href: "/consultant/ai-autonomy", icon: Bot, color: "purple" },
    ]
  },
  {
    name: "CONTENT STUDIO",
    icon: PenLine,
    defaultExpanded: false,
    items: [
      { name: "Dashboard", href: "/consultant/content-studio", icon: LayoutGrid, color: "indigo" },
      { name: "Idee", href: "/consultant/content-studio/ideas", icon: Lightbulb, color: "yellow" },
      { name: "Contenuti", href: "/consultant/content-studio/posts", icon: PenLine, color: "purple" },
      { name: "Calendario", href: "/consultant/content-studio/calendar", icon: Calendar, color: "emerald" },
      { name: "Brand Assets", href: "/consultant/content-studio/brand", icon: Palette, color: "pink" },
      { name: "AdVisage AI", href: "/consultant/content-studio/advisage", icon: Zap, color: "orange" },
    ]
  },
  {
    name: "FORMAZIONE",
    icon: GraduationCap,
    defaultExpanded: false,
    items: [
      { name: "Università", href: "/consultant/university", icon: GraduationCap, color: "amber" },
      { name: "Esercizi", href: "/consultant/exercises", icon: ClipboardList, color: "cyan" },
      { name: "Template", href: "/consultant/exercise-templates", icon: BookOpen, color: "teal" },
      { name: "Corsi", href: "/consultant/library", icon: BookOpen, color: "blue" },
    ]
  },
  {
    name: "CERVELLO AI",
    icon: Database,
    defaultExpanded: false,
    items: [
      { name: "Memoria & Documenti", href: "/consultant/knowledge-documents", icon: FileText, color: "violet" },
      { name: "File Search", href: "/consultant/file-search-analytics", icon: FileSearch, color: "cyan" },
      { name: "Costi AI", href: "/consultant/ai-usage", icon: DollarSign, color: "emerald" },
    ]
  },
  {
    name: "IMPOSTAZIONI",
    icon: Settings,
    defaultExpanded: false,
    items: [
      { name: "API Keys", href: "/consultant/api-keys-unified", icon: Key, color: "slate" },
      { name: "Automazioni Pagamento", href: "/consultant/payment-automations", icon: CreditCard, color: "emerald" },
    ]
  },
  {
    name: "GUIDE",
    icon: BookOpen,
    defaultExpanded: false,
    items: [
      { name: "Centro Guide", href: "/consultant/guides", icon: BookOpen, color: "orange" },
    ]
  },
];

// Flatten consultant categories for backward compatibility (client views, collapsed views)
const consultantItems: SidebarItemWithChildren[] = consultantCategories.flatMap(cat => cat.items);

const clientItems: SidebarItemWithChildren[] = [
  { name: "Dashboard", href: "/client", icon: Home, color: "text-cyan-600" },
  { 
    name: "AI Assistant", 
    href: "/client/ai-assistant", 
    icon: Sparkles, 
    color: "text-teal-600",
    children: [
      { name: "Chat AI", href: "/client/ai-assistant", icon: Sparkles, color: "text-teal-600" },
      { name: "Consulenze AI", href: "/client/ai-consultations-history", icon: History, color: "text-teal-500" },
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
      { name: "Corsi", href: "/client/library", icon: BookOpen, color: "text-teal-600" },
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
      { name: "Momentum", href: "/client/calendar?tab=momentum", icon: Zap, color: "text-teal-600" },
      { name: "Consulenze", href: "/client/consultations", icon: Calendar, color: "text-orange-600" },
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
      { name: "Documenti AI", href: "/client/documents", icon: FileSearch, color: "text-teal-500" },
    ]
  },
  { name: "Le Mie Analisi", href: "/client/my-data-analysis", icon: BarChart3, color: "text-cyan-600" },
];

const proToolsItems: SidebarItemWithChildren[] = [
  { 
    name: "Dipendenti AI", 
    href: "/client/sales-agents", 
    icon: Bot, 
    color: "text-cyan-600",
    children: [
      { name: "I Miei Dipendenti AI", href: "/client/sales-agents", icon: Bot, color: "text-cyan-600" },
      { name: "Nuovo Dipendente AI", href: "/client/sales-agents/new", icon: UserPlus, color: "text-emerald-600" },
      { name: "Script Manager", href: "/client/scripts", icon: FileText, color: "text-amber-600" },
      { name: "Live Consultation", href: "/live-consultation", icon: Video, color: "text-teal-600" },
      { name: "AI Analytics", href: "/client/analytics/vertex-ai", icon: BarChart3, color: "text-teal-500" },
    ]
  },
  { 
    name: "Venditori Umani", 
    href: "/client/human-sellers", 
    icon: Video, 
    color: "text-teal-600",
    children: [
      { name: "I Miei Venditori", href: "/client/human-sellers", icon: Users, color: "text-teal-600" },
      { name: "Video Meetings", href: "/client/human-sellers/meetings", icon: Video, color: "text-cyan-600" },
      { name: "Analytics Venditori", href: "/client/human-sellers/analytics", icon: BarChart3, color: "text-teal-500" },
    ]
  },
];

interface ProfileInfo {
  id: string;
  role: "consultant" | "client" | "super_admin";
  consultantId?: string | null;
  isDefault?: boolean;
}

export default function Sidebar({ role, isOpen, onClose, showRoleSwitch: externalShowRoleSwitch, onRoleSwitch: externalOnRoleSwitch, currentRole: externalCurrentRole, defaultCollapsed = false, isCollapsed: controlledIsCollapsed, onCollapsedChange }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;
  
  const setIsCollapsed = (collapsed: boolean) => {
    if (controlledIsCollapsed === undefined) {
      setInternalCollapsed(collapsed);
    }
    onCollapsedChange?.(collapsed);
  };
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'platform' | 'tools'>('platform');
  
  const [expandedProTools, setExpandedProTools] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar-pro-tools-expanded');
    return saved ? JSON.parse(saved) : false;
  });

  const { data: assignedAgents = [] } = useQuery<Array<{ id: number; publicSlug: string; name: string; avatarUrl?: string }>>({
    queryKey: ['/api/ai-assistant/client/agents-for-assistant'],
    enabled: role === 'client',
    staleTime: 5 * 60 * 1000,
  });

  // Get consultant info for accessing employee agents (Gold/Deluxe clients)
  const { data: consultantInfo } = useQuery<{ success: boolean; data: { consultantId: string; consultantName: string; slug: string } }>({
    queryKey: ['/api/client/consultant-info'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/client/consultant-info', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to fetch consultant info');
      }
      return res.json();
    },
    enabled: role === 'client',
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const fetchProfiles = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch("/api/auth/my-profiles", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setProfiles(data.profiles || []);
        }
      } catch (error) {
        console.error("Failed to fetch profiles:", error);
      }
    };

    if (externalShowRoleSwitch === undefined) {
      fetchProfiles();
    }
  }, [externalShowRoleSwitch]);

  const handleInternalRoleSwitch = async (targetRole: "consultant" | "client") => {
    if (isSwitching) return;

    const user = getAuthUser();
    const targetProfile = profiles.find(p => p.role === targetRole);
    if (!targetProfile || !user) return;

    if (targetProfile.id === user.profileId) return;

    setIsSwitching(true);
    try {
      const token = getToken();
      const response = await fetch("/api/auth/select-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profileId: targetProfile.id, rememberChoice: false }),
      });

      if (!response.ok) throw new Error("Errore nel cambio profilo");

      const data = await response.json();
      setToken(data.token);
      setAuthUser(data.user);

      toast({
        title: "Profilo cambiato",
        description: `Ora sei in modalità ${data.user.role === 'consultant' ? 'Consulente' : 'Cliente'}`,
      });

      if (data.user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel cambio profilo",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const showRoleSwitch = externalShowRoleSwitch !== undefined ? externalShowRoleSwitch : profiles.length > 1;
  const currentRole = externalCurrentRole || (getAuthUser()?.role as "consultant" | "client" | undefined);
  const onRoleSwitch = externalOnRoleSwitch || handleInternalRoleSwitch;
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

  // Save Pro Tools expansion state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-pro-tools-expanded', JSON.stringify(expandedProTools));
  }, [expandedProTools]);

  useEffect(() => {
    if (location.startsWith('/consultant/tools/')) {
      setSidebarTab('tools');
    }
  }, [location]);

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



  const { isAnalysisActive, activeRoleName, newResultsCount, clearNewResults } = useAutonomyNotifications();
  const { brandName, brandLogoUrl, brandPrimaryColor, brandSecondaryColor } = useBrandContext();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {!isCollapsed && <div className="mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl shadow-sm" style={{ background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})` }}>
              {brandLogoUrl ? (
                <img src={brandLogoUrl} alt={brandName} className="h-4 w-4 rounded" />
              ) : (
                <BookOpen className="h-4 w-4 text-white" />
              )}
            </div>
            <h2 className="text-sm font-bold text-foreground leading-tight tracking-tight">
              {brandName}
            </h2>
          </div>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setIsCollapsed(!isCollapsed)}
              data-tour={role === "client" ? "client-collapse-button" : undefined}
              title="Riduci sidebar"
            >
              <ChevronLeft size={15} />
            </Button>
          )}
        </div>
        {categories && (
          <div className="flex gap-0.5 p-0.5 bg-muted/60 rounded-xl">
            <button
              onClick={() => setSidebarTab('platform')}
              className={cn(
                "flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-200",
                sidebarTab === 'platform'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Piattaforma
            </button>
            <button
              onClick={() => setSidebarTab('tools')}
              className={cn(
                "flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-200",
                sidebarTab === 'tools'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Strumenti
            </button>
          </div>
        )}
      </div>}

      {/* Tools Tab Content */}
      {sidebarTab === 'tools' && !isCollapsed && categories && (
        <nav className="space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-muted-foreground">Software e strumenti esterni integrati nella piattaforma.</p>
          </div>
          <div className="space-y-1">
            {[
              { name: "Orbitale Finanza", desc: "Gestione finanziaria", href: "/consultant/tools/finanza", icon: DollarSign, color: "text-emerald-500" },
              { name: "Orbitale CRM", desc: "Gestione lead e clienti", href: "/consultant/tools/crm", icon: Users, color: "text-cyan-500" },
              { name: "Orbitale Contract", desc: "Creazione contratti", href: "/consultant/tools/contract", icon: FileText, color: "text-teal-500" },
              { name: "Orbitale Locale", desc: "Gestione ristoranti", href: "/consultant/tools/locale", icon: Star, color: "text-orange-500" },
            ].map((tool) => {
              const ToolIcon = tool.icon;
              const isActive = isRouteActive(tool.href, location);
              return (
                <Link key={tool.href} href={tool.href}>
                  <div
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-200 cursor-pointer border-l-[3px]",
                      isActive
                        ? "border-primary bg-primary/5 dark:bg-primary/10 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-gray-100/70 dark:hover:bg-gray-800/40 hover:text-foreground"
                    )}
                    onClick={handleLinkClick}
                  >
                    <ToolIcon className={cn(
                      "h-[16px] w-[16px] flex-shrink-0 transition-colors duration-200",
                      isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-medium block truncate", isActive && "font-semibold")}>{tool.name}</span>
                      <span className="text-[11px] text-muted-foreground/60 truncate block">{tool.desc}</span>
                    </div>
                  </div>
                </Link>
              );
            })}

            <div className="mx-3 my-2">
              <div className="h-px bg-border/40" />
            </div>

            <div
              className="group relative flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => { window.open('https://notebooklm.google/', '_blank'); handleLinkClick(); }}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
              <div className="p-1.5 rounded-lg bg-muted">
                <BookOpen className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">NotebookLM</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <span className="text-[11px] text-muted-foreground/60 truncate block">AI notebook di Google</span>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Navigation Items - Modern SaaS Style */}
      {!isCollapsed && (sidebarTab === 'platform' || !categories) && <nav ref={navRef} className="space-y-1 flex-1 overflow-y-auto">
        {/* Render categorized sidebar for consultant */}
        {categories && !isCollapsed ? (categories as SidebarCategoryExtended[]).map((category, idx) => {
          const isCategoryExpanded = expandedCategories.has(category.name);
          const isAlwaysVisible = category.alwaysVisible;
          const isGridLayout = category.isGridLayout;
          const CategoryIcon = category.icon;
          const catLabel = category.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

          return (
            <div key={category.name} className={idx > 0 ? "mt-1" : ""}>
              {/* Category Header — collapsible row, Halal Lab "Settings" style */}
              {!isAlwaysVisible && (
                <button
                  onClick={() => handleCategoryToggle(category.name)}
                  className={cn(
                    "w-full group flex items-center gap-3 px-3 py-[9px] rounded-lg transition-all duration-150 cursor-pointer",
                    isCategoryExpanded
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150",
                    isCategoryExpanded ? "bg-foreground dark:bg-white" : "bg-muted group-hover:bg-muted-foreground/10"
                  )}>
                    <CategoryIcon className={cn(
                      "h-[17px] w-[17px] transition-colors duration-150",
                      isCategoryExpanded ? "text-background dark:text-foreground" : "text-foreground/55 group-hover:text-foreground/80"
                    )} />
                  </div>
                  <span className="flex-1 text-[14.5px] font-medium text-left truncate">{catLabel}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform duration-200",
                    isCategoryExpanded && "rotate-180"
                  )} />
                </button>
              )}

              {/* Category Items */}
              {(isCategoryExpanded || isAlwaysVisible) && (
                <div className={cn(
                  isGridLayout ? "grid grid-cols-2 gap-1 px-1" : "space-y-[2px]",
                  !isAlwaysVisible && "mt-0.5 mb-1"
                )}>
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isRouteActive(item.href, location);
                    const isAIAutonomo = item.name === "AI Autonomo";
                    const showPulse = isAIAutonomo && isAnalysisActive;
                    const showBadge = isAIAutonomo && newResultsCount > 0;

                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "group flex items-center gap-3 px-3 py-[9px] rounded-lg transition-all duration-150 cursor-pointer",
                            isActive
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                          data-testid={`link-${slugify(item.name)}`}
                          onMouseEnter={() => preloadOnHover(item.href)}
                          onMouseLeave={() => cancelHoverPreload(item.href)}
                          onClick={() => { if (isAIAutonomo) clearNewResults(); handleLinkClick(); }}
                        >
                          {/* Filled icon box — Halal Lab style */}
                          <div className={cn(
                            "relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150",
                            showPulse
                              ? "bg-emerald-500"
                              : isActive
                                ? "bg-foreground dark:bg-white"
                                : "bg-muted group-hover:bg-muted-foreground/10"
                          )}>
                            <Icon className={cn(
                              "h-[17px] w-[17px] transition-colors duration-150",
                              showPulse
                                ? "text-white"
                                : isActive
                                  ? "text-background dark:text-foreground"
                                  : "text-foreground/55 group-hover:text-foreground/80"
                            )} />
                            {showPulse && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            )}
                          </div>

                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className={cn(
                              "text-[14.5px] truncate",
                              isActive ? "font-semibold text-foreground" : "font-medium"
                            )}>
                              {item.name}
                            </span>
                            {showBadge ? (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white min-w-[18px] text-center">
                                {newResultsCount}
                              </span>
                            ) : item.badge ? (
                              <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
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
          const isAIAutonomo = item.name === "AI Autonomo";
          const showPulse = isAIAutonomo && isAnalysisActive;
          const showBadge = isAIAutonomo && newResultsCount > 0;

          return (
            <div key={item.href}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-cyan-50/80 dark:bg-cyan-950/30 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center px-2"
                  )}
                  data-testid={`link-${slugify(item.name)}`}
                  data-tour={role === "client" ? `client-${slugify(item.name)}` : undefined}
                  onMouseEnter={() => preloadOnHover(item.href)}
                  onMouseLeave={() => cancelHoverPreload(item.href)}
                  onClick={(e) => {
                    if (isAIAutonomo) clearNewResults();
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
                  {/* Hover/Active indicator bar */}
                  <div className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full transition-opacity duration-150",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )} />
                  <div className="relative flex-shrink-0">
                    <Icon className={cn(
                      "h-[18px] w-[18px] transition-colors duration-150",
                      showPulse
                        ? "text-emerald-500 dark:text-emerald-400"
                        : isActive
                          ? "text-cyan-500"
                          : item.color || "text-muted-foreground/60"
                    )} />
                    {showPulse && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className={cn(
                        "font-medium truncate",
                        isActive ? "font-semibold" : ""
                      )}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {showBadge ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white min-w-[18px] text-center">
                            {newResultsCount}
                          </span>
                        ) : item.badge ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                            <span>{item.badge}</span>
                          </span>
                        ) : null}
                        {hasChildren && (
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground/40",
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
                  className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3"
                  data-tour={role === "client" ? `client-${slugify(item.name)}-submenu` : undefined}
                >
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = isRouteActive(child.href, location);

                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={cn(
                            "group relative flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                            isChildActive
                              ? "bg-cyan-50/80 dark:bg-cyan-950/30 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                          data-testid={`link-${slugify(child.name)}`}
                          data-tour={role === "client" ? `client-submenu-${slugify(child.name)}` : undefined}
                          onClick={handleLinkClick}
                        >
                          {/* Hover/Active indicator bar */}
                          <div className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full transition-opacity duration-150",
                            isChildActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <ChildIcon className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors duration-150",
                            isChildActive
                              ? "text-cyan-500"
                              : child.color || "text-muted-foreground/60 group-hover:text-cyan-500"
                          )} />
                          <span className={cn(
                            "font-medium",
                            isChildActive && "font-semibold"
                          )}>{child.name}</span>
                          {child.badge && (
                            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 ml-auto">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
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

        {/* I Miei Agenti AI Section - Only for clients with assigned agents */}
        {role === "client" && assignedAgents.length > 0 && !isCollapsed && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <h3 className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              I Miei Agenti AI
            </h3>
            <div className="space-y-0.5">
              {assignedAgents.map((agent) => (
                <Link key={agent.id} href={`/agent/${agent.publicSlug}/chat`}>
                  <div
                    className={cn(
                      "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                      "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    data-testid={`link-agent-${agent.publicSlug}`}
                    onClick={handleLinkClick}
                  >
                    {/* Hover indicator bar */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    <Bot className="h-[18px] w-[18px] flex-shrink-0 text-violet-500" />
                    <span className="font-medium truncate">{agent.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Dipendenti AI del Consulente - Link to consultant's employee agents for Gold/Deluxe clients */}
        {role === "client" && consultantInfo?.success && consultantInfo.data?.slug && !isCollapsed && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <h3 className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Dipendenti AI
            </h3>
            <div className="space-y-0.5">
              <Link href={`/c/${consultantInfo.data.slug}/select-agent`}>
                <div
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                    "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid="link-consultant-agents"
                  onClick={handleLinkClick}
                >
                  {/* Hover indicator bar */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  <Users className="h-[18px] w-[18px] flex-shrink-0 text-emerald-500" />
                  <span className="font-medium truncate">Dipendenti di {consultantInfo.data.consultantName}</span>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Pro Tools Section - Collapsible premium section for clients */}
        {role === "client" && !isCollapsed && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <button
              onClick={() => setExpandedProTools(!expandedProTools)}
              className="w-full flex items-center justify-between px-3 py-1.5 group"
            >
              <div className="flex items-center gap-1.5">
                <Star className={cn(
                  "h-3.5 w-3.5 text-amber-500 transition-transform duration-200",
                  "group-hover:rotate-12 group-hover:scale-110"
                )} />
                <span className="text-[10px] font-semibold uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Pro Tools
                </span>
              </div>
              <ChevronRight className={cn(
                "h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
                expandedProTools && "rotate-90"
              )} />
            </button>
            
            {expandedProTools && (
              <div className="space-y-0.5 mt-1">
                {proToolsItems.map((item) => {
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
                              ? "bg-cyan-50/80 dark:bg-cyan-950/30 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                          data-testid={`link-${slugify(item.name)}`}
                          onMouseEnter={() => preloadOnHover(item.href)}
                          onMouseLeave={() => cancelHoverPreload(item.href)}
                          onClick={(e) => {
                            if (hasChildren) {
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
                            } else {
                              handleLinkClick();
                            }
                          }}
                        >
                          {/* Hover/Active indicator bar */}
                          <div className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full transition-opacity duration-150",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <Icon className={cn(
                            "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150",
                            isActive
                              ? "text-cyan-500"
                              : item.color || "text-muted-foreground/60"
                          )} />
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className={cn(
                              "font-medium truncate",
                              isActive ? "font-semibold" : ""
                            )}>
                              {item.name}
                            </span>
                            {hasChildren && (
                              <ChevronRight className={cn(
                                "h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground/40",
                                isExpanded && "rotate-90"
                              )} />
                            )}
                          </div>
                        </div>
                      </Link>

                      {hasChildren && isExpanded && (
                        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildActive = isRouteActive(child.href, location);

                            return (
                              <Link key={child.href} href={child.href}>
                                <div
                                  className={cn(
                                    "group relative flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                                    isChildActive
                                      ? "bg-cyan-50/80 dark:bg-cyan-950/30 text-foreground"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                  data-testid={`link-${slugify(child.name)}`}
                                  onClick={handleLinkClick}
                                >
                                  {/* Hover/Active indicator bar */}
                                  <div className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-r-full transition-opacity duration-150",
                                    isChildActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                  )} />
                                  <ChildIcon className={cn(
                                    "h-4 w-4 flex-shrink-0 transition-colors duration-150",
                                    isChildActive
                                      ? "text-cyan-500"
                                      : child.color || "text-muted-foreground/60 group-hover:text-cyan-500"
                                  )} />
                                  <span className={cn(
                                    "font-medium",
                                    isChildActive && "font-semibold"
                                  )}>{child.name}</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </nav>}

      {/* User info e logout - agganciato in basso */}
      {!isCollapsed && (
      <div className="px-2 py-3 mt-auto">
        <div className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="relative flex-shrink-0">
            <Avatar className="w-8 h-8 border-2 border-border shadow-sm">
              <AvatarImage src={user?.avatar || undefined} alt={user?.firstName} />
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {user?.role === 'consultant' ? 'Consulente' : 'Cliente'}
            </p>
          </div>
          {/* Action buttons - inline */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {role === "consultant" && (
              <Link href="/consultant/profile-settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Profilo"
                >
                  <UserCircle size={15} />
                </Button>
              </Link>
            )}
            {role === "client" && (
              <Link href="/client/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Impostazioni"
                  data-tour="client-user-settings"
                >
                  <Settings size={15} />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-muted"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={15} />
            </Button>
          </div>
        </div>

        {/* Role switcher se disponibile */}
        {showRoleSwitch && onRoleSwitch && (
          <div className="bg-muted/60 p-1 rounded-lg flex mt-2 mx-1">
            <Button
              variant={currentRole === "consultant" ? "default" : "ghost"}
              size="sm"
              onClick={() => onRoleSwitch("consultant")}
              className={cn(
                "flex-1 text-xs font-semibold",
                currentRole === "consultant" 
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600" 
                  : "hover:bg-muted"
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
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600" 
                  : "hover:bg-muted"
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
        <SheetContent
          side="left"
          className="w-[85vw] max-w-[320px] p-0 bg-background border-r border-border"
          style={{ animationDuration: "200ms" }}
          data-testid="sidebar-mobile"
          data-tour="client-sidebar"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{brandName}</SheetTitle>
          </SheetHeader>
          {/* Header minimale — logo + nome + close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})` }}
              >
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt={brandName} className="h-5 w-5 rounded" />
                ) : (
                  <Home className="text-white" size={14} />
                )}
              </div>
              <span
                className="font-bold text-base bg-clip-text text-transparent leading-tight"
                style={{ backgroundImage: `linear-gradient(to right, ${brandPrimaryColor}, ${brandSecondaryColor})` }}
              >
                {brandName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onClose}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="p-3 flex-1 h-[calc(100vh-4rem)] flex flex-col overflow-y-auto no-scrollbar">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop version
  return (
    <>
      {!isCollapsed && (
      <div 
        className="hidden md:flex flex-col bg-background border-r border-border p-4 transition-all duration-150 h-screen sticky top-0 w-72"
        data-testid="sidebar"
        data-tour="client-sidebar"
      >
        <SidebarContent />
      </div>
      )}
    </>
  );
}