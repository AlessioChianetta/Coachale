import { useState, useEffect } from "react";
import { Menu, RotateCcw, User, Briefcase, Crown, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTour } from "@/contexts/TourContext";
import { getAuthUser, setToken, setAuthUser, getToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfileInfo {
  id: string;
  role: "consultant" | "client" | "super_admin";
  consultantId: string | null;
  consultantName?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isClient = user?.role === "client";
  
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

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
    
    fetchProfiles();
  }, []);

  const getProfileIcon = (role: string) => {
    switch (role) {
      case "consultant": return <Briefcase className="w-4 h-4" />;
      case "super_admin": return <Crown className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getProfileLabel = (profile: ProfileInfo) => {
    switch (profile.role) {
      case "consultant": return "Consulente";
      case "super_admin": return "Super Admin";
      case "client": return profile.consultantName ? `Cliente di ${profile.consultantName}` : "Cliente";
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (isSwitching) return;
    
    setIsSwitching(true);
    try {
      const token = getToken();
      const response = await fetch("/api/auth/select-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profileId, rememberChoice: false }),
      });

      if (!response.ok) {
        throw new Error("Errore nel cambio profilo");
      }

      const data = await response.json();
      setToken(data.token);
      setAuthUser(data.user);
      
      toast({
        title: "Profilo cambiato",
        description: `Ora sei in modalità ${data.user.role === 'consultant' ? 'Consulente' : data.user.role === 'super_admin' ? 'Super Admin' : 'Cliente'}`,
      });

      // Redirect based on new role
      if (data.user.role === "super_admin") {
        setLocation("/admin");
      } else if (data.user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
      
      // Force page refresh to reload all data
      window.location.reload();
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

  const currentProfileId = user?.profileId;
  const showProfileSwitcher = profiles.length > 1;

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
      {isMobile && (onToggleSidebar || onMenuClick) && (
        <Button variant="ghost" size="icon" onClick={onToggleSidebar || onMenuClick}>
          <Menu size={20} />
        </Button>
      )}
      
      {!isMobile && <div />}
      
      <div className="flex items-center gap-2">
        {/* Profile Switcher */}
        {showProfileSwitcher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isSwitching}>
                {getProfileIcon(user?.role || "client")}
                <span className="hidden md:inline">
                  {user?.role === "consultant" ? "Consulente" : user?.role === "super_admin" ? "Admin" : "Cliente"}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Cambia Profilo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => handleSwitchProfile(profile.id)}
                  className="cursor-pointer"
                  disabled={profile.id === currentProfileId || isSwitching}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getProfileIcon(profile.role)}
                    <span className="flex-1">{getProfileLabel(profile)}</span>
                    {profile.id === currentProfileId && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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