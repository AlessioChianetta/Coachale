import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Target,
  TrendingUp,
  Edit,
  Trash2,
  BarChart3,
  Megaphone,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingCampaign } from "@db/schema";

interface CampaignCardHubProps {
  campaigns: MarketingCampaign[];
  isLoading?: boolean;
  onEdit: (campaign: MarketingCampaign) => void;
  onDelete: (campaignId: string) => void;
  onViewAnalytics: (campaign: MarketingCampaign) => void;
  onCreateCampaign?: () => void;
}

const campaignTypeLabels: Record<string, string> = {
  outbound_ads: "Pubblicità",
  inbound_form: "Form Inbound",
  referral: "Referral",
  recovery: "Recupero",
  partner: "Partner",
  walk_in: "Walk-In",
};

const campaignTypeColors: Record<string, string> = {
  outbound_ads: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  inbound_form: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  referral: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  recovery: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  partner: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  walk_in: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

const campaignTypeGradients: Record<string, string> = {
  outbound_ads: "from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10",
  inbound_form: "from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10",
  referral: "from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10",
  recovery: "from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10",
  partner: "from-pink-50 to-pink-100/50 dark:from-pink-950/20 dark:to-pink-900/10",
  walk_in: "from-cyan-50 to-cyan-100/50 dark:from-cyan-950/20 dark:to-cyan-900/10",
};

const leadCategoryLabels: Record<string, string> = {
  freddo: "Freddo",
  tiepido: "Tiepido",
  caldo: "Caldo",
  recupero: "Recupero",
  referral: "Referral",
};

const leadCategoryColors: Record<string, string> = {
  freddo: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  tiepido: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  caldo: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  recupero: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  referral: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function CampaignCardHub({
  campaigns,
  isLoading,
  onEdit,
  onDelete,
  onViewAnalytics,
  onCreateCampaign,
}: CampaignCardHubProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Megaphone className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nessuna campagna</h3>
        <p className="text-muted-foreground mb-4 max-w-sm">
          Non hai ancora creato nessuna campagna marketing. Inizia a tracciare le tue fonti di lead.
        </p>
        <Button onClick={onCreateCampaign}>
          <Plus className="h-4 w-4 mr-2" />
          Crea la tua prima campagna
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map((campaign) => {
        const conversionRate =
          campaign.totalLeads > 0
            ? ((campaign.convertedLeads / campaign.totalLeads) * 100).toFixed(1)
            : "0.0";

        const hookFirstLine = campaign.hookText
          ? campaign.hookText.split("\n")[0].slice(0, 80)
          : null;

        return (
          <Card
            key={campaign.id}
            className={cn(
              "group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
              "bg-gradient-to-br",
              campaignTypeGradients[campaign.campaignType],
              campaign.isActive
                ? "border-l-4 border-l-green-500"
                : "border-l-4 border-l-gray-400"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold line-clamp-1">
                  {campaign.campaignName}
                </CardTitle>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge
                    variant={campaign.isActive ? "default" : "secondary"}
                    className={cn(
                      "text-xs",
                      campaign.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : ""
                    )}
                  >
                    {campaign.isActive ? "Attiva" : "Inattiva"}
                  </Badge>
                </div>
              </div>
              <Badge
                className={cn(
                  "w-fit text-xs mt-1",
                  campaignTypeColors[campaign.campaignType]
                )}
              >
                {campaignTypeLabels[campaign.campaignType]}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              {hookFirstLine && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Uncino</p>
                  <p className="text-sm truncate" title={campaign.hookText || ""}>
                    {hookFirstLine}
                    {campaign.hookText && campaign.hookText.length > 80 && "..."}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Categoria Lead</p>
                <Badge
                  className={cn("text-xs", leadCategoryColors[campaign.leadCategory])}
                >
                  {leadCategoryLabels[campaign.leadCategory]}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{campaign.totalLeads}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{campaign.convertedLeads}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp
                    className={cn(
                      "h-4 w-4",
                      parseFloat(conversionRate) >= 20
                        ? "text-green-600 dark:text-green-400"
                        : parseFloat(conversionRate) >= 10
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      parseFloat(conversionRate) >= 20
                        ? "text-green-600 dark:text-green-400"
                        : parseFloat(conversionRate) >= 10
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {conversionRate}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewAnalytics(campaign)}
                  title="Visualizza Analytics"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(campaign)}
                  title="Modifica"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(campaign.id)}
                  title="Elimina"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
