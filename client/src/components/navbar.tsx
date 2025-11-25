import { Menu, RotateCcw, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTour } from "@/contexts/TourContext";
import { getAuthUser } from "@/lib/auth";
import { useTheme } from "next-themes";

interface NavbarProps {
  onToggleSidebar?: () => void;
  showRoleSwitch?: boolean;
  onRoleSwitch?: (role: "consultant" | "client") => void;
  currentRole?: "consultant" | "client";
  onMenuClick?: () => void;
}

export default function Navbar({ onToggleSidebar, onMenuClick }: NavbarProps) {
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const { startTour } = useTour();
  const { theme, setTheme } = useTheme();
  const isClient = user?.role === "client";

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
      {isMobile && (onToggleSidebar || onMenuClick) && (
        <Button variant="ghost" size="icon" onClick={onToggleSidebar || onMenuClick}>
          <Menu size={20} />
        </Button>
      )}
      
      {!isMobile && <div />}
      
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 text-yellow-400" />
          ) : (
            <Moon className="h-5 w-5 text-gray-600" />
          )}
        </Button>

        {isClient && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={startTour}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden md:inline">Guida Interattiva</span>
          </Button>
        )}
      </div>
    </header>
  );
}