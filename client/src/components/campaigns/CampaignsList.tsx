import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, BarChart3, Loader2, Megaphone, Target, Users, Zap, HandshakeIcon, StoreIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingCampaign } from "@db/schema";

interface CampaignsListProps {
  campaigns: MarketingCampaign[];
  isLoading?: boolean;
  onEdit: (campaign: MarketingCampaign) => void;
  onDelete: (campaign: MarketingCampaign) => void;
  onViewAnalytics: (campaign: MarketingCampaign) => void;
}

const campaignTypeIcons: Record<string, any> = {
  outbound_ads: Megaphone,
  inbound_form: Target,
  referral: Users,
  recovery: Zap,
  partner: HandshakeIcon,
  walk_in: StoreIcon,
};

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

export function CampaignsList({
  campaigns,
  isLoading,
  onEdit,
  onDelete,
  onViewAnalytics,
}: CampaignsListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<MarketingCampaign | null>(null);

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (typeFilter !== "all" && campaign.campaignType !== typeFilter) return false;
    if (statusFilter === "active" && !campaign.isActive) return false;
    if (statusFilter === "inactive" && campaign.isActive) return false;
    return true;
  });

  const handleDeleteClick = (campaign: MarketingCampaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      onDelete(campaignToDelete);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tipo Campagna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i Tipi</SelectItem>
              {Object.entries(campaignTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli Stati</SelectItem>
              <SelectItem value="active">Attive</SelectItem>
              <SelectItem value="inactive">Archiviate</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <div className="text-sm text-muted-foreground flex items-center">
            {filteredCampaigns.length} campagn{filteredCampaigns.length === 1 ? "a" : "e"}
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Campagna</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Lead Totali</TableHead>
                <TableHead className="text-right">Convertiti</TableHead>
                <TableHead className="text-right">Conv. Rate</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nessuna campagna trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const TypeIcon = campaignTypeIcons[campaign.campaignType];
                  const conversionRate = campaign.totalLeads > 0
                    ? ((campaign.convertedLeads / campaign.totalLeads) * 100).toFixed(1)
                    : "0.0";

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", campaignTypeColors[campaign.campaignType])}>
                          {TypeIcon && <TypeIcon className="h-3 w-3" />}
                          {campaignTypeLabels[campaign.campaignType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(leadCategoryColors[campaign.leadCategory])}>
                          {leadCategoryLabels[campaign.leadCategory]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {campaign.totalLeads}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {campaign.convertedLeads}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={campaign.isActive ? "default" : "secondary"}
                          className={
                            campaign.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : ""
                          }
                        >
                          {campaign.isActive ? "Attiva" : "Archiviata"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewAnalytics(campaign)}
                            title="Visualizza Analytics"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(campaign)}
                            title="Modifica"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(campaign)}
                            title="Elimina"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la campagna "{campaignToDelete?.campaignName}"?
              {campaignToDelete && campaignToDelete.totalLeads > 0 && (
                <span className="block mt-2 font-semibold text-yellow-600 dark:text-yellow-400">
                  ⚠️ Questa campagna ha {campaignToDelete.totalLeads} lead associati. La campagna
                  verrà archiviata invece che eliminata.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
