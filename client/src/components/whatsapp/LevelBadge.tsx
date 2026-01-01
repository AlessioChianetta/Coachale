import { cn } from "@/lib/utils";
import { Award, Shield, Star, Crown } from "lucide-react";

interface LevelBadgeProps {
  level: "1" | "2" | "3" | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const levelConfig = {
  "1": {
    label: "Livello 1",
    shortLabel: "L1",
    description: "Accesso pubblico con limite messaggi",
    icon: Award,
    colors: "bg-gradient-to-r from-amber-400 to-amber-600 text-white",
    borderColor: "border-amber-500",
    iconColor: "text-amber-200",
    metalName: "Bronzo"
  },
  "2": {
    label: "Livello 2",
    shortLabel: "L2",
    description: "Accesso clienti con knowledge base",
    icon: Shield,
    colors: "bg-gradient-to-r from-slate-400 to-slate-500 text-white",
    borderColor: "border-slate-400",
    iconColor: "text-slate-200",
    metalName: "Argento"
  },
  "3": {
    label: "Livello 3",
    shortLabel: "L3",
    description: "Accesso completo al software",
    icon: Crown,
    colors: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white shadow-lg",
    borderColor: "border-yellow-500",
    iconColor: "text-yellow-100",
    metalName: "Deluxe"
  }
};

export function LevelBadge({ level, size = "md", showLabel = true, className }: LevelBadgeProps) {
  if (!level) return null;
  
  const config = levelConfig[level];
  if (!config) return null;
  
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "h-5 px-1.5 text-[10px] gap-0.5",
    md: "h-6 px-2 text-xs gap-1",
    lg: "h-8 px-3 text-sm gap-1.5"
  };
  
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4"
  };
  
  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full font-semibold shadow-sm",
        config.colors,
        sizeClasses[size],
        className
      )}
      title={`${config.label} - ${config.description}`}
    >
      <Icon className={cn(iconSizes[size], config.iconColor)} />
      {showLabel && (
        <span>{config.metalName}</span>
      )}
    </div>
  );
}

export function LevelSelector({ 
  value, 
  onChange,
  disabled = false
}: { 
  value: "1" | "2" | "3" | null; 
  onChange: (level: "1" | "2" | "3" | null) => void;
  disabled?: boolean;
}) {
  const options = [
    { value: null, label: "Nessun Livello", description: "Agente standard senza accesso pubblico" },
    { value: "1" as const, label: "Livello 1 - Bronzo", description: "Accesso pubblico con limite messaggi giornaliero" },
    { value: "2" as const, label: "Livello 2 - Argento", description: "Accesso clienti con knowledge base (a pagamento)" },
    { value: "3" as const, label: "Livello 3 - Deluxe", description: "Accesso completo al software (premium)" }
  ];
  
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <button
          key={option.value ?? 'none'}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "w-full p-4 rounded-lg border-2 text-left transition-all",
            "hover:border-blue-300 hover:bg-blue-50/50",
            value === option.value 
              ? "border-blue-500 bg-blue-50" 
              : "border-slate-200 bg-white",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3">
            {option.value && <LevelBadge level={option.value} size="md" />}
            {!option.value && (
              <div className="h-6 px-2 text-xs inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                <Star className="w-3.5 h-3.5" />
                Standard
              </div>
            )}
            <div>
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="text-xs text-slate-500">{option.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export { levelConfig };
