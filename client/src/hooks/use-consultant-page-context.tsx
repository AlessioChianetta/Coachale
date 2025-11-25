import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";

export type ConsultantPageType = 
  | "whatsapp_config"
  | "whatsapp_conversations"
  | "whatsapp_templates"
  | "calendar_settings"
  | "calendar"
  | "clients_management"
  | "client_specific"
  | "campaigns"
  | "email_journey"
  | "email_logs"
  | "smtp_settings"
  | "api_settings"
  | "exercises_management"
  | "exercise_templates"
  | "library"
  | "university"
  | "tasks"
  | "consultations"
  | "ai_agents"
  | "ai_settings"
  | "dashboard"
  | "other";

export interface ConsultantPageContext {
  pageType: ConsultantPageType;
  resourceId?: string;
  resourceTitle?: string;
  additionalContext?: {
    clientId?: string;
    clientName?: string;
    conversationId?: string;
    templateId?: string;
    campaignId?: string;
    // WhatsApp specific
    activeConversations?: number;
    unreadMessages?: number;
    // Clients specific
    totalClients?: number;
    activeClients?: number;
    // Calendar specific
    todayAppointments?: number;
    upcomingAppointments?: number;
    // Campaigns specific
    activeCampaigns?: number;
    totalLeads?: number;
  };
}

interface UseConsultantPageContextOptions {
  clientId?: string;
  clientName?: string;
  conversationId?: string;
  templateId?: string;
  campaignId?: string;
}

/**
 * Hook per rilevare automaticamente il contesto della pagina consulente corrente
 * Rileva il tipo di pagina dal path e raccoglie dati contestuali rilevanti
 */
export function useConsultantPageContext(options: UseConsultantPageContextOptions = {}): ConsultantPageContext {
  const [location] = useLocation();
  const [context, setContext] = useState<ConsultantPageContext>({
    pageType: "other"
  });

  // Fetch WhatsApp stats for whatsapp pages
  const { data: whatsappStats } = useQuery({
    queryKey: ['/api/whatsapp/stats'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp/conversations/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: location.includes('/consultant/whatsapp'),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch clients stats for client pages
  const { data: clientsStats } = useQuery({
    queryKey: ['/api/consultant/clients/stats'],
    queryFn: async () => {
      const response = await fetch('/api/stats/consultant', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: location.includes('/consultant/clients') || location.includes('/consultant/client-'),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch calendar stats for calendar pages
  const { data: calendarStats } = useQuery({
    queryKey: ['/api/calendar/stats'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/events', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const events = await response.json();
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayEvents = events.filter((e: any) => {
        const eventDate = new Date(e.start);
        return eventDate >= today && eventDate < tomorrow;
      });
      
      const upcomingEvents = events.filter((e: any) => {
        const eventDate = new Date(e.start);
        return eventDate >= now;
      });
      
      return {
        todayAppointments: todayEvents.length,
        upcomingAppointments: upcomingEvents.length,
      };
    },
    enabled: location.includes('/consultant/calendar'),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch campaigns stats
  const { data: campaignsStats } = useQuery({
    queryKey: ['/api/campaigns/stats'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const campaigns = await response.json();
      
      const active = campaigns.filter((c: any) => c.status === 'active');
      
      return {
        activeCampaigns: active.length,
        totalCampaigns: campaigns.length,
      };
    },
    enabled: location.includes('/consultant/campaigns'),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const newContext: ConsultantPageContext = {
      pageType: "other"
    };

    // WhatsApp Configuration
    if (location === '/consultant/whatsapp' || location.startsWith('/consultant/whatsapp?')) {
      newContext.pageType = "whatsapp_config";
      if (whatsappStats) {
        newContext.additionalContext = {
          activeConversations: whatsappStats.activeConversations || 0,
          unreadMessages: whatsappStats.unreadMessages || 0,
        };
      }
    }
    // WhatsApp Conversations
    else if (location.includes('/consultant/whatsapp-conversations')) {
      newContext.pageType = "whatsapp_conversations";
      if (options.conversationId) {
        newContext.resourceId = options.conversationId;
      }
      if (whatsappStats) {
        newContext.additionalContext = {
          activeConversations: whatsappStats.activeConversations || 0,
          unreadMessages: whatsappStats.unreadMessages || 0,
        };
      }
    }
    // WhatsApp Templates
    else if (location.includes('/consultant/whatsapp-templates') || 
             location.includes('/consultant/whatsapp-custom-templates')) {
      newContext.pageType = "whatsapp_templates";
      if (options.templateId) {
        newContext.resourceId = options.templateId;
      }
    }
    // Calendar Settings
    else if (location === '/consultant/calendar-settings') {
      newContext.pageType = "calendar_settings";
      if (calendarStats) {
        newContext.additionalContext = {
          todayAppointments: calendarStats.todayAppointments,
          upcomingAppointments: calendarStats.upcomingAppointments,
        };
      }
    }
    // Calendar
    else if (location === '/consultant/calendar' || location === '/consultant/appointments') {
      newContext.pageType = "calendar";
      if (calendarStats) {
        newContext.additionalContext = {
          todayAppointments: calendarStats.todayAppointments,
          upcomingAppointments: calendarStats.upcomingAppointments,
        };
      }
    }
    // Clients Management
    else if (location === '/consultant/clients') {
      newContext.pageType = "clients_management";
      if (clientsStats) {
        newContext.additionalContext = {
          totalClients: clientsStats.totalClients || 0,
          activeClients: clientsStats.activeClients || 0,
        };
      }
    }
    // Client Specific Pages
    else if (location.includes('/consultant/client-')) {
      newContext.pageType = "client_specific";
      if (options.clientId) {
        newContext.resourceId = options.clientId;
        newContext.additionalContext = {
          clientId: options.clientId,
          clientName: options.clientName,
        };
      }
    }
    // Marketing Campaigns
    else if (location === '/consultant/campaigns') {
      newContext.pageType = "campaigns";
      if (campaignsStats) {
        newContext.additionalContext = {
          activeCampaigns: campaignsStats.activeCampaigns || 0,
        };
      }
      if (options.campaignId) {
        newContext.resourceId = options.campaignId;
      }
    }
    // Email Journey
    else if (location === '/consultant/email-journey') {
      newContext.pageType = "email_journey";
    }
    // Email Logs
    else if (location === '/consultant/email-logs') {
      newContext.pageType = "email_logs";
    }
    // SMTP Settings
    else if (location === '/consultant/smtp-settings') {
      newContext.pageType = "smtp_settings";
    }
    // API Settings
    else if (location === '/consultant/api-settings') {
      newContext.pageType = "api_settings";
    }
    // Exercises Management
    else if (location === '/consultant/exercises') {
      newContext.pageType = "exercises_management";
    }
    // Exercise Templates
    else if (location === '/consultant/exercise-templates') {
      newContext.pageType = "exercise_templates";
    }
    // Library
    else if (location === '/consultant/library') {
      newContext.pageType = "library";
    }
    // University
    else if (location === '/consultant/university') {
      newContext.pageType = "university";
    }
    // Tasks
    else if (location === '/consultant/tasks') {
      newContext.pageType = "tasks";
    }
    // AI Agents
    else if (location === '/consultant/ai-agents') {
      newContext.pageType = "ai_agents";
    }
    // AI Settings
    else if (location === '/consultant/ai-settings' || location === '/consultant/ai-config') {
      newContext.pageType = "ai_settings";
    }
    // Dashboard
    else if (location === '/consultant/dashboard' || location === '/consultant') {
      newContext.pageType = "dashboard";
    }

    setContext(newContext);
  }, [location, options.clientId, options.clientName, options.conversationId, 
      options.templateId, options.campaignId, whatsappStats, clientsStats, 
      calendarStats, campaignsStats]);

  return context;
}
