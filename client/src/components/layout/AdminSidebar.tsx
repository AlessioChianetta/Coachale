import { cn, slugify } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuthUser, logout } from "@/lib/auth";
import { useState } from "react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  color?: string;
}

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const adminItems: SidebarItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, color: "text-blue-500" },
  { name: "Gerarchia", href: "/admin/hierarchy", icon: GitBranch, color: "text-purple-500" },
  { name: "Utenti", href: "/admin/users", icon: Users, color: "text-green-500" },
  { name: "Impostazioni", href: "/admin/settings", icon: Settings, color: "text-orange-500" },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const user = getAuthUser();

  const isRouteActive = (href: string, currentLocation: string) => {
    if (href === "/admin") {
      return currentLocation === href;
    }
    return currentLocation === href || 
      currentLocation.startsWith(href + '/') || 
      currentLocation.startsWith(href + '?');
  };

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {!isCollapsed && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                Super Admin
              </h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                System Control
              </p>
            </div>
          </div>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title="Riduci sidebar"
            >
              <ChevronLeft size={16} />
            </Button>
          )}
        </div>
      )}

      {!isCollapsed && (
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = isRouteActive(item.href, location);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-red-50/80 dark:bg-red-950/30 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                  )}
                  data-testid={`link-${slugify(item.name)}`}
                  onClick={handleLinkClick}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-red-500 rounded-r-full" />
                  )}
                  <Icon className={cn(
                    "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150",
                    isActive ? "text-red-500" : item.color || "text-gray-400 dark:text-gray-500"
                  )} />
                  <span className={cn("font-medium truncate", isActive ? "font-semibold" : "")}>
                    {item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}

      {isCollapsed && (
        <nav className="space-y-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-10"
            onClick={() => setIsCollapsed(false)}
            title="Espandi sidebar"
          >
            <ChevronRight size={16} />
          </Button>
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = isRouteActive(item.href, location);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-red-50/80 dark:bg-red-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  )}
                  title={item.name}
                  onClick={handleLinkClick}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-red-500" : item.color || "text-gray-400"
                  )} />
                </div>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full justify-start gap-2 text-gray-600 dark:text-gray-400",
            isCollapsed && "justify-center"
          )}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {!isCollapsed && (theme === "dark" ? "Tema Chiaro" : "Tema Scuro")}
        </Button>

        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-white text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Super Admin
              </p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut size={16} />
          {!isCollapsed && "Esci"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className={cn(
      "sticky top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 transition-all duration-200",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <SidebarContent />
    </aside>
  );
}
