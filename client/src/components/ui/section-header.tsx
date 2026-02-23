import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SectionHeaderProps {
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  title: string;
  badge?: number | string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function SectionHeader({
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  title,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn("p-1.5 rounded-lg", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {badge !== undefined && badge !== 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 rounded-full font-semibold"
          >
            {badge}
          </Badge>
        )}
      </div>

      {action && (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 gap-1"
        >
          {action.label}
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
