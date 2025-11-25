import { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AgentHeroCardProps {
  agent: {
    id: string;
    name: string;
    description?: string;
    image?: string;
  };
  stats?: {
    conversationsCount?: number;
    appointmentsCount?: number;
    [key: string]: any;
  };
  actions?: ReactNode;
  onClick?: () => void;
}

export function AgentHeroCard({
  agent,
  stats,
  actions,
  onClick,
}: AgentHeroCardProps) {
  return (
    <Card
      className={cn(
        "w-full max-w-sm mx-auto transition-all duration-200 hover:shadow-xl",
        "relative overflow-hidden group",
        "before:absolute before:inset-0 before:rounded-lg before:p-[2px]",
        "before:bg-gradient-to-br before:from-purple-500 before:via-blue-500 before:to-pink-500",
        "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-200",
        "before:-z-10",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardHeader className="text-center space-y-4">
        {agent.image && (
          <div className="flex justify-center">
            <div className="relative w-[200px] h-[200px] rounded-lg overflow-hidden transition-transform duration-200 group-hover:scale-105">
              <img
                src={agent.image}
                alt={agent.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <CardTitle className="text-2xl font-bold">{agent.name}</CardTitle>
          {agent.description && (
            <CardDescription className="text-sm">
              {agent.description}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      {stats && (
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {stats.conversationsCount !== undefined && (
              <div className="text-center p-3 rounded-lg bg-muted/50 transition-colors duration-200 hover:bg-muted">
                <div className="text-2xl font-bold text-primary">
                  {stats.conversationsCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Conversazioni
                </div>
              </div>
            )}

            {stats.appointmentsCount !== undefined && (
              <div className="text-center p-3 rounded-lg bg-muted/50 transition-colors duration-200 hover:bg-muted">
                <div className="text-2xl font-bold text-primary">
                  {stats.appointmentsCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Appuntamenti
                </div>
              </div>
            )}

            {Object.entries(stats)
              .filter(
                ([key]) =>
                  key !== "conversationsCount" && key !== "appointmentsCount"
              )
              .map(([key, value]) => (
                <div
                  key={key}
                  className="text-center p-3 rounded-lg bg-muted/50 transition-colors duration-200 hover:bg-muted"
                >
                  <div className="text-2xl font-bold text-primary">
                    {String(value)}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      )}

      {actions && <CardFooter className="justify-center">{actions}</CardFooter>}
    </Card>
  );
}
