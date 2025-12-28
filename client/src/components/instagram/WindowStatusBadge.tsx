import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface WindowStatusBadgeProps {
  isWindowOpen: boolean;
  windowExpiresAt: Date | string | null;
  className?: string;
}

export function WindowStatusBadge({ isWindowOpen, windowExpiresAt, className }: WindowStatusBadgeProps) {
  if (!windowExpiresAt) {
    return (
      <Badge variant="outline" className={cn("bg-slate-100 text-slate-600", className)}>
        <Clock className="h-3 w-3 mr-1" />
        Nessuna finestra
      </Badge>
    );
  }

  const expiresAt = new Date(windowExpiresAt);
  const now = new Date();
  const isActive = isWindowOpen && expiresAt > now;

  if (isActive) {
    const timeLeft = formatDistanceToNow(expiresAt, { locale: it, addSuffix: false });
    return (
      <Badge className={cn("bg-emerald-100 text-emerald-700 hover:bg-emerald-100", className)}>
        <CheckCircle className="h-3 w-3 mr-1" />
        Attiva · {timeLeft}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className={cn("bg-red-100 text-red-700 hover:bg-red-100", className)}>
      <XCircle className="h-3 w-3 mr-1" />
      Scaduta
    </Badge>
  );
}
