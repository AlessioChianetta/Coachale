
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAuthUser } from "@/lib/auth";

export default function RoleBasedRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const user = getAuthUser();
    
    if (user) {
      if (user.role === "consultant") {
        setLocation("/consultant");
      } else if (user.role === "client") {
        setLocation("/client");
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
