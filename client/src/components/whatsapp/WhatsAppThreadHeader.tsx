import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppThreadHeaderProps {
  conversation: {
    phoneNumber: string;
    isLead: boolean;
    agentName: string;
    aiEnabled: boolean;
    isDryRun: boolean;
    testModeOverride?: "client" | "lead" | "consulente" | null;
    metadata?: {
      participantType?: "consultant" | "client" | "receptionist" | "unknown";
      participantRole?: string;
      participantUserId?: string;
    } | null;
  };
  onToggleAI?: () => void;
  onReset?: () => void;
  onDelete?: () => void;
}

export function WhatsAppThreadHeader({
  conversation,
  onToggleAI,
  onReset,
  onDelete,
}: WhatsAppThreadHeaderProps) {
  const getInitials = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, "");
    return digits.slice(-2) || "??";
  };

  // Badge resolution with priority: testModeOverride > metadata.participantType > isLead
  const getBadgeInfo = () => {
    // Priority 1: testModeOverride (manual override)
    if (conversation.testModeOverride === "consulente") {
      return {
        label: "Consulente",
        className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200"
      };
    }
    if (conversation.testModeOverride === "lead") {
      return {
        label: "Lead",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
      };
    }
    if (conversation.testModeOverride === "client") {
      return {
        label: "Cliente",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      };
    }

    // Priority 2: metadata.participantType (auto-detected from DB)
    const participantType = conversation.metadata?.participantType;
    if (participantType === "consultant") {
      return {
        label: "Consulente",
        className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200"
      };
    }
    if (participantType === "receptionist") {
      return {
        label: "Receptionist",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      };
    }
    if (participantType === "client") {
      return {
        label: "Cliente",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      };
    }
    if (participantType === "unknown") {
      return {
        label: "Lead",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
      };
    }

    // Priority 3: isLead fallback (legacy logic)
    if (conversation.isLead) {
      return {
        label: "Lead",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
      };
    }

    // Default: Cliente
    return {
      label: "Cliente",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    };
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {getInitials(conversation.phoneNumber)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg">
              {conversation.phoneNumber}
            </span>

            <Badge className={cn("text-xs", badgeInfo.className)}>
              {badgeInfo.label}
            </Badge>

            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {conversation.agentName}
            </Badge>

            <Badge
              className={cn(
                "text-xs",
                conversation.aiEnabled
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              )}
            >
              AI {conversation.aiEnabled ? "Attivo" : "Inattivo"}
            </Badge>

            {conversation.isDryRun && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                Dry Run
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        {onToggleAI && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="ai-toggle"
              className="text-sm font-medium hidden sm:block"
            >
              AI
            </label>
            <Switch
              id="ai-toggle"
              checked={conversation.aiEnabled}
              onCheckedChange={onToggleAI}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {onReset && (
            <Button
              variant="outline"
              size="icon"
              onClick={onReset}
              className="transition-all duration-200 hover:bg-accent"
              title="Reset conversazione"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          {onDelete && (
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
              title="Elimina conversazione"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
