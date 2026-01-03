import { lazy, Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageLoader } from "@/components/page-loader";
import AuthGuard from "@/components/auth-guard";
import RoleBasedRedirect from "@/components/role-based-redirect";
import { TourProvider } from "@/contexts/TourContext";
import { AlessiaSessionProvider } from "@/contexts/AlessiaSessionContext";
import { FloatingAlessiaChat } from "@/components/alessia/FloatingAlessiaChat";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import { getAuthUser } from "@/lib/auth";

// Lazy load heavy components
const AIAssistant = lazy(() => import("@/components/ai-assistant/AIAssistant").then(m => ({ default: m.AIAssistant })));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));

const Home = lazy(() => import("@/pages/home"));
const ConsultantLanding = lazy(() => import("@/pages/consultant-landing"));
const ConsultantDashboard = lazy(() => import("@/pages/consultant-dashboard"));
const ConsultantClientsPage = lazy(() => import("@/pages/consultant-clients"));
const ConsultantRoadmap = lazy(() => import("@/pages/consultant-roadmap"));
const ClientRoadmap = lazy(() => import("@/pages/client-roadmap"));
const ConsultantClientRoadmap = lazy(() => import("@/pages/consultant-client-roadmap"));
const ConsultantExercises = lazy(() => import("@/pages/consultant-exercises"));
const ConsultantTemplates = lazy(() => import("./pages/consultant-templates"));
const ConsultantExerciseTemplates = lazy(() => import("./pages/consultant-exercise-templates"));
const ConsultantLibrary = lazy(() => import("./pages/consultant-library"));
const ConsultantLibraryAIBuilder = lazy(() => import("./pages/consultant-library-ai-builder"));
const ClientLibrary = lazy(() => import("./pages/client-library"));
const ClientLibraryDocument = lazy(() => import("./pages/client-library-document"));
const ConsultantAppointments = lazy(() => import("@/pages/consultant-appointments"));
const ConsultantCalendar = lazy(() => import("@/pages/consultant-calendar"));
const ConsultantTasks = lazy(() => import("@/pages/consultant-tasks"));
const ConsultantUniversity = lazy(() => import("@/pages/consultant-university"));
const ConsultantClientDaily = lazy(() => import("@/pages/consultant-client-daily"));
const ConsultantSmtpSettings = lazy(() => import("@/pages/consultant-smtp-settings"));
const ConsultantEmailLogs = lazy(() => import("@/pages/consultant-email-logs"));
const ConsultantAiConfig = lazy(() => import("@/pages/consultant-ai-config"));
const ConsultantAIAssistant = lazy(() => import("@/pages/consultant-ai-assistant"));
const ConsultantAISettings = lazy(() => import("@/pages/consultant-ai-settings"));
const ConsultantFileSearchAnalytics = lazy(() => import("@/pages/consultant-file-search-analytics"));
const ConsultantApiKeysUnified = lazy(() => import("@/pages/consultant-api-keys-unified"));
const ConsultantClientState = lazy(() => import("@/pages/consultant-client-state"));
const ConsultantWhatsApp = lazy(() => import("@/pages/consultant-whatsapp"));
const ConsultantAIConsultations = lazy(() => import("@/pages/consultant-ai-consultations"));
const ConsultantWhatsAppConversations = lazy(() => import("@/pages/consultant-whatsapp-conversations"));
const ConsultantWhatsAppTemplates = lazy(() => import("@/pages/consultant-whatsapp-templates"));
const ConsultantWhatsAppCustomTemplates = lazy(() => import("@/pages/consultant-whatsapp-custom-templates"));
const ConsultantWhatsAppCustomTemplatesList = lazy(() => import("@/pages/consultant-whatsapp-custom-templates-list"));
const ConsultantWhatsAppAgentConfig = lazy(() => import("@/pages/consultant-whatsapp-agent-config"));
const ConsultantWhatsAppAgentsChat = lazy(() => import("@/pages/consultant-whatsapp-agents-chat"));
const ProactiveLeadsPage = lazy(() => import("@/pages/proactive-leads"));
const ConsultantCampaignsPage = lazy(() => import("@/pages/consultant-campaigns"));
const ConsultantAutomationsPage = lazy(() => import("@/pages/consultant-automations"));
const ConsultantLeadHub = lazy(() => import("@/pages/consultant-lead-hub"));
const ConsultantApiSettings = lazy(() => import("@/pages/consultant-api-settings"));
const ConsultantCalendarSettings = lazy(() => import("@/pages/consultant-calendar-settings"));
const ConsultantProfileSettings = lazy(() => import("@/pages/consultant-profile-settings"));
const ConsultantPricingSettings = lazy(() => import("@/pages/consultant-pricing-settings"));
const ConsultantEmailJourney = lazy(() => import("@/pages/consultant-email-journey"));
const ConsultantEchoDashboard = lazy(() => import("@/pages/consultant-echo-dashboard"));
const ConsultantKnowledgeDocuments = lazy(() => import("@/pages/consultant-knowledge-documents"));
const ConsultantKnowledgeApis = lazy(() => import("@/pages/consultant-knowledge-apis"));
const ClientUniversity = lazy(() => import("@/pages/client-university"));
const ClientDashboard = lazy(() => import("@/pages/client-dashboard"));
const ClientExercises = lazy(() => import("@/pages/client-exercises"));
const ClientConsultations = lazy(() => import("@/pages/client-consultations"));
const ClientDailyTasks = lazy(() => import("@/pages/client-daily-tasks"));
const ClientAIAssistant = lazy(() => import("@/pages/client-ai-assistant"));
const LiveConsultation = lazy(() => import("@/pages/live-consultation"));
const AIConsultationsHistory = lazy(() => import("@/pages/ai-consultations-history"));
const ClientSettings = lazy(() => import("@/pages/client-settings"));
const ClientFAQ = lazy(() => import("@/pages/client-faq"));
const ClientCalendar = lazy(() => import("@/pages/client-calendar"));
const ConsultationFathomViewer = lazy(() => import("@/pages/consultation-fathom-viewer"));
const ExerciseDetails = lazy(() => import("@/pages/exercise-details"));
const ExerciseMonitoring = lazy(() => import("./pages/exercise-monitoring"));
const NotFound = lazy(() => import("@/pages/not-found"));
const GuideWhatsApp = lazy(() => import("@/pages/guide-whatsapp"));
const GuideEmail = lazy(() => import("@/pages/guide-email"));
const GuideUniversity = lazy(() => import("@/pages/guide-university"));
const GuideClients = lazy(() => import("@/pages/guide-clients"));
const GuideCalendar = lazy(() => import("@/pages/guide-calendar"));
const GuideAutomations = lazy(() => import("@/pages/guide-automations"));
const GuideTemplates = lazy(() => import("@/pages/guide-templates"));
const GuideLeads = lazy(() => import("@/pages/guide-leads"));
const GuideAgents = lazy(() => import("@/pages/guide-agents"));
const GuideApiKeys = lazy(() => import("@/pages/guide-api-keys"));
const GuideInstagram = lazy(() => import("@/pages/guide-instagram"));
const GuidesHub = lazy(() => import("@/pages/guides-hub"));
const ConsultantSetupWizard = lazy(() => import("@/pages/consultant-setup-wizard"));
const OnboardingStory = lazy(() => import("@/pages/onboarding-story"));
const PublicAgentShare = lazy(() => import("@/pages/public-agent-share"));
const RealtimeTest = lazy(() => import("@/pages/realtime-test"));
const ClientSalesAgentsList = lazy(() => import("@/pages/client-sales-agents-list"));
const ClientSalesAgentConfig = lazy(() => import("@/pages/client-sales-agent-config"));
const ClientHumanSellersList = lazy(() => import("@/pages/client-human-sellers-list"));
const ClientHumanSellerConfig = lazy(() => import("@/pages/client-human-seller-config"));
const ClientHumanSellerMeetings = lazy(() => import("@/pages/client-human-seller-meetings"));
const ClientHumanSellerAnalytics = lazy(() => import("@/pages/client-human-seller-analytics"));
const ClientHumanSellersAnalyticsDashboard = lazy(() => import("@/pages/client-human-sellers-analytics-dashboard"));
const ClientSalesAgentAnalytics = lazy(() => import("@/pages/client-sales-agent-analytics"));
const ClientScriptManager = lazy(() => import("@/pages/client-script-manager"));
const ScriptBuilder = lazy(() => import("@/pages/script-builder"));
const PublicSalesAgentLanding = lazy(() => import("@/pages/public-sales-agent-landing"));
const ConsultationInviteLobby = lazy(() => import("@/pages/consultation-invite-lobby"));
const ConsultationLobby = lazy(() => import("@/pages/consultation-lobby"));
const MeetGreenRoom = lazy(() => import("@/pages/meet-green-room"));
const MeetVideoRoom = lazy(() => import("@/pages/meet-video-room"));
const ClientVertexAIAnalytics = lazy(() => import("./pages/client-vertex-ai-analytics"));
const ClientKnowledgeDocuments = lazy(() => import("./pages/client-knowledge-documents"));
const ClientKnowledgeApis = lazy(() => import("./pages/client-knowledge-apis"));
const ClientFileSearchDocuments = lazy(() => import("./pages/client-file-search-documents"));
const TrainingMapPage = lazy(() => import("@/pages/training-map"));
const ManagerLogin = lazy(() => import("@/pages/manager-login"));
const ManagerChat = lazy(() => import("@/pages/manager-chat"));
const PublicAIChat = lazy(() => import("@/pages/public-ai-chat"));
const PublicPricing = lazy(() => import("@/pages/public-pricing"));
const PricingSuccess = lazy(() => import("@/pages/pricing-success"));
const BronzeAuth = lazy(() => import("@/pages/bronze-auth"));
const SelectAgent = lazy(() => import("@/pages/select-agent"));

const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminHierarchy = lazy(() => import("@/pages/admin-hierarchy"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const SasLanding = lazy(() => import("@/pages/sas-landing"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));

function Router() {
  const user = getAuthUser();
  const isClient = user?.role === "client";
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Immediate redirects for moved pages
    if (location === "/consultant/calendar" || location === "/consultant/calendar-settings") {
      setLocation("/consultant/api-keys-unified?tab=calendar");
    } else if (location === "/consultant/ai-agents") {
      setLocation("/consultant/whatsapp?tab=system");
    }
  }, [location, setLocation]);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />

          {/* Public agent share - no auth required */}
          <Route path="/share/:slug" component={PublicAgentShare} />

          {/* Public Sales Agent Landing - no auth required */}
          <Route path="/s/:shareToken" component={PublicSalesAgentLanding} />

          {/* Public Consultation Invite Lobby - no auth required */}
          <Route path="/invite/:token" component={ConsultationInviteLobby} />

          {/* Public Meet Green Room - no auth required */}
          <Route path="/meet/:token" component={MeetGreenRoom} />

          {/* Public Video Room - no auth required */}
          <Route path="/meet/:token/room" component={MeetVideoRoom} />

          {/* Realtime test - WebSocket vs SSE */}
          <Route path="/realtime-test" component={RealtimeTest} />

          {/* SaaS Landing Page - no auth required */}
          <Route path="/Sas" component={SasLanding} />

          {/* Privacy Policy - no auth required (for Meta App Review) */}
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />

          {/* Manager Login - no auth required */}
          <Route path="/agent/:slug/login" component={ManagerLogin} />

          {/* Manager Chat - uses manager_token auth */}
          <Route path="/agent/:slug/chat" component={ManagerChat} />

          {/* Public AI Chat - no auth required (Level 1 agents) */}
          <Route path="/ai/:slug" component={PublicAIChat} />

          {/* Public Pricing Page - no auth required */}
          <Route path="/c/:slug/pricing" component={PublicPricing} />

          {/* Pricing Success Page - no auth required */}
          <Route path="/c/:slug/pricing/success" component={PricingSuccess} />

          {/* Bronze Auth Page - no auth required */}
          <Route path="/c/:slug/register" component={BronzeAuth} />

          {/* Agent Selection Page - no auth required (Bronze/Silver users) */}
          <Route path="/c/:slug/select-agent" component={SelectAgent} />

          <Route path="/consultant">
            <AuthGuard requiredRole="consultant">
              <ConsultantDashboard />
            </AuthGuard>
          </Route>

          <Route path="/consultant/clients">
            <AuthGuard requiredRole="consultant">
              <ConsultantClientsPage />
            </AuthGuard>
          </Route>

          <Route path="/consultant/roadmap">
            <AuthGuard requiredRole="consultant">
              <ConsultantRoadmap />
            </AuthGuard>
          </Route>

          <Route path="/consultant/client/:clientId/roadmap">
            <AuthGuard requiredRole="consultant">
              <ConsultantClientRoadmap />
            </AuthGuard>
          </Route>

          <Route path="/consultant/exercises">
            <AuthGuard requiredRole="consultant">
              <ConsultantExercises />
            </AuthGuard>
          </Route>

          <Route path="/consultant/templates">
            <AuthGuard requiredRole="consultant">
              <ConsultantTemplates />
            </AuthGuard>
          </Route>

          <Route path="/consultant/exercise-templates">
            <AuthGuard requiredRole="consultant">
              <ConsultantExerciseTemplates />
            </AuthGuard>
          </Route>

          <Route path="/consultant/library">
            <AuthGuard requiredRole="consultant">
              <ConsultantLibrary />
            </AuthGuard>
          </Route>

          <Route path="/consultant/library/ai-builder">
            <AuthGuard requiredRole="consultant">
              <ConsultantLibraryAIBuilder />
            </AuthGuard>
          </Route>

          <Route path="/consultant/monitoring">
            <AuthGuard requiredRole="consultant">
              <ExerciseMonitoring />
            </AuthGuard>
          </Route>

          <Route path="/consultant/client-daily">
            <AuthGuard requiredRole="consultant">
              <ConsultantClientDaily />
            </AuthGuard>
          </Route>

          <Route path="/consultant/analytics">
            <AuthGuard requiredRole="consultant">
              <div className="min-h-screen bg-background">
                <div className="flex items-center justify-center h-screen">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Analytics</h1>
                    <p className="text-muted-foreground">Pagina in costruzione</p>
                  </div>
                </div>
              </div>
            </AuthGuard>
          </Route>

          <Route path="/consultant/appointments">
            <AuthGuard requiredRole="consultant">
              <ConsultantAppointments />
            </AuthGuard>
          </Route>

          <Route path="/consultant/tasks">
            <AuthGuard requiredRole="consultant">
              <ConsultantTasks />
            </AuthGuard>
          </Route>

          <Route path="/consultant/university">
            <AuthGuard requiredRole="consultant">
              <ConsultantUniversity />
            </AuthGuard>
          </Route>

          <Route path="/consultant/smtp-settings">
            <AuthGuard requiredRole="consultant">
              <ConsultantSmtpSettings />
            </AuthGuard>
          </Route>

          <Route path="/consultant/email-logs">
            <AuthGuard requiredRole="consultant">
              <ConsultantEmailLogs />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsApp />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp/agent/:agentId">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppAgentConfig />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp-conversations">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppConversations />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp-templates">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppTemplates />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp/custom-templates/list">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppCustomTemplatesList />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp/custom-templates">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppCustomTemplates />
            </AuthGuard>
          </Route>

          <Route path="/consultant/whatsapp-agents-chat">
            <AuthGuard requiredRole="consultant">
              <ConsultantWhatsAppAgentsChat />
            </AuthGuard>
          </Route>

          <Route path="/consultant/proactive-leads">
            <AuthGuard requiredRole="consultant">
              <ProactiveLeadsPage />
            </AuthGuard>
          </Route>

          <Route path="/consultant/automations">
            <AuthGuard requiredRole="consultant">
              <ConsultantAutomationsPage />
            </AuthGuard>
          </Route>

          <Route path="/consultant/campaigns">
            <AuthGuard requiredRole="consultant">
              <ConsultantCampaignsPage />
            </AuthGuard>
          </Route>

          <Route path="/consultant/lead-hub">
            <AuthGuard requiredRole="consultant">
              <ConsultantLeadHub />
            </AuthGuard>
          </Route>

          <Route path="/consultant/api-settings">
            <AuthGuard requiredRole="consultant">
              <ConsultantApiSettings />
            </AuthGuard>
          </Route>

          <Route path="/consultant/profile-settings">
            <AuthGuard requiredRole="consultant">
              <ConsultantProfileSettings />
            </AuthGuard>
          </Route>

          <Route path="/consultant/ai-assistant">
            <AuthGuard requiredRole="consultant">
              <ConsultantAIAssistant />
            </AuthGuard>
          </Route>

          <Route path="/consultant/ai-settings">
            <AuthGuard requiredRole="consultant">
              <ConsultantAISettings />
            </AuthGuard>
          </Route>

          <Route path="/consultant/file-search-analytics">
            <AuthGuard requiredRole="consultant">
              <ConsultantFileSearchAnalytics />
            </AuthGuard>
          </Route>

          <Route path="/consultant/api-keys-unified">
            <AuthGuard requiredRole="consultant">
              <ConsultantApiKeysUnified />
            </AuthGuard>
          </Route>

          <Route path="/consultant/ai-config">
            <AuthGuard requiredRole="consultant">
              <ConsultantAiConfig />
            </AuthGuard>
          </Route>

          <Route path="/consultant/ai-consultations">
            <AuthGuard requiredRole="consultant">
              <ConsultantAIConsultations />
            </AuthGuard>
          </Route>

          <Route path="/consultant/client-state">
            <AuthGuard requiredRole="consultant">
              <ConsultantClientState />
            </AuthGuard>
          </Route>

          <Route path="/consultant/email-journey">
            <AuthGuard requiredRole="consultant">
              <ConsultantEmailJourney />
            </AuthGuard>
          </Route>

          <Route path="/consultant/echo-dashboard">
            <AuthGuard requiredRole="consultant">
              <ConsultantEchoDashboard />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-whatsapp">
            <AuthGuard requiredRole="consultant">
              <GuideWhatsApp />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-email">
            <AuthGuard requiredRole="consultant">
              <GuideEmail />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-university">
            <AuthGuard requiredRole="consultant">
              <GuideUniversity />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-clients">
            <AuthGuard requiredRole="consultant">
              <GuideClients />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-calendar">
            <AuthGuard requiredRole="consultant">
              <GuideCalendar />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-automations">
            <AuthGuard requiredRole="consultant">
              <GuideAutomations />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-templates">
            <AuthGuard requiredRole="consultant">
              <GuideTemplates />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-leads">
            <AuthGuard requiredRole="consultant">
              <GuideLeads />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-agents">
            <AuthGuard requiredRole="consultant">
              <GuideAgents />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-api-keys">
            <AuthGuard requiredRole="consultant">
              <GuideApiKeys />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guide-instagram">
            <AuthGuard requiredRole="consultant">
              <GuideInstagram />
            </AuthGuard>
          </Route>

          <Route path="/consultant/guides">
            <AuthGuard requiredRole="consultant">
              <GuidesHub />
            </AuthGuard>
          </Route>

          <Route path="/consultant/setup-wizard">
            <AuthGuard requiredRole="consultant">
              <ConsultantSetupWizard />
            </AuthGuard>
          </Route>

          <Route path="/consultant/onboarding-story">
            <AuthGuard requiredRole="consultant">
              <OnboardingStory />
            </AuthGuard>
          </Route>

          <Route path="/consultant/knowledge-documents">
            <AuthGuard requiredRole="consultant">
              <ConsultantKnowledgeDocuments />
            </AuthGuard>
          </Route>

          <Route path="/consultant/knowledge-apis">
            <AuthGuard requiredRole="consultant">
              <ConsultantKnowledgeApis />
            </AuthGuard>
          </Route>

          <Route path="/consultant/settings">
            <AuthGuard requiredRole="consultant">
              <ConsultantPricingSettings />
            </AuthGuard>
          </Route>

          <Route path="/client">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientDashboard />
            </AuthGuard>
          </Route>

          <Route path="/client/exercises">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientExercises />
            </AuthGuard>
          </Route>

          <Route path="/client/consultations">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientConsultations />
            </AuthGuard>
          </Route>

          <Route path="/client/roadmap">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientRoadmap />
            </AuthGuard>
          </Route>

          <Route path="/client/library">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientLibrary />
            </AuthGuard>
          </Route>

          <Route path="/client/library/:documentId">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientLibraryDocument />
            </AuthGuard>
          </Route>

          <Route path="/client/daily-tasks">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientDailyTasks />
            </AuthGuard>
          </Route>

          <Route path="/client/university">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientUniversity />
            </AuthGuard>
          </Route>

          <Route path="/client/ai-assistant">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientAIAssistant />
            </AuthGuard>
          </Route>

          <Route path="/consultation-lobby">
            <AuthGuard>
              <ConsultationLobby />
            </AuthGuard>
          </Route>

          <Route path="/live-consultation" component={LiveConsultation} />

          <Route path="/client/ai-consultations-history">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <AIConsultationsHistory />
            </AuthGuard>
          </Route>

          <Route path="/client/settings">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientSettings />
            </AuthGuard>
          </Route>

          <Route path="/client/calendar">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientCalendar />
            </AuthGuard>
          </Route>

          <Route path="/client/sales-agents">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientSalesAgentsList />
            </AuthGuard>
          </Route>

          <Route path="/client/human-sellers">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientHumanSellersList />
            </AuthGuard>
          </Route>

          <Route path="/client/human-sellers/analytics">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientHumanSellersAnalyticsDashboard />
            </AuthGuard>
          </Route>

          <Route path="/client/human-sellers/meetings">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientHumanSellerMeetings />
            </AuthGuard>
          </Route>

          <Route path="/client/human-sellers/:id/analytics">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientSalesAgentAnalytics />
            </AuthGuard>
          </Route>

          <Route path="/client/human-sellers/:id">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientHumanSellerConfig />
            </AuthGuard>
          </Route>

          <Route path="/client/sales-agents/:agentId/analytics">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientSalesAgentAnalytics />
            </AuthGuard>
          </Route>

          <Route path="/client/sales-agents/:agentId/scripts">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientScriptManager />
            </AuthGuard>
          </Route>

          <Route path="/client/scripts">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientScriptManager />
            </AuthGuard>
          </Route>

          <Route path="/client/scripts/builder">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ScriptBuilder />
            </AuthGuard>
          </Route>

          <Route path="/client/analytics/vertex-ai">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientVertexAIAnalytics />
            </AuthGuard>
          </Route>

          <Route path="/client/knowledge-documents">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientKnowledgeDocuments />
            </AuthGuard>
          </Route>

          <Route path="/client/knowledge-apis">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientKnowledgeApis />
            </AuthGuard>
          </Route>

          <Route path="/client/documents">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientFileSearchDocuments />
            </AuthGuard>
          </Route>

          <Route path="/client/sales-agents/:agentId">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <ClientSalesAgentConfig />
            </AuthGuard>
          </Route>

          <Route path="/training/:agentId/:conversationId">
            <AuthGuard requiredRole="client" blockTiers={["bronze", "silver"]}>
              <TrainingMapPage />
            </AuthGuard>
          </Route>

          <Route path="/client/faq" component={ClientFAQ} />

          {/* Super Admin Routes */}
          <Route path="/admin">
            <AuthGuard requiredRole="super_admin">
              <AdminDashboard />
            </AuthGuard>
          </Route>

          <Route path="/admin/hierarchy">
            <AuthGuard requiredRole="super_admin">
              <AdminHierarchy />
            </AuthGuard>
          </Route>

          <Route path="/admin/users">
            <AuthGuard requiredRole="super_admin">
              <AdminUsers />
            </AuthGuard>
          </Route>

          <Route path="/admin/settings">
            <AuthGuard requiredRole="super_admin">
              <AdminSettings />
            </AuthGuard>
          </Route>

          <Route path="/consultation/:id/fathom">
            <AuthGuard>
              <ConsultationFathomViewer />
            </AuthGuard>
          </Route>

          <Route path="/exercise/:id">
            <AuthGuard>
              <ExerciseDetails />
            </AuthGuard>
          </Route>

          <Route path="/consulenti">
            <AuthGuard fallback={<ConsultantLanding />}>
              <RoleBasedRedirect />
            </AuthGuard>
          </Route>

          <Route path="/">
            <AuthGuard fallback={<SasLanding />}>
              <RoleBasedRedirect />
            </AuthGuard>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>

      {isClient && !location.startsWith('/agent/') && (
        <Suspense fallback={null}>
          <AIAssistant />
        </Suspense>
      )}

      {isClient && !location.startsWith('/agent/') && <FloatingAlessiaChat />}
    </>
  );
}

function App() {
  const [location] = useLocation();
  const user = getAuthUser();
  const isPublicRoute = location.startsWith('/share/') || location.startsWith('/s/') || location.startsWith('/meet/') || location.startsWith('/live-consultation') || location === '/login' || location === '/register' || location === '/' || location === '/consulenti';

  // Only track activity for authenticated users on non-public routes
  const { logPageView } = useActivityTracker({ disabled: !user || isPublicRoute });

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="app-theme-mode">
      <QueryClientProvider client={queryClient}>
        <AlessiaSessionProvider>
          <TourProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </TourProvider>
        </AlessiaSessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;