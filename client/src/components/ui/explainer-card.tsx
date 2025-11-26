import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface ExplainerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "info" | "success" | "warning";
}

const variantStyles = {
  info: {
    card: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100",
    icon: "text-blue-600",
    title: "text-blue-900",
    description: "text-blue-700",
  },
  success: {
    card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    description: "text-emerald-700",
  },
  warning: {
    card: "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100",
    icon: "text-orange-600",
    title: "text-orange-900",
    description: "text-orange-700",
  },
};

export function ExplainerCard({
  title,
  description,
  icon: Icon,
  variant = "info",
  className,
  ...props
}: ExplainerCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn("border-0 shadow-md", styles.card, className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base font-semibold">
          {Icon && <Icon className={cn("h-5 w-5", styles.icon)} />}
          <span className={styles.title}>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm leading-relaxed", styles.description)}>{description}</p>
      </CardContent>
    </Card>
  );
}
