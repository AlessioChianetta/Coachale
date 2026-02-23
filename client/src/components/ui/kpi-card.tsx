import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  delta?: string;
  deltaPositive?: boolean;
  onClick?: () => void;
  className?: string;
  pulse?: boolean;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  delta,
  deltaPositive,
  onClick,
  className,
  pulse = false,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "flat-card p-4 sm:p-5 flex flex-col gap-3 transition-colors duration-200",
        onClick && "cursor-pointer hover:bg-muted/30 active:scale-[0.98]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center justify-between">
        <p className="section-label">{title}</p>
        <div className={cn("p-2 rounded-xl", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>

      <p
        className={cn(
          "text-3xl sm:text-4xl font-bold text-foreground tracking-tight",
          pulse && "animate-pulse"
        )}
        style={pulse ? { animationDuration: "3s" } : undefined}
      >
        {value}
      </p>

      {delta && (
        <div
          className={cn(
            "flex items-center gap-1 text-sm font-medium",
            deltaPositive ? "text-emerald-500" : "text-destructive"
          )}
        >
          {deltaPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
