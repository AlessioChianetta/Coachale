import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getAuthUser } from "@/lib/auth";

type AuthGuardProps = {
  children: ReactNode;
  requiredRole?: "consultant" | "client" | "super_admin";
  fallback?: ReactNode;
  blockTiers?: ("bronze" | "silver")[];
};

export default function AuthGuard({ children, requiredRole, fallback, blockTiers }: AuthGuardProps) {
  const [location, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState<"children" | "fallback" | "blocked" | "redirect">("redirect");

  useEffect(() => {
    if (!isAuthenticated()) {
      if (fallback) {
        setShouldRender("fallback");
      } else {
        setLocation("/login");
        setShouldRender("redirect");
      }
      setIsChecking(false);
      return;
    }

    const user = getAuthUser();

    if (requiredRole) {
      if (!user || user.role !== requiredRole) {
        setLocation("/login");
        setShouldRender("redirect");
        setIsChecking(false);
        return;
      }
    }

    if (blockTiers && user?.tier && blockTiers.includes(user.tier as "bronze" | "silver")) {
      const agentSlug = user.agentSlug || localStorage.getItem('agentSlug');
      if (agentSlug) {
        setLocation(`/agent/${agentSlug}/chat`);
        setShouldRender("redirect");
      } else {
        setShouldRender("blocked");
      }
      setIsChecking(false);
      return;
    }

    setShouldRender("children");
    setIsChecking(false);
  }, [fallback, requiredRole, blockTiers, setLocation]);

  if (isChecking) {
    return null;
  }

  if (shouldRender === "fallback") {
    return <>{fallback}</>;
  }

  if (shouldRender === "redirect") {
    return null;
  }

  if (shouldRender === "blocked") {
    const user = getAuthUser();
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Accesso non disponibile</h1>
          <p className="text-gray-600 mb-6">
            Il tuo piano ({user?.tier === "bronze" ? "Bronze" : "Silver"}) non ha accesso a questa sezione.
            Contatta il tuo consulente per maggiori informazioni.
          </p>
          <button 
            onClick={() => {
              localStorage.clear();
              setLocation("/login");
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
