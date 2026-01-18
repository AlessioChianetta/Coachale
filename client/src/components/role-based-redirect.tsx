
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAuthUser } from "@/lib/auth";

export default function RoleBasedRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const user = getAuthUser();
    
    if (user) {
      if (user.role === "super_admin") {
        setLocation("/admin");
      } else if (user.role === "consultant") {
        setLocation("/consultant");
      } else if (user.role === "client") {
        // Bronze/Silver users go to agent selection, Gold users go to client dashboard
        const userTier = (user as any).tier;
        if (userTier === "bronze" || userTier === "silver") {
          // Get publicSlug from localStorage (set during login)
          const publicSlug = localStorage.getItem('bronzePublicSlug');
          if (publicSlug) {
            setLocation(`/c/${publicSlug}/select-agent`);
          } else {
            // Fallback to client dashboard if no publicSlug
            setLocation("/client");
          }
        } else {
          setLocation("/client");
        }
      }
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
