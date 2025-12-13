import { useState, useEffect, useCallback } from "react";
import { getToken, setToken, setAuthUser, getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ProfileInfo {
  id: string;
  role: "consultant" | "client" | "super_admin";
  consultantId?: string | null;
  isDefault?: boolean;
  consultantName?: string;
}

export function useRoleSwitch() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getAuthUser();

  useEffect(() => {
    const fetchProfiles = async () => {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleRoleSwitch = useCallback(async (targetRole: "consultant" | "client") => {
    if (isSwitching || !user) return;

    const targetProfile = profiles.find(p => p.role === targetRole);
    if (!targetProfile) {
      toast({
        title: "Errore",
        description: `Profilo ${targetRole} non disponibile`,
        variant: "destructive",
      });
      return;
    }

    if (targetProfile.id === user.profileId) {
      return;
    }

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

      if (!response.ok) {
        throw new Error("Errore nel cambio profilo");
      }

      const data = await response.json();
      setToken(data.token);
      setAuthUser(data.user);

      toast({
        title: "Profilo cambiato",
        description: `Ora sei in modalità ${data.user.role === 'consultant' ? 'Consulente' : 'Cliente'}`,
      });

      if (data.user.role === "super_admin") {
        setLocation("/admin");
      } else if (data.user.role === "consultant") {
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
  }, [isSwitching, user, profiles, toast, setLocation]);

  const showRoleSwitch = profiles.length > 1;
  const currentRole = user?.role as "consultant" | "client" | undefined;

  return {
    profiles,
    isLoading,
    isSwitching,
    showRoleSwitch,
    currentRole,
    handleRoleSwitch,
  };
}
