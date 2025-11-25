import { ReactNode } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getAuthUser } from "@/lib/auth";

type AuthGuardProps = {
  children: ReactNode;
  requiredRole?: "consultant" | "client";
  fallback?: ReactNode;
};

export default function AuthGuard({ children, requiredRole, fallback }: AuthGuardProps) {
  const [, setLocation] = useLocation();

  if (!isAuthenticated()) {
    if (fallback) {
      return <>{fallback}</>;
    }
    setLocation("/login");
    return null;
  }

  if (requiredRole) {
    const user = getAuthUser();
    if (!user || user.role !== requiredRole) {
      setLocation("/login");
      return null;
    }
  }

  return <>{children}</>;
}