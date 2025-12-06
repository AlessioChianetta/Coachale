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
const ConsultantApiSettings = lazy(() => import("@/pages/consultant-api-settings"));
const ConsultantCalendarSettings = lazy(() => import("@/pages/consultant-calendar-settings"));
const ConsultantProfileSettings = lazy(() => import("@/pages/consultant-profile-settings"));
const ConsultantEmailJourney = lazy(() => import("@/pages/consultant-email-journey"));
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
const PublicAgentShare = lazy(() => import("@/pages/public-agent-share"));
const RealtimeTest = lazy(() => import("@/pages/realtime-test"));
const ClientSalesAgentsList = lazy(() => import("@/pages/client-sales-agents-list"));
const ClientSalesAgentConfig = lazy(() => import("@/pages/client-sales-agent-config"));
const ClientHumanSellersList = lazy(() => import("@/pages/client-human-sellers-list"));
const ClientHumanSellerConfig = lazy(() => import("@/pages/client-human-seller-config"));
const ClientHumanSellerMeetings = lazy(() => import("@/pages/client-human-seller-meetings"));
const ClientHumanSellerAnalytics = lazy(() => import("@/pages/client-human-seller-analytics"));
const ClientSalesAgentAnalytics = lazy(() => import("@/pages/client-sales-agent-analytics"));
const ClientScriptManager = lazy(() => import("@/pages/client-script-manager"));
const ScriptBuilder = lazy(() => import("@/pages/script-builder"));
const PublicSalesAgentLanding = lazy(() => import("@/pages/public-sales-agent-landing"));
const ConsultationInviteLobby = lazy(() => import("@/pages/consultation-invite-lobby"));
const ConsultationLobby = lazy(() => import("@/pages/consultation-lobby"));
const MeetGreenRoom = lazy(() => import("@/pages/meet-green-room"));
const MeetVideoRoom = lazy(() => import("@/pages/meet-video-room"));
const ClientVertexAIAnalytics = lazy(() => import("./pages/client-vertex-ai-analytics"));
const TrainingMapPage = lazy(() => import("@/pages/training-map"));

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

      <Route path="/consultant/campaigns">
        <AuthGuard requiredRole="consultant">
          <ConsultantCampaignsPage />
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

      <Route path="/consultant/settings">
        <AuthGuard requiredRole="consultant">
          <div className="min-h-screen bg-background">
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Impostazioni</h1>
                <p className="text-muted-foreground">Pagina in costruzione</p>
              </div>
            </div>
          </div>
        </AuthGuard>
      </Route>

      <Route path="/client">
        <AuthGuard requiredRole="client">
          <ClientDashboard />
        </AuthGuard>
      </Route>

      <Route path="/client/exercises">
        <AuthGuard requiredRole="client">
          <ClientExercises />
        </AuthGuard>
      </Route>

      <Route path="/client/consultations">
        <AuthGuard requiredRole="client">
          <ClientConsultations />
        </AuthGuard>
      </Route>

      <Route path="/client/roadmap">
        <AuthGuard requiredRole="client">
          <ClientRoadmap />
        </AuthGuard>
      </Route>

      <Route path="/client/library">
        <AuthGuard requiredRole="client">
          <ClientLibrary />
        </AuthGuard>
      </Route>

      <Route path="/client/library/:documentId">
        <AuthGuard requiredRole="client">
          <ClientLibraryDocument />
        </AuthGuard>
      </Route>

      <Route path="/client/daily-tasks">
        <AuthGuard requiredRole="client">
          <ClientDailyTasks />
        </AuthGuard>
      </Route>

      <Route path="/client/university">
        <AuthGuard requiredRole="client">
          <ClientUniversity />
        </AuthGuard>
      </Route>

      <Route path="/client/ai-assistant">
        <AuthGuard requiredRole="client">
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
        <AuthGuard requiredRole="client">
          <AIConsultationsHistory />
        </AuthGuard>
      </Route>

      <Route path="/client/settings">
        <AuthGuard requiredRole="client">
          <ClientSettings />
        </AuthGuard>
      </Route>

      <Route path="/client/calendar">
        <AuthGuard requiredRole="client">
          <ClientCalendar />
        </AuthGuard>
      </Route>

      <Route path="/client/sales-agents">
        <AuthGuard requiredRole="client">
          <ClientSalesAgentsList />
        </AuthGuard>
      </Route>

      <Route path="/client/human-sellers">
        <AuthGuard requiredRole="client">
          <ClientHumanSellersList />
        </AuthGuard>
      </Route>

      <Route path="/client/human-sellers/meetings">
        <AuthGuard requiredRole="client">
          <ClientHumanSellerMeetings />
        </AuthGuard>
      </Route>

      <Route path="/client/human-sellers/analytics">
        <AuthGuard requiredRole="client">
          <ClientHumanSellerAnalytics />
        </AuthGuard>
      </Route>

      <Route path="/client/human-sellers/:id">
        <AuthGuard requiredRole="client">
          <ClientHumanSellerConfig />
        </AuthGuard>
      </Route>

      <Route path="/client/sales-agents/:agentId/analytics">
        <AuthGuard requiredRole="client">
          <ClientSalesAgentAnalytics />
        </AuthGuard>
      </Route>

      <Route path="/client/sales-agents/:agentId/scripts">
        <AuthGuard requiredRole="client">
          <ClientScriptManager />
        </AuthGuard>
      </Route>

      <Route path="/client/scripts">
        <AuthGuard requiredRole="client">
          <ClientScriptManager />
        </AuthGuard>
      </Route>

      <Route path="/client/scripts/builder">
        <AuthGuard requiredRole="client">
          <ScriptBuilder />
        </AuthGuard>
      </Route>

      <Route path="/client/analytics/vertex-ai">
        <AuthGuard requiredRole="client">
          <ClientVertexAIAnalytics />
        </AuthGuard>
      </Route>

      <Route path="/client/sales-agents/:agentId">
        <AuthGuard requiredRole="client">
          <ClientSalesAgentConfig />
        </AuthGuard>
      </Route>

      <Route path="/training/:agentId/:conversationId">
        <AuthGuard requiredRole="client">
          <TrainingMapPage />
        </AuthGuard>
      </Route>

      <Route path="/client/faq" component={ClientFAQ} />

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
        <AuthGuard fallback={<Home />}>
          <RoleBasedRedirect />
        </AuthGuard>
      </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>

      {isClient && (
        <Suspense fallback={null}>
          <AIAssistant />
        </Suspense>
      )}
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
        <TourProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </TourProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;