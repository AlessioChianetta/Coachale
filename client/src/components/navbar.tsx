import { useState, useEffect } from "react";
import { Menu, RotateCcw, Briefcase, Crown, ChevronDown, Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/contexts/TourContext";
import { getAuthUser, setToken, setAuthUser, getToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/contexts/BrandContext";
import { BookOpen } from "lucide-react";
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
  const user = getAuthUser();
  const { startTour } = useTour();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { brandName, brandLogoUrl, brandPrimaryColor, brandSecondaryColor } = useBrandContext();
  const isClient = user?.role === "client";

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
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

      if (!response.ok) throw new Error("Errore nel cambio profilo");

      const data = await response.json();
      setToken(data.token);
      setAuthUser(data.user);

      toast({
        title: "Profilo cambiato",
        description: `Ora sei in modalità ${data.user.role === "consultant" ? "Consulente" : data.user.role === "super_admin" ? "Super Admin" : "Cliente"}`,
      });

      if (data.user.role === "super_admin") {
        setLocation("/admin");
      } else if (data.user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
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

  const userInitials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "U";

  return (
    <header className="h-14 bg-background/98 backdrop-blur-sm border-b border-border/50 flex items-center justify-between px-3 z-50">
      {/* Sinistra: hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
        onClick={onToggleSidebar || onMenuClick}
        aria-label="Apri menu"
      >
        <Menu size={20} />
      </Button>

      {/* Centro: brand logo + nome */}
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})` }}
        >
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt={brandName} className="h-4 w-4 rounded object-contain" />
          ) : (
            <BookOpen className="text-white" size={13} />
          )}
        </div>
        <span
          className="font-bold text-sm bg-clip-text text-transparent leading-tight max-w-[140px] truncate"
          style={{ backgroundImage: `linear-gradient(to right, ${brandPrimaryColor}, ${brandSecondaryColor})` }}
        >
          {brandName}
        </span>
      </div>

      {/* Destra: tour + profili + avatar */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isClient && (
          <Button
            variant="ghost"
            size="icon"
            onClick={startTour}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Guida interattiva"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}

        {showProfileSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-9 px-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                disabled={isSwitching}
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {userInitials}
                </div>
                <ChevronDown className="h-3 w-3" />
              </button>
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
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {userInitials}
          </div>
        )}
      </div>
    </header>
  );
}
