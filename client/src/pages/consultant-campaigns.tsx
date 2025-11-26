import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { CampaignsList } from "@/components/campaigns/CampaignsList";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import CampaignDetailAnalytics from "@/components/campaigns/CampaignDetailAnalytics";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
} from "@/hooks/useCampaigns";
import type { MarketingCampaign } from "@db/schema";

export default function ConsultantCampaignsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<MarketingCampaign | null>(null);

  const { data: campaignsData, isLoading } = useCampaigns();
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign(selectedCampaign?.id || "");
  const deleteMutation = useDeleteCampaign();

  const campaigns = campaignsData?.campaigns || [];

  const handleCreateCampaign = (data: any) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
      },
    });
  };

  const handleUpdateCampaign = (data: any) => {
    if (selectedCampaign) {
      updateMutation.mutate(data, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setSelectedCampaign(null);
        },
      });
    }
  };

  const handleEditClick = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setIsEditDialogOpen(true);
  };

  const handleDeleteCampaign = (campaign: MarketingCampaign) => {
    deleteMutation.mutate(campaign.id);
  };

  const handleViewAnalytics = (campaign: MarketingCampaign) => {
    setAnalyticsCampaign(campaign);
    setIsAnalyticsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Campagne Marketing
                </h1>
                <p className="text-muted-foreground mt-2">
                  Gestisci le tue campagne di marketing e lead generation
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Nuova Campagna
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                <CampaignsList
                  campaigns={campaigns}
                  isLoading={isLoading}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteCampaign}
                  onViewAnalytics={handleViewAnalytics}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Nuova Campagna</DialogTitle>
            <DialogDescription>
              Configura una nuova campagna di marketing per i tuoi lead
            </DialogDescription>
          </DialogHeader>
          <CampaignForm
            onSubmit={handleCreateCampaign}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Campagna</DialogTitle>
            <DialogDescription>
              Aggiorna le impostazioni della campagna
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <CampaignForm
              initialData={selectedCampaign}
              onSubmit={handleUpdateCampaign}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={isAnalyticsDialogOpen} onOpenChange={setIsAnalyticsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics Campagna</DialogTitle>
            <DialogDescription>
              Visualizza le metriche e le performance della campagna
            </DialogDescription>
          </DialogHeader>
          {analyticsCampaign && (
            <CampaignDetailAnalytics
              campaignId={analyticsCampaign.id}
              campaignName={analyticsCampaign.campaignName}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}
