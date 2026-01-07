import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3,
  FileSearch,
  RefreshCw,
  Database,
  FileText,
  Zap,
  TrendingUp,
  Clock,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Quote,
  MessageSquare,
  Bot,
  Users,
  BookOpen,
  Timer,
  AlertTriangle,
  Activity,
  Sparkles,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  User,
  GraduationCap,
  Brain,
  Folder,
  Plus,
  AlertCircle,
  ClipboardCheck,
  Wallet,
  Trash2,
  Target,
  Heart,
  Mail,
  Link,
  History,
  CalendarClock,
  Share2,
  CheckSquare,
  ListTodo,
  BookMarked,
  Eye,
  Crown
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface FileSearchSettings {
  id: string;
  consultantId: string;
  enabled: boolean;
  autoSyncLibrary: boolean;
  autoSyncKnowledgeBase: boolean;
  autoSyncExercises: boolean;
  autoSyncConsultations: boolean;
  autoSyncUniversity: boolean;
  autoSyncClientKnowledge: boolean;
  autoSyncExerciseResponses: boolean;
  autoSyncFinancial: boolean;
  autoSyncWhatsappAgents: boolean;
  autoSyncConsultantGuides: boolean;
  autoSyncGoals: boolean;
  autoSyncTasks: boolean;
  autoSyncDailyReflections: boolean;
  autoSyncClientProgress: boolean;
  autoSyncLibraryProgress: boolean;
  autoSyncEmailJourney: boolean;
  autoSyncAssignedExercises: boolean;
  autoSyncAssignedLibrary: boolean;
  autoSyncAssignedUniversity: boolean;
  autoSyncExerciseExternalDocs: boolean;
  scheduledSyncEnabled: boolean;
  scheduledSyncHour: number;
  lastScheduledSync: string | null;
  lastSyncAt: string | null;
  totalDocumentsSynced: number;
  totalUsageCount: number;
}

interface SyncedDocument {
  id: string;
  googleFileId: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  sourceType: 'library' | 'knowledge_base' | 'manual' | 'exercise' | 'consultation' | 'university' | 'consultant_guide' | 'exercise_external_doc';
  sourceId: string | null;
  uploadedAt: string;
  storeDisplayName?: string;
  clientId?: string | null;
}

interface HierarchicalData {
  consultantStore: {
    storeId: string;
    storeName: string;
    documents: {
      library: SyncedDocument[];
      knowledgeBase: SyncedDocument[];
      exercises: SyncedDocument[];
      university: SyncedDocument[];
      consultantGuide: SyncedDocument[];
      other: SyncedDocument[];
    };
    totals: {
      library: number;
      knowledgeBase: number;
      exercises: number;
      university: number;
      consultantGuide: number;
    };
  };
  clientStores: Array<{
    clientId: string;
    clientName: string;
    clientEmail: string;
    storeId: string | null;
    storeName: string | null;
    hasStore: boolean;
    hasDocuments: boolean;
    documents: {
      exerciseResponses: SyncedDocument[];
      consultationNotes: SyncedDocument[];
      knowledgeBase: SyncedDocument[];
      goals: SyncedDocument[];
      tasks: SyncedDocument[];
      dailyReflections: SyncedDocument[];
      clientProgressHistory: SyncedDocument[];
      libraryProgress: SyncedDocument[];
      emailJourneyProgress: SyncedDocument[];
      assignedExercises: SyncedDocument[];
      assignedLibrary: SyncedDocument[];
      assignedUniversity: SyncedDocument[];
      externalDocs: SyncedDocument[];
    };
    totals: {
      exerciseResponses: number;
      consultationNotes: number;
      knowledgeBase: number;
      goals: number;
      tasks: number;
      dailyReflections: number;
      clientProgressHistory: number;
      libraryProgress: number;
      emailJourneyProgress: number;
      assignedExercises: number;
      assignedLibrary: number;
      assignedUniversity: number;
      externalDocs: number;
      total: number;
    };
    potentialContent: {
      exerciseResponses: boolean;
      consultationNotes: boolean;
      knowledgeBase: boolean;
    };
  }>;
}

interface AnalyticsData {
  summary: {
    totalCalls: number;
    fileSearchCalls: number;
    classicRagCalls: number;
    fileSearchPercentage: number;
    totalTokensSaved: number;
    totalCitations: number;
    avgResponseTimeMs: number;
    totalStores: number;
    totalDocuments: number;
  };
  dailyStats: Array<{
    date: string;
    fileSearchCalls: number;
    classicRagCalls: number;
    tokensSaved: number;
    citations: number;
  }>;
  providerStats: Record<string, number>;
  stores: Array<{
    id: string;
    displayName: string;
    documentCount: number;
    isActive: boolean;
    createdAt: string;
  }>;
  recentLogs: Array<{
    id: string;
    requestType: string;
    usedFileSearch: boolean;
    providerUsed: string;
    storeCount: number;
    citationsCount: number;
    tokensSaved: number;
    responseTimeMs: number;
    createdAt: string;
  }>;
  documents: SyncedDocument[];
  hierarchicalData?: HierarchicalData;
  geminiApiKeyConfigured: boolean;
}

interface OutdatedDocument {
  id: string;
  title: string;
  indexedAt: string;
  sourceUpdatedAt: string;
  type?: string;
  lessonTitle?: string;
}

interface AuditData {
  consultant: {
    library: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string; type: string }>;
      outdated?: OutdatedDocument[];
    };
    knowledgeBase: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string }>;
      outdated?: OutdatedDocument[];
    };
    exercises: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string }>;
      outdated?: OutdatedDocument[];
    };
    university: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string; lessonTitle: string }>;
      outdated?: OutdatedDocument[];
    };
    consultantGuide?: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string }>;
      outdated?: OutdatedDocument[];
    };
  };
  clients: Array<{
    clientId: string;
    clientName: string;
    clientEmail: string;
    exerciseResponses: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; exerciseTitle: string; submittedAt: string | null }>;
    };
    consultationNotes: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; date: string; summary: string }>;
    };
    knowledgeDocs: {
      total: number;
      indexed: number;
      missing: Array<{ id: string; title: string }>;
    };
  }>;
  summary: {
    totalMissing: number;
    consultantMissing: number;
    clientsMissing: number;
    healthScore: number;
    totalOutdated?: number;
    consultantOutdated?: number;
    clientsOutdated?: number;
  };
  recommendations: string[];
}

interface SourceOrphan {
  id: string;
  fileName: string;
  googleFileId: string;
  sourceType: string;
  sourceId: string | null;
}

interface SourceOrphansData {
  success: boolean;
  orphans: SourceOrphan[];
  count: number;
  message?: string;
}

interface ClientFileSearchStatus {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fileSearchEnabled: boolean | null;
  isActive: boolean;
}

interface MissingExternalDoc {
  assignmentId: string;
  exerciseId: string;
  exerciseTitle: string;
  workPlatformUrl: string;
  isPersonalized: boolean;
  assignedAt: string;
}

interface MissingExternalDocsClient {
  clientId: string;
  clientName: string;
  missingDocs: MissingExternalDoc[];
  count: number;
}

interface MissingExternalDocsData {
  totalMissing: number;
  clientsWithMissing: number;
  byClient: MissingExternalDocsClient[];
}

interface CategoryDetail {
  name: string;
  processed: number;
  synced: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

interface SyncReport {
  id: string;
  consultantId: string;
  syncType: 'manual' | 'scheduled';
  status: 'running' | 'completed' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalProcessed: number;
  totalSynced: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  categoryDetails: Record<string, CategoryDetail> | null;
  clientDetails: { clientsProcessed?: number } | null;
  errors: string[] | null;
  healthScoreBefore: number | null;
  healthScoreAfter: number | null;
  createdAt: string;
}

interface SyncReportsResponse {
  reports: SyncReport[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ManagerMemoryAudit {
  subscriptionId: string;
  email: string;
  firstName: string | null;
  tier: string;
  totalDays: number;
  existingSummaries: number;
  missingDays: number;
  status: 'complete' | 'partial' | 'empty';
  agentAccessEnabled: boolean;
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

interface SyncLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'progress' | 'success' | 'error' | 'complete';
  message: string;
  category?: string;
  current?: number;
  total?: number;
  // Hierarchical context for improved logging display
  storeType?: 'consultant' | 'client';
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  documentTitle?: string;
  status?: 'synced' | 'updated' | 'skipped' | 'error';
}

interface CategoryProgress {
  current: number;
  total: number;
  status: 'waiting' | 'syncing' | 'complete' | 'error';
  lastItem?: string;
  synced?: number;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  library: { label: 'Libreria', icon: '📚', color: 'bg-blue-500' },
  knowledge_base: { label: 'Knowledge Base', icon: '📖', color: 'bg-purple-500' },
  exercises: { label: 'Esercizi', icon: '🏋️', color: 'bg-green-500' },
  university: { label: 'University', icon: '🎓', color: 'bg-amber-500' },
  consultations: { label: 'Consultazioni', icon: '📞', color: 'bg-pink-500' },
  whatsapp_agents: { label: 'Agenti WhatsApp', icon: '📱', color: 'bg-emerald-500' },
  exercise_responses: { label: 'Risposte Esercizi', icon: '📝', color: 'bg-teal-500' },
  client_knowledge: { label: 'Knowledge Clienti', icon: '📘', color: 'bg-cyan-500' },
  client_consultations: { label: 'Consultazioni Clienti', icon: '📞', color: 'bg-rose-500' },
  financial_data: { label: 'Dati Finanziari', icon: '💰', color: 'bg-yellow-500' },
  orphans: { label: 'Pulizia Orfani', icon: '🧹', color: 'bg-gray-500' },
  assigned_exercises: { label: 'Esercizi Assegnati', icon: '📋', color: 'bg-indigo-500' },
  assigned_library: { label: 'Libreria Assegnata', icon: '📕', color: 'bg-sky-500' },
  assigned_university: { label: 'University Assegnata', icon: '🎯', color: 'bg-orange-500' },
  goals: { label: 'Obiettivi', icon: '🎯', color: 'bg-lime-500' },
  tasks: { label: 'Task', icon: '✅', color: 'bg-violet-500' },
  daily_reflections: { label: 'Riflessioni Giornaliere', icon: '❤️', color: 'bg-red-400' },
  client_progress: { label: 'Storico Progressi', icon: '📈', color: 'bg-emerald-400' },
  library_progress: { label: 'Progressi Libreria', icon: '📚', color: 'bg-blue-400' },
  email_journey: { label: 'Email Journey', icon: '📧', color: 'bg-purple-400' },
  consultant_guide: { label: 'Guide Consulente', icon: '📖', color: 'bg-indigo-400' },
  exercise_external_docs: { label: 'Documenti Esterni Esercizi', icon: '🔗', color: 'bg-orange-500' },
};

export default function ConsultantFileSearchAnalyticsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [consultantStoreOpen, setConsultantStoreOpen] = useState(true);
  const [clientStoresOpen, setClientStoresOpen] = useState(true);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openClients, setOpenClients] = useState<Record<string, boolean>>({});
  
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [syncConsoleOpen, setSyncConsoleOpen] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [categoryProgress, setCategoryProgress] = useState<Record<string, CategoryProgress>>({});
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);
  
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [selectedStoreForOrphans, setSelectedStoreForOrphans] = useState<string | null>(null);
  
  useEffect(() => {
    if (logContainerRef.current && shouldAutoScroll) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
    }, [syncLogs, shouldAutoScroll]);
    const handleScrollConsole = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
    };
    const jumpToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setShouldAutoScroll(true);
    }
    };
  
  const addSyncLog = (type: SyncLogEntry['type'], message: string, extra?: Partial<SyncLogEntry>) => {
    setSyncLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      message,
      ...extra
    }]);
  };
  
  const startSyncWithSSE = async () => {
    setIsSyncing(true);
    setSyncConsoleOpen(true);
    setSyncLogs([]);
    setCategoryProgress({});
    
    addSyncLog('info', 'Avvio sincronizzazione...');
    
    let eventSource: EventSource | null = null;
    let sseConnected = false;
    
    try {
      const tokenResponse = await fetch("/api/file-search/sync-token", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      
      if (tokenResponse.ok) {
        const { token } = await tokenResponse.json();
        eventSource = new EventSource(`/api/file-search/sync-events?token=${token}`);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected') {
              sseConnected = true;
              addSyncLog('info', 'Console in tempo reale attiva');
            } else if (data.type === 'start') {
              setCategoryProgress(prev => ({
                ...prev,
                [data.category]: { current: 0, total: data.total, status: 'syncing' }
              }));
              if (showDetailedLogs) {
                addSyncLog('info', `Inizio sync ${data.category}: ${data.total} elementi`, { category: data.category, total: data.total });
              }
            } else if (data.type === 'progress') {
              setCategoryProgress(prev => ({
                ...prev,
                [data.category]: { 
                  ...prev[data.category],
                  current: data.current, 
                  total: data.total, 
                  status: 'syncing',
                  lastItem: data.item 
                }
              }));
              if (showDetailedLogs) {
                // Build hierarchical log message with context
                let logMessage = `[${data.category}] ${data.current}/${data.total}`;
                
                // Add store context (consultant vs client)
                if (data.storeType === 'client' && data.clientName) {
                  logMessage += ` [Cliente: ${data.clientName}]`;
                } else if (data.storeType === 'consultant') {
                  logMessage += ` [Store Consulente]`;
                }
                
                // Add document title and status
                const docTitle = data.documentTitle || data.item;
                const statusIcon = data.status === 'synced' ? '✓' : 
                                   data.status === 'updated' ? '↻' : 
                                   data.status === 'skipped' ? '→' : 
                                   data.status === 'error' ? '✗' : '•';
                logMessage += `: ${statusIcon} ${docTitle}`;
                
                addSyncLog('progress', logMessage, { 
                  category: data.category, 
                  current: data.current, 
                  total: data.total,
                  storeType: data.storeType,
                  clientId: data.clientId,
                  clientName: data.clientName,
                  clientEmail: data.clientEmail,
                  documentTitle: data.documentTitle,
                  status: data.status
                });
              }
            } else if (data.type === 'error') {
              setCategoryProgress(prev => ({
                ...prev,
                [data.category]: { ...prev[data.category], status: 'error' }
              }));
              addSyncLog('error', `Errore ${data.category}: ${data.error}`, { category: data.category });
            } else if (data.type === 'complete') {
              const synced = data.synced || data.current || 0;
              setCategoryProgress(prev => ({
                ...prev,
                [data.category]: { 
                  ...prev[data.category],
                  current: data.total, 
                  total: data.total, 
                  status: 'complete',
                  synced 
                }
              }));
              addSyncLog('success', `✅ ${CATEGORY_LABELS[data.category]?.label || data.category}: ${synced}/${data.total} sincronizzati`, { category: data.category });
            } else if (data.type === 'orphan_start') {
              setCategoryProgress(prev => ({
                ...prev,
                orphans: { current: 0, total: data.total, status: 'syncing' }
              }));
            } else if (data.type === 'orphan_progress') {
              setCategoryProgress(prev => ({
                ...prev,
                orphans: { 
                  ...prev.orphans,
                  current: data.current, 
                  total: data.total, 
                  status: 'syncing',
                  lastItem: data.item,
                  synced: (prev.orphans?.synced || 0) + (data.orphansRemoved || 0)
                }
              }));
            } else if (data.type === 'orphan_complete') {
              setCategoryProgress(prev => ({
                ...prev,
                orphans: { 
                  current: data.storesChecked, 
                  total: data.storesChecked, 
                  status: 'complete',
                  synced: data.orphansRemoved 
                }
              }));
              if (data.orphansRemoved > 0) {
                addSyncLog('success', `🧹 Pulizia orfani: ${data.orphansRemoved} rimosso/i da ${data.storesChecked} store`);
              } else {
                addSyncLog('success', `🧹 Nessun documento orfano (${data.storesChecked} store verificati)`);
              }
            } else if (data.type === 'all_complete') {
              addSyncLog('complete', `🎉 Sincronizzazione completata! Totale: ${data.totalSynced} documenti`);
              eventSource?.close();
              setIsSyncing(false);
              queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
              queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
              toast({
                title: "Sincronizzazione completata",
                description: `${data.totalSynced} documenti sincronizzati con successo.`,
              });
            }
          } catch (e) {
            console.error('Error parsing SSE:', e);
          }
        };
        
        eventSource.onerror = () => {
          if (!sseConnected) {
            addSyncLog('info', 'Console in tempo reale non disponibile, sincronizzazione in corso...');
          }
          eventSource?.close();
          eventSource = null;
        };
      } else {
        addSyncLog('info', 'Sincronizzazione senza console in tempo reale...');
      }
    } catch (e) {
      addSyncLog('info', 'Sincronizzazione senza console in tempo reale...');
    }
    
    try {
      const response = await fetch("/api/file-search/sync-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      
      const result = await response.json();
      
      setTimeout(() => {
        eventSource?.close();
        setIsSyncing(false);
        if (!sseConnected) {
          const totalSynced = (result.library?.synced || 0) + (result.knowledgeBase?.synced || 0) + 
            (result.exercises?.synced || 0) + (result.university?.synced || 0) + (result.consultations?.synced || 0);
          addSyncLog('complete', `Sincronizzazione completata! ${totalSynced} documenti sincronizzati`);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
        toast({
          title: "Sincronizzazione completata",
          description: result.message || "Documenti sincronizzati con successo",
        });
      }, 1000);
      
    } catch (error: any) {
      eventSource?.close();
      setIsSyncing(false);
      addSyncLog('error', `Errore: ${error.message}`);
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startResetOnly = async () => {
    setShowResetDialog(false);
    setIsResetting(true);
    setSyncConsoleOpen(true);
    setSyncLogs([]);
    setCategoryProgress({});
    
    addSyncLog('info', '🗑️ Avvio eliminazione di tutti i documenti da Google File Search...');
    
    try {
      const response = await fetch("/api/file-search/reset-stores", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all' }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Reset failed");
      }
      
      const result = await response.json();
      
      addSyncLog('success', `✅ Store consulente: ${result.details.consultantDocsDeleted} documenti eliminati`);
      addSyncLog('success', `✅ Store clienti: ${result.details.clientDocsDeleted} documenti eliminati (${result.details.clientStoresReset} store)`);
      addSyncLog('complete', `🎉 Reset completato! Totale: ${result.details.consultantDocsDeleted + result.details.clientDocsDeleted} documenti eliminati`);
      
      setIsResetting(false);
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/stores"] });
      
      toast({
        title: "Reset completato",
        description: `${result.details.consultantDocsDeleted + result.details.clientDocsDeleted} documenti eliminati. Ora puoi risincronizzare.`,
      });
      
    } catch (error: any) {
      setIsResetting(false);
      addSyncLog('error', `Errore: ${error.message}`);
      toast({
        title: "Errore reset",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const toggleCategory = (key: string) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const toggleClient = (clientId: string) => {
    setOpenClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const { data: settings, isLoading: settingsLoading } = useQuery<FileSearchSettings>({
    queryKey: ["/api/file-search/settings"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
  });

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/file-search/analytics"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/analytics?days=30", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery<AuditData>({
    queryKey: ["/api/file-search/audit"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/audit", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch audit");
      return response.json();
    },
  });

  const { data: sourceOrphansData, isLoading: sourceOrphansLoading } = useQuery<SourceOrphansData>({
    queryKey: [`/api/file-search/stores/${selectedStoreForOrphans}/source-orphans`],
    queryFn: async () => {
      const response = await fetch(`/api/file-search/stores/${selectedStoreForOrphans}/source-orphans`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch source orphans");
      return response.json();
    },
    enabled: !!selectedStoreForOrphans,
  });

  const { data: clientsFileSearch, isLoading: clientsFileSearchLoading } = useQuery<ClientFileSearchStatus[]>({
    queryKey: ["/api/file-search/clients"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: memoryStats, isLoading: memoryStatsLoading } = useQuery<{
    totalSummaries: number;
    usersWithMemory: number;
    totalUsers: number;
    averageTokensPerUser: number;
    coveragePercent: number;
  }>({
    queryKey: ["/api/consultant/ai/memory-stats"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/ai/memory-stats", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch memory stats");
      return res.json();
    },
  });

  const { data: memoryAudit, isLoading: memoryAuditLoading } = useQuery<Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    totalDays: number;
    coveredDays: number;
    missingDays: number;
    lastSummaryDate: string | null;
    status: 'complete' | 'partial' | 'missing';
  }>>({
    queryKey: ["/api/consultant/ai/memory-audit"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/ai/memory-audit", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch memory audit");
      return res.json();
    },
  });

  const { data: memoryLogs, isLoading: memoryLogsLoading } = useQuery<Array<{
    id: number;
    userId: string;
    targetUserId: string | null;
    generationType: string;
    summariesGenerated: number;
    conversationsAnalyzed: number;
    tokensUsed: number;
    durationMs: number;
    errors: string[];
    createdAt: string | null;
    targetUserName?: string;
  }>>({
    queryKey: ["/api/consultant/ai/memory-generation-logs"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/ai/memory-generation-logs", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch memory logs");
      return res.json();
    },
  });

  const { data: managerMemoryAudit, isLoading: managerMemoryAuditLoading } = useQuery<ManagerMemoryAudit[]>({
    queryKey: ["/api/ai-assistant/memory/manager-audit"],
    queryFn: async () => {
      const res = await fetch("/api/ai-assistant/memory/manager-audit", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch manager memory audit");
      return res.json();
    },
  });

  const [viewingMemoryUserId, setViewingMemoryUserId] = useState<string | null>(null);
  const viewingMemoryUser = memoryAudit?.find(u => u.userId === viewingMemoryUserId);

  const [viewingManagerSubscriptionId, setViewingManagerSubscriptionId] = useState<string | null>(null);
  const viewingManagerData = managerMemoryAudit?.find(m => m.subscriptionId === viewingManagerSubscriptionId);

  const [expandedGoldUserId, setExpandedGoldUserId] = useState<string | null>(null);
  
  const { data: goldUserAgentBreakdown, isLoading: agentBreakdownLoading } = useQuery<Array<{
    agentId: string;
    agentName: string;
    conversationCount: number;
    messageCount: number;
    lastMessageAt: string | null;
  }>>({
    queryKey: ["/api/ai-assistant/memory/manager", expandedGoldUserId, "agents"],
    queryFn: async () => {
      const res = await fetch(`/api/ai-assistant/memory/manager/${expandedGoldUserId}/agents`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch agent breakdown");
      return res.json();
    },
    enabled: !!expandedGoldUserId,
  });

  const [viewingAgentMemory, setViewingAgentMemory] = useState<{
    subscriptionId: string;
    agentId: string;
    agentName: string;
  } | null>(null);

  const { data: agentSummaries, isLoading: agentSummariesLoading } = useQuery<Array<{
    id: string;
    summaryDate: string;
    summary: string;
    conversationCount: number;
    messageCount: number;
    topics: string[];
  }>>({
    queryKey: ["/api/ai-assistant/memory/manager", viewingAgentMemory?.subscriptionId, "agents", viewingAgentMemory?.agentId, "summaries"],
    queryFn: async () => {
      const res = await fetch(`/api/ai-assistant/memory/manager/${viewingAgentMemory?.subscriptionId}/agents/${viewingAgentMemory?.agentId}/summaries`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch agent summaries");
      return res.json();
    },
    enabled: !!viewingAgentMemory,
  });

  const { data: memorySettings } = useQuery<{ memoryGenerationHour: number }>({
    queryKey: ["/api/consultant/ai/memory-settings"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/ai/memory-settings", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch memory settings");
      return res.json();
    },
  });

  const updateMemorySettingsMutation = useMutation({
    mutationFn: async (hour: number) => {
      const res = await fetch("/api/consultant/ai/memory-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ memoryGenerationHour: hour })
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-settings"] });
      toast({ title: "Impostazioni salvate" });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive",
      });
    },
  });

  const generateMemoryNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/ai/generate-memory-now", {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to generate memory");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-generation-logs"] });
      toast({
        title: "Generazione completata",
        description: `${data.generated} riassunti generati per ${data.usersWithNewSummaries} utenti`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la generazione",
        variant: "destructive",
      });
    },
  });

  const [memoryGenerationProgress, setMemoryGenerationProgress] = useState<{
    isRunning: boolean;
    phase: 'users' | 'gold';
    totalUsers: number;
    currentIndex: number;
    currentUser: string;
    currentRole: string;
    currentDay?: number;
    totalDays?: number;
    currentDate?: string;
    results: Array<{ userId: string; userName: string; status: 'processing' | 'generated' | 'skipped' | 'error'; generated?: number; error?: string }>;
    totalGoldUsers: number;
    currentGoldIndex: number;
    goldResults: Array<{ userId: string; userName: string; status: 'processing' | 'generated' | 'skipped' | 'error'; generated?: number; error?: string }>;
    finalResult?: { 
      generated: number; 
      usersProcessed: number; 
      usersWithNewSummaries: number; 
      goldGenerated: number;
      goldUsersProcessed: number;
      goldUsersWithNewSummaries: number;
      durationMs: number; 
      errors?: string[] 
    };
  }>({
    isRunning: false,
    phase: 'users',
    totalUsers: 0,
    currentIndex: 0,
    currentUser: '',
    currentRole: '',
    results: [],
    totalGoldUsers: 0,
    currentGoldIndex: 0,
    goldResults: []
  });

  const startMemoryGeneration = async () => {
    setMemoryGenerationProgress({
      isRunning: true,
      phase: 'users',
      totalUsers: 0,
      currentIndex: 0,
      currentUser: '',
      currentRole: '',
      results: [],
      totalGoldUsers: 0,
      currentGoldIndex: 0,
      goldResults: []
    });

    try {
      const headers = getAuthHeaders();
      
      // Start the job
      const startResponse = await fetch("/api/consultant/ai/memory-job/start", {
        method: "POST",
        headers: headers
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start memory generation");
      }

      const { jobId } = await startResponse.json();
      
      // Poll for status every 500ms
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/consultant/ai/memory-job/${jobId}`, {
            headers: headers
          });
          
          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            throw new Error("Failed to get job status");
          }
          
          const job = await statusResponse.json();
          
          setMemoryGenerationProgress({
            isRunning: job.status === 'running',
            phase: job.phase || 'users',
            totalUsers: job.totalUsers,
            currentIndex: job.currentIndex,
            currentUser: job.currentUser,
            currentRole: job.currentRole,
            currentDay: job.currentDay,
            totalDays: job.totalDays,
            currentDate: job.currentDate,
            results: job.results || [],
            totalGoldUsers: job.totalGoldUsers || 0,
            currentGoldIndex: job.currentGoldIndex || 0,
            goldResults: job.goldResults || [],
            finalResult: job.finalResult
          });
          
          if (job.status === 'completed' || job.status === 'error') {
            clearInterval(pollInterval);
            queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-audit"] });
            queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-generation-logs"] });
            
            if (job.status === 'error') {
              toast({
                title: "Errore",
                description: job.errorMessage || "Errore durante la generazione",
                variant: "destructive"
              });
            }
          }
        } catch (pollError: any) {
          console.error("Polling error:", pollError);
          clearInterval(pollInterval);
        }
      }, 500);
      
    } catch (error: any) {
      console.error("Memory generation error:", error);
      setMemoryGenerationProgress(prev => ({
        ...prev,
        isRunning: false,
        finalResult: {
          generated: 0,
          usersProcessed: 0,
          usersWithNewSummaries: 0,
          goldGenerated: 0,
          goldUsersProcessed: 0,
          goldUsersWithNewSummaries: 0,
          durationMs: 0,
          errors: [error.message || "Errore durante la generazione"]
        }
      }));
      toast({
        title: "Errore",
        description: error.message || "Errore durante la generazione",
        variant: "destructive"
      });
    }
  };

  const { data: userSummaries, isLoading: summariesLoading } = useQuery<Array<{
    id: string;
    summaryDate: string;
    summary: string;
    conversationCount: number;
    messageCount: number;
    topics: string[];
  }>>({
    queryKey: ["/api/consultant/ai/user-memory", viewingMemoryUserId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/ai/user-memory/${viewingMemoryUserId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch user memory");
      return res.json();
    },
    enabled: !!viewingMemoryUserId,
  });

  const { data: managerSummaries, isLoading: managerSummariesLoading } = useQuery<Array<{
    id: string;
    summaryDate: string;
    summary: string;
    conversationCount: number;
    messageCount: number;
    topics: string[];
    agentProfileId: string | null;
    agentName: string | null;
  }>>({
    queryKey: ["/api/consultant/ai/memory/manager", viewingManagerSubscriptionId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/ai/memory/manager/${viewingManagerSubscriptionId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch manager memory");
      return res.json();
    },
    enabled: !!viewingManagerSubscriptionId,
  });

  const memoryTabLoading = memoryStatsLoading || memoryAuditLoading || memoryLogsLoading;

  const updateClientFileSearchMutation = useMutation({
    mutationFn: async ({ clientId, fileSearchEnabled }: { clientId: string; fileSearchEnabled: boolean }) => {
      const response = await fetch(`/api/file-search/clients/${clientId}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileSearchEnabled }),
      });
      if (!response.ok) throw new Error("Failed to update client");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/clients"] });
      toast({
        title: "Impostazione aggiornata",
        description: "Lo stato File Search del cliente è stato aggiornato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    },
  });

  const cleanupOrphansMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/file-search/stores/${selectedStoreForOrphans}/cleanup-source-orphans`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Cleanup failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/file-search/stores/${selectedStoreForOrphans}/source-orphans`] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      toast({
        title: "Pulizia completata",
        description: data.message || "Documenti orfani rimossi con successo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore pulizia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMissingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/sync-missing", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Sync missing failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      toast({
        title: "Sincronizzazione completata",
        description: data.message || "Documenti mancanti sincronizzati.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<FileSearchSettings>) => {
      const response = await fetch("/api/file-search/settings", {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/settings"] });
      toast({
        title: "Impostazioni aggiornate",
        description: "Le impostazioni File Search sono state salvate.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento delle impostazioni",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/sync-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Sync failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Sincronizzazione completata",
        description: data.message || "Tutti i documenti sono stati sincronizzati.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const initializeStoreMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/initialize", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Initialize failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Store creato",
        description: "Il tuo File Search Store e stato inizializzato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof FileSearchSettings, value: boolean | number) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const syncSingleMutation = useMutation({
    mutationFn: async (params: { type: string; id: string; clientId?: string }) => {
      const response = await fetch("/api/file-search/sync-single", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Elemento sincronizzato!",
        description: "L'elemento è stato aggiunto al File Search.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncFinancialMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/file-search/sync-financial/${clientId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Dati finanziari sincronizzati!",
        description: "I dati finanziari sono stati aggiunti al File Search.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateUserMemoryMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/consultant/ai/memory-audit/generate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error("Failed to generate memory");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Memoria generata", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/ai/memory-generation-logs"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile generare memoria", variant: "destructive" });
    }
  });

  const generateManagerMemoryMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch(`/api/ai-assistant/memory/manager/${subscriptionId}/generate`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to generate manager memory");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Memoria generata", 
        description: `Generati ${data.generated} riassunti (${data.skipped} saltati)`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/memory/manager-audit"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile generare memoria dipendente", variant: "destructive" });
    }
  });

  const resetStoresMutation = useMutation({
    mutationFn: async (type: 'consultant' | 'clients' | 'all') => {
      const response = await fetch("/api/file-search/reset-stores", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Reset failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/stores"] });
      toast({
        title: "Reset completato!",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore reset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMigrateClient = async (clientId: string) => {
    setMigratingClients(prev => ({ ...prev, [clientId]: true }));
    try {
      const response = await fetch(`/api/file-search/migrate-client/${clientId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Migration failed");
      }
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/stores"] });
      toast({
        title: "Migrazione completata!",
        description: `Client ${data.clientName} migrato con successo.`,
      });
    } catch (error: any) {
      toast({
        title: "Errore migrazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setMigratingClients(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const migrateAllClientsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/file-search/migrate-all-clients", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Migration failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/stores"] });
      toast({
        title: "Migrazione bulk completata!",
        description: `${data.summary.clientsMigrated} client migrati con successo.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore migrazione bulk",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: missingExternalDocs, isLoading: missingExternalDocsLoading, refetch: refetchMissingExternalDocs } = useQuery<MissingExternalDocsData>({
    queryKey: ["/api/file-search/external-docs/missing"],
    queryFn: async () => {
      const response = await fetch("/api/file-search/external-docs/missing", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch missing external docs");
      return response.json();
    },
  });

  const [syncReportsPage, setSyncReportsPage] = useState(0);
  const [syncReportsFilter, setSyncReportsFilter] = useState<{ syncType?: string; status?: string }>({});
  const [selectedReport, setSelectedReport] = useState<SyncReport | null>(null);

  const { data: syncReportsData, isLoading: syncReportsLoading, refetch: refetchSyncReports } = useQuery<SyncReportsResponse>({
    queryKey: ["/api/file-search/sync-reports", syncReportsPage, syncReportsFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(syncReportsPage * 20),
      });
      if (syncReportsFilter.syncType) params.append("syncType", syncReportsFilter.syncType);
      if (syncReportsFilter.status) params.append("status", syncReportsFilter.status);
      const response = await fetch(`/api/file-search/sync-reports?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch sync reports");
      return response.json();
    },
  });

  const deleteSyncReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/file-search/sync-reports/${reportId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/sync-reports"] });
      toast({
        title: "Report eliminato",
        description: "Il report di sincronizzazione è stato eliminato.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncExternalDocMutation = useMutation({
    mutationFn: async (params: { assignmentId: string; clientId: string }) => {
      const response = await fetch("/api/file-search/external-docs/sync", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/external-docs/missing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Documento sincronizzato!",
        description: "Il documento esterno è stato aggiunto al File Search.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncAllExternalDocsMutation = useMutation({
    mutationFn: async (params?: { clientId?: string }) => {
      const response = await fetch("/api/file-search/external-docs/sync-all", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params || {}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync all failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/external-docs/missing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/file-search/analytics"] });
      toast({
        title: "Sincronizzazione completata!",
        description: data.message || "Tutti i documenti esterni sono stati sincronizzati.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [openAuditCategories, setOpenAuditCategories] = useState<Record<string, boolean>>({});
  const [openExternalDocsClients, setOpenExternalDocsClients] = useState<Record<string, boolean>>({});
  const [openAuditClients, setOpenAuditClients] = useState<Record<string, boolean>>({});
  const [openAuditAgents, setOpenAuditAgents] = useState<Record<string, boolean>>({});
  const [migratingClients, setMigratingClients] = useState<Record<string, boolean>>({});
  const [openClientAuditCategories, setOpenClientAuditCategories] = useState<Record<string, boolean>>({});
  
  const toggleAuditCategory = (key: string) => {
    setOpenAuditCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const toggleAuditClient = (clientId: string) => {
    setOpenAuditClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const toggleAuditAgent = (agentId: string) => {
    setOpenAuditAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const toggleExternalDocsClient = (clientId: string) => {
    setOpenExternalDocsClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const toggleClientAuditCategory = (clientId: string, category: string) => {
    const key = `${clientId}-${category}`;
    setOpenClientAuditCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isLoading = settingsLoading || analyticsLoading || auditLoading;
  
  const totalMissing = auditData?.summary?.totalMissing || 0;
  
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const getHealthScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const providerChartData = analytics?.providerStats
    ? Object.entries(analytics.providerStats).map(([name, value]) => ({
        name: name === 'google_ai_studio' ? 'Google AI Studio' : 
              name === 'vertex_ai' ? 'Vertex AI' : name,
        value,
      }))
    : [];

  return (
    <div className="flex h-screen">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/consultant/ai-settings")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileSearch className="h-7 w-7 text-emerald-600" />
                    File Search Analytics
                  </h1>
                  <p className="text-gray-500">
                    Monitora l'utilizzo di File Search e gestisci le impostazioni
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => refetchAnalytics()}
                  disabled={analyticsLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  Aggiorna
                </Button>
              </div>
            </div>

            {!analytics?.geminiApiKeyConfigured && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-lg">
                      <Zap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800">GEMINI_API_KEY non configurata</h3>
                      <p className="text-amber-700 text-sm mt-1">
                        File Search richiede una GEMINI_API_KEY configurata come variabile d'ambiente.
                        Contatta l'amministratore per configurarla.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {analytics?.summary.totalStores === 0 && analytics?.geminiApiKeyConfigured && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-800">Nessun File Search Store</h3>
                      <p className="text-blue-700 text-sm mt-1">
                        Per utilizzare File Search, devi prima creare uno store e sincronizzare i tuoi documenti.
                      </p>
                      <Button
                        className="mt-3"
                        onClick={() => initializeStoreMutation.mutate()}
                        disabled={initializeStoreMutation.isPending}
                      >
                        {initializeStoreMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        Inizializza File Search Store
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Panoramica</TabsTrigger>
                <TabsTrigger value="contents">Contenuti</TabsTrigger>
                <TabsTrigger value="usage">Utilizzo</TabsTrigger>
                <TabsTrigger value="settings">Impostazioni</TabsTrigger>
                <TabsTrigger value="audit" className="relative">
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  Audit
                  {totalMissing > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs h-5 min-w-5 flex items-center justify-center">
                      {totalMissing}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="migration">
                  <Users className="h-4 w-4 mr-1" />
                  Migrazione
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-1" />
                  Storico
                </TabsTrigger>
                <TabsTrigger value="memory">
                  <Brain className="h-4 w-4 mr-1" />
                  Memoria AI
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Chiamate File Search</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {analytics?.summary.fileSearchCalls || 0}
                          </p>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-lg">
                          <FileSearch className="h-6 w-6 text-emerald-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {analytics?.summary.fileSearchPercentage || 0}% del totale
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Token Risparmiati</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {(analytics?.summary.totalTokensSaved || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Zap className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Ultimi 30 giorni</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Citazioni Generate</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {analytics?.summary.totalCitations || 0}
                          </p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <Quote className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Riferimenti nei documenti</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Documenti Indicizzati</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {analytics?.summary.totalDocuments || 0}
                          </p>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-lg">
                          <FileText className="h-6 w-6 text-amber-600" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        In {analytics?.summary.totalStores || 0} store
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                      Risparmio Token Stimato
                    </CardTitle>
                    <CardDescription>
                      Confronto tra approccio tradizionale e File Search RAG
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 font-medium">Context Tradizionale</p>
                        <p className="text-3xl font-bold text-red-700 mt-2">~212,000</p>
                        <p className="text-xs text-red-500 mt-1">tokens per sessione</p>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-sm text-emerald-600 font-medium">Con File Search RAG</p>
                        <p className="text-3xl font-bold text-emerald-700 mt-2">~20,000</p>
                        <p className="text-xs text-emerald-500 mt-1">tokens per sessione</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg border-2 border-emerald-300">
                        <p className="text-sm text-emerald-700 font-medium">Risparmio Totale</p>
                        <p className="text-4xl font-bold text-emerald-700 mt-2">~91%</p>
                        <p className="text-xs text-emerald-600 mt-1">riduzione costi AI</p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700">
                        <strong>💡 Vantaggio:</strong> File Search usa embedding vettoriali per cercare solo i contenuti rilevanti, 
                        invece di caricare tutti i documenti nel context. Questo riduce drasticamente il consumo di token mantenendo 
                        l'accuratezza delle risposte.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-blue-600" />
                        Breakdown per Tipo di Contenuto
                      </CardTitle>
                      <CardDescription>
                        Token risparmiati per categoria di documento
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <BookOpen className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-indigo-900">Guida Piattaforma</p>
                            <p className="text-sm text-indigo-600">{auditData?.consultant?.consultantGuide?.indexed || 0} guida indicizzata</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-700">~{((auditData?.consultant?.consultantGuide?.indexed || 0) * 12000).toLocaleString()}</p>
                          <p className="text-xs text-indigo-500">token risparmiati</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 p-2 rounded-lg">
                            <BookOpen className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-purple-900">Library</p>
                            <p className="text-sm text-purple-600">{auditData?.consultant?.library?.indexed || 0} documenti indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-700">~{((auditData?.consultant?.library?.indexed || 0) * 8500).toLocaleString()}</p>
                          <p className="text-xs text-purple-500">token risparmiati</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 p-2 rounded-lg">
                            <FileText className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-amber-900">Knowledge Base</p>
                            <p className="text-sm text-amber-600">{auditData?.consultant?.knowledgeBase?.indexed || 0} documenti indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-700">~{((auditData?.consultant?.knowledgeBase?.indexed || 0) * 6000).toLocaleString()}</p>
                          <p className="text-xs text-amber-500">token risparmiati</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Dumbbell className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-900">Exercises</p>
                            <p className="text-sm text-blue-600">{auditData?.consultant?.exercises?.indexed || 0} esercizi indicizzati</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-700">~{((auditData?.consultant?.exercises?.indexed || 0) * 3500).toLocaleString()}</p>
                          <p className="text-xs text-blue-500">token risparmiati</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={auditData?.summary?.healthScore && auditData.summary.healthScore < 80 ? "border-amber-300" : "border-emerald-300"}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-emerald-600" />
                        Audit Health
                      </CardTitle>
                      <CardDescription>
                        Stato di indicizzazione dei tuoi contenuti
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center p-4">
                        <p className={`text-5xl font-bold ${getHealthScoreColor(auditData?.summary?.healthScore || 0)}`}>
                          {auditData?.summary?.healthScore || 0}%
                        </p>
                        <p className="text-sm text-gray-500 mt-1">Health Score</p>
                        <Progress 
                          value={auditData?.summary?.healthScore || 0} 
                          className="mt-3 h-3"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Library</span>
                          <span className={auditData?.consultant?.library?.missing?.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.consultant?.library?.indexed || 0}/{auditData?.consultant?.library?.total || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Knowledge Base</span>
                          <span className={auditData?.consultant?.knowledgeBase?.missing?.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.consultant?.knowledgeBase?.indexed || 0}/{auditData?.consultant?.knowledgeBase?.total || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Exercises</span>
                          <span className={auditData?.consultant?.exercises?.missing?.length ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.consultant?.exercises?.indexed || 0}/{auditData?.consultant?.exercises?.total || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Guide Piattaforma</span>
                          <span className={(auditData?.consultant?.consultantGuide?.indexed || 0) < (auditData?.consultant?.consultantGuide?.total || 0) ? "text-amber-600" : "text-emerald-600"}>
                            {auditData?.consultant?.consultantGuide?.indexed || 0}/{auditData?.consultant?.consultantGuide?.total || 0}
                          </span>
                        </div>
                      </div>

                      {totalMissing > 0 && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">
                                {totalMissing} documenti non indicizzati
                              </p>
                              <p className="text-xs text-amber-600 mt-1">
                                {auditData?.recommendations[0]}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {totalMissing > 0 && (
                        <Button
                          onClick={() => syncMissingMutation.mutate()}
                          disabled={syncMissingMutation.isPending}
                          className="w-full bg-amber-600 hover:bg-amber-700"
                        >
                          {syncMissingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sincronizza {totalMissing} Mancanti
                        </Button>
                      )}

                      {totalMissing === 0 && auditData?.summary?.healthScore === 100 && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-800">
                              Tutti i contenuti sono indicizzati!
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-emerald-600" />
                      Moduli che Utilizzano File Search
                    </CardTitle>
                    <CardDescription>
                      File Search è integrato in questi moduli per ricerca semantica intelligente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                          <MessageSquare className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">AI Assistant Cliente</h4>
                          <p className="text-sm text-gray-500">Chat AI per clienti con accesso ai documenti</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">AI Assistant Consulente</h4>
                          <p className="text-sm text-gray-500">Chat AI per consulenti con knowledge base</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <BookOpen className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Libreria Documenti</h4>
                          <p className="text-sm text-gray-500">Sincronizzazione automatica documenti</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-lg border shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-lg">
                          <Database className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Knowledge Base</h4>
                          <p className="text-sm text-gray-500">Documenti consulente indicizzati</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Come Funziona</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Quando un utente fa una domanda nell'AI Assistant, File Search cerca automaticamente 
                            nei documenti indicizzati per trovare le informazioni più rilevanti. Questo riduce i token 
                            utilizzati e migliora la qualità delle risposte con citazioni precise.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {analytics?.dailyStats && analytics.dailyStats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Trend Utilizzo (ultimi 30 giorni)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString('it-IT')}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="fileSearchCalls" 
                            stroke="#10b981" 
                            name="File Search"
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="classicRagCalls" 
                            stroke="#6366f1" 
                            name="RAG Classico"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {providerChartData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Provider Utilizzati
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={providerChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {providerChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        File Search Stores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics?.stores && analytics.stores.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.stores.map((store) => (
                            <div key={store.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{store.displayName}</p>
                                <p className="text-sm text-gray-500">
                                  {store.documentCount} documenti
                                </p>
                              </div>
                              <Badge variant={store.isActive ? "default" : "secondary"}>
                                {store.isActive ? "Attivo" : "Inattivo"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          Nessuno store configurato
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="contents" className="space-y-6">
                {(() => {
                  const hData = analytics?.hierarchicalData;
                  const consultantTotal = (hData?.consultantStore.totals.library || 0) + 
                                          (hData?.consultantStore.totals.knowledgeBase || 0) + 
                                          (hData?.consultantStore.totals.exercises || 0) + 
                                          (hData?.consultantStore.totals.university || 0) +
                                          (hData?.consultantStore.totals.consultantGuide || 0);
                  const clientsTotal = hData?.clientStores.reduce((sum, c) => sum + c.totals.total, 0) || 0;
                  
                  const groupByDocumentType = (docs: SyncedDocument[]) => {
                    const groups: Record<string, SyncedDocument[]> = {};
                    docs.forEach(doc => {
                      const type = doc.mimeType?.includes('pdf') ? 'PDF' :
                                   doc.mimeType?.includes('word') || doc.mimeType?.includes('document') ? 'Documenti Word' :
                                   doc.mimeType?.includes('sheet') || doc.mimeType?.includes('excel') ? 'Fogli di Calcolo' :
                                   doc.mimeType?.includes('presentation') || doc.mimeType?.includes('powerpoint') ? 'Presentazioni' :
                                   doc.mimeType?.includes('text') ? 'Testo' :
                                   doc.mimeType?.includes('image') ? 'Immagini' :
                                   'Altri Documenti';
                      if (!groups[type]) groups[type] = [];
                      groups[type].push(doc);
                    });
                    return groups;
                  };
                  
                  const groupUniversityByHierarchy = (docs: SyncedDocument[]) => {
                    const hierarchy: Record<string, Record<string, Record<string, SyncedDocument[]>>> = {};
                    docs.forEach(doc => {
                      const parts = doc.displayName.split(' > ').map(p => p.trim());
                      const year = parts[0] || 'Anno Sconosciuto';
                      const trimester = parts[1] || 'Trimestre Sconosciuto';
                      const module = parts[2] || 'Modulo Sconosciuto';
                      
                      if (!hierarchy[year]) hierarchy[year] = {};
                      if (!hierarchy[year][trimester]) hierarchy[year][trimester] = {};
                      if (!hierarchy[year][trimester][module]) hierarchy[year][trimester][module] = [];
                      hierarchy[year][trimester][module].push(doc);
                    });
                    return hierarchy;
                  };
                  
                  const groupKnowledgeByType = (docs: SyncedDocument[]) => {
                    const groups: Record<string, SyncedDocument[]> = {};
                    docs.forEach(doc => {
                      const type = doc.mimeType?.includes('pdf') ? 'Documenti PDF' :
                                   doc.mimeType?.includes('word') || doc.mimeType?.includes('document') ? 'Documenti Word' :
                                   doc.mimeType?.includes('text') ? 'Documenti di Testo' :
                                   'Altri Formati';
                      if (!groups[type]) groups[type] = [];
                      groups[type].push(doc);
                    });
                    return groups;
                  };
                  
                  const groupExercisesByCategory = (docs: SyncedDocument[]) => {
                    const groups: Record<string, SyncedDocument[]> = {};
                    docs.forEach(doc => {
                      const nameParts = doc.displayName.split(':');
                      const category = nameParts.length > 1 ? nameParts[0].trim() : 'Esercizi Generali';
                      if (!groups[category]) groups[category] = [];
                      groups[category].push(doc);
                    });
                    return groups;
                  };
                  
                  const getSyncStatusBadge = (docs: SyncedDocument[]) => {
                    const synced = docs.filter(d => d.status === 'indexed').length;
                    const total = docs.length;
                    const allSynced = synced === total;
                    return (
                      <Badge variant="outline" className={`ml-2 ${allSynced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {synced}/{total}
                      </Badge>
                    );
                  };
                  
                  const libraryGroups = hData ? groupByDocumentType(hData.consultantStore.documents.library) : {};
                  const universityHierarchy = hData ? groupUniversityByHierarchy(hData.consultantStore.documents.university) : {};
                  const knowledgeGroups = hData ? groupKnowledgeByType(hData.consultantStore.documents.knowledgeBase) : {};
                  const exerciseGroups = hData ? groupExercisesByCategory(hData.consultantStore.documents.exercises) : {};
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <FileText className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{analytics?.documents?.length || 0}</p>
                              <p className="text-sm opacity-90">Totale Documenti</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <FolderOpen className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{consultantTotal}</p>
                              <p className="text-sm opacity-90">Store Globale</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <Users className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">{clientsTotal}</p>
                              <p className="text-sm opacity-90">Store Privati</p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex flex-col items-center text-center">
                              <User className="h-8 w-8 mb-2 opacity-90" />
                              <p className="text-3xl font-bold">
                                {hData?.clientStores.filter(c => c.hasDocuments).length || 0}
                                <span className="text-lg opacity-75">/{hData?.clientStores.length || 0}</span>
                              </p>
                              <p className="text-sm opacity-90">Clienti Sincronizzati</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Folder className="h-5 w-5" />
                            Visualizzazione Gerarchica Contenuti
                          </CardTitle>
                          <CardDescription>
                            Contenuti organizzati per tipologia con struttura gerarchica
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {hData ? (
                            <div className="space-y-3">
                              <Collapsible open={consultantStoreOpen} onOpenChange={setConsultantStoreOpen}>
                                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                  {consultantStoreOpen ? <ChevronDown className="h-5 w-5 text-blue-600" /> : <ChevronRight className="h-5 w-5 text-blue-600" />}
                                  <FolderOpen className="h-5 w-5 text-blue-600" />
                                  <span className="font-semibold text-blue-900">Store Globale Consulente</span>
                                  <Badge className="ml-auto bg-blue-200 text-blue-800">{consultantTotal} documenti</Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 ml-4 space-y-2">
                                  
                                  <Collapsible open={openCategories['consultantGuide']} onOpenChange={() => toggleCategory('consultantGuide')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                                      {openCategories['consultantGuide'] ? <ChevronDown className="h-4 w-4 text-indigo-600" /> : <ChevronRight className="h-4 w-4 text-indigo-600" />}
                                      <BookOpen className="h-5 w-5 text-indigo-600" />
                                      <span className="font-medium text-gray-800">Guide Piattaforma</span>
                                      {getSyncStatusBadge(hData.consultantStore.documents.consultantGuide || [])}
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.consultantGuide || 0} doc</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-6 mt-2 space-y-1">
                                      {(hData.consultantStore.documents.consultantGuide || []).length > 0 ? (
                                        (hData.consultantStore.documents.consultantGuide || []).map(doc => (
                                          <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors">
                                            <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="truncate flex-1" title={doc.displayName}>{doc.displayName}</span>
                                            <Badge className={`text-xs flex-shrink-0 ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                              {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                            </Badge>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-gray-400 text-sm p-2 italic">Nessuna guida piattaforma</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['library']} onOpenChange={() => toggleCategory('library')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                                      {openCategories['library'] ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-blue-600" />}
                                      <BookOpen className="h-5 w-5 text-blue-600" />
                                      <span className="font-medium text-gray-800">Libreria Documenti</span>
                                      {getSyncStatusBadge(hData.consultantStore.documents.library)}
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.library} doc</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-6 mt-2 space-y-2">
                                      {Object.keys(libraryGroups).length > 0 ? (
                                        Object.entries(libraryGroups).map(([type, docs]) => (
                                          <Collapsible key={type} open={openCategories[`lib-${type}`]} onOpenChange={() => toggleCategory(`lib-${type}`)}>
                                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                              {openCategories[`lib-${type}`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                              <Folder className="h-4 w-4 text-blue-500" />
                                              <span className="text-sm text-gray-700">{type}</span>
                                              {getSyncStatusBadge(docs)}
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                              {docs.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors">
                                                  <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                                  <span className="truncate flex-1" title={doc.displayName}>{doc.displayName}</span>
                                                  <Badge className={`text-xs flex-shrink-0 ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                  </Badge>
                                                </div>
                                              ))}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        <p className="text-gray-400 text-sm p-2 italic">Nessun documento in libreria</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['university']} onOpenChange={() => toggleCategory('university')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100">
                                      {openCategories['university'] ? <ChevronDown className="h-4 w-4 text-amber-600" /> : <ChevronRight className="h-4 w-4 text-amber-600" />}
                                      <GraduationCap className="h-5 w-5 text-amber-600" />
                                      <span className="font-medium text-gray-800">University</span>
                                      {getSyncStatusBadge(hData.consultantStore.documents.university)}
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.university} lezioni</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-6 mt-2 space-y-2">
                                      {Object.keys(universityHierarchy).length > 0 ? (
                                        Object.entries(universityHierarchy).map(([year, trimesters]) => (
                                          <Collapsible key={year} open={openCategories[`uni-${year}`]} onOpenChange={() => toggleCategory(`uni-${year}`)}>
                                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-amber-50 rounded-lg transition-colors border-l-2 border-amber-300">
                                              {openCategories[`uni-${year}`] ? <ChevronDown className="h-3 w-3 text-amber-600" /> : <ChevronRight className="h-3 w-3 text-amber-600" />}
                                              <Folder className="h-4 w-4 text-amber-500" />
                                              <span className="text-sm font-medium text-gray-700">{year}</span>
                                              <Badge variant="outline" className="ml-auto text-xs bg-amber-50">
                                                {Object.values(trimesters).reduce((sum, mods) => sum + Object.values(mods).reduce((s, l) => s + l.length, 0), 0)} lezioni
                                              </Badge>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                              {Object.entries(trimesters).map(([trimester, modules]) => (
                                                <Collapsible key={trimester} open={openCategories[`uni-${year}-${trimester}`]} onOpenChange={() => toggleCategory(`uni-${year}-${trimester}`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                                    {openCategories[`uni-${year}-${trimester}`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Folder className="h-3 w-3 text-amber-400" />
                                                    <span className="text-xs text-gray-600">{trimester}</span>
                                                    <Badge variant="outline" className="ml-auto text-xs">
                                                      {Object.values(modules).reduce((s, l) => s + l.length, 0)} lezioni
                                                    </Badge>
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {Object.entries(modules).map(([module, lessons]) => (
                                                      <Collapsible key={module} open={openCategories[`uni-${year}-${trimester}-${module}`]} onOpenChange={() => toggleCategory(`uni-${year}-${trimester}-${module}`)}>
                                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-1.5 hover:bg-gray-50 rounded transition-colors">
                                                          {openCategories[`uni-${year}-${trimester}-${module}`] ? <ChevronDown className="h-2 w-2 text-gray-400" /> : <ChevronRight className="h-2 w-2 text-gray-400" />}
                                                          <BookOpen className="h-3 w-3 text-amber-400" />
                                                          <span className="text-xs text-gray-600 truncate">{module}</span>
                                                          {getSyncStatusBadge(lessons)}
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="ml-5 mt-1 space-y-0.5">
                                                          {lessons.map(doc => (
                                                            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-gray-50 hover:bg-gray-100 rounded text-xs transition-colors">
                                                              <FileText className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
                                                              <span className="truncate flex-1 text-gray-600" title={doc.displayName}>
                                                                {doc.displayName.split(' > ').pop()}
                                                              </span>
                                                              <Badge className={`text-[10px] px-1 flex-shrink-0 ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {doc.status === 'indexed' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                                              </Badge>
                                                            </div>
                                                          ))}
                                                        </CollapsibleContent>
                                                      </Collapsible>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              ))}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        <p className="text-gray-400 text-sm p-2 italic">Nessuna lezione university sincronizzata</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['kb']} onOpenChange={() => toggleCategory('kb')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100">
                                      {openCategories['kb'] ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
                                      <Brain className="h-5 w-5 text-purple-600" />
                                      <span className="font-medium text-gray-800">Knowledge Base</span>
                                      {getSyncStatusBadge(hData.consultantStore.documents.knowledgeBase)}
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.knowledgeBase} doc</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-6 mt-2 space-y-2">
                                      {Object.keys(knowledgeGroups).length > 0 ? (
                                        Object.entries(knowledgeGroups).map(([type, docs]) => (
                                          <Collapsible key={type} open={openCategories[`kb-${type}`]} onOpenChange={() => toggleCategory(`kb-${type}`)}>
                                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                              {openCategories[`kb-${type}`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                              <Folder className="h-4 w-4 text-purple-500" />
                                              <span className="text-sm text-gray-700">{type}</span>
                                              {getSyncStatusBadge(docs)}
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                              {docs.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors">
                                                  <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                                  <span className="truncate flex-1" title={doc.displayName}>{doc.displayName}</span>
                                                  <Badge className={`text-xs flex-shrink-0 ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                  </Badge>
                                                </div>
                                              ))}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        <p className="text-gray-400 text-sm p-2 italic">Nessun documento knowledge base</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                  <Collapsible open={openCategories['exercises']} onOpenChange={() => toggleCategory('exercises')}>
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100">
                                      {openCategories['exercises'] ? <ChevronDown className="h-4 w-4 text-green-600" /> : <ChevronRight className="h-4 w-4 text-green-600" />}
                                      <Dumbbell className="h-5 w-5 text-green-600" />
                                      <span className="font-medium text-gray-800">Esercizi Template</span>
                                      {getSyncStatusBadge(hData.consultantStore.documents.exercises)}
                                      <Badge variant="outline" className="ml-auto">{hData.consultantStore.totals.exercises} esercizi</Badge>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="ml-6 mt-2 space-y-2">
                                      {Object.keys(exerciseGroups).length > 0 ? (
                                        Object.entries(exerciseGroups).map(([category, docs]) => (
                                          <Collapsible key={category} open={openCategories[`ex-${category}`]} onOpenChange={() => toggleCategory(`ex-${category}`)}>
                                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                              {openCategories[`ex-${category}`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                              <Folder className="h-4 w-4 text-green-500" />
                                              <span className="text-sm text-gray-700">{category}</span>
                                              {getSyncStatusBadge(docs)}
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                              {docs.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors">
                                                  <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                                  <span className="truncate flex-1" title={doc.displayName}>{doc.displayName}</span>
                                                  <Badge className={`text-xs flex-shrink-0 ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                  </Badge>
                                                </div>
                                              ))}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        <p className="text-gray-400 text-sm p-2 italic">Nessun esercizio template</p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>

                                </CollapsibleContent>
                              </Collapsible>

                              <Collapsible open={clientStoresOpen} onOpenChange={setClientStoresOpen}>
                                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
                                  {clientStoresOpen ? <ChevronDown className="h-5 w-5 text-purple-600" /> : <ChevronRight className="h-5 w-5 text-purple-600" />}
                                  <Users className="h-5 w-5 text-purple-600" />
                                  <span className="font-semibold text-purple-900">Consulenze per Cliente</span>
                                  <Badge className="ml-auto bg-purple-200 text-purple-800">
                                    {hData.clientStores.filter(c => c.hasDocuments).length}/{hData.clientStores.length} clienti
                                  </Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 ml-4 space-y-2">
                                  {hData.clientStores.length > 0 ? (
                                    hData.clientStores.map(client => (
                                      <Collapsible key={client.clientId} open={openClients[client.clientId]} onOpenChange={() => toggleClient(client.clientId)}>
                                        <CollapsibleTrigger className={`flex items-center gap-2 w-full p-2.5 rounded-lg transition-colors border ${client.hasDocuments ? 'hover:bg-gray-50 border-gray-200' : 'hover:bg-amber-50 border-dashed border-amber-200 bg-amber-25'}`}>
                                          {openClients[client.clientId] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                          <User className={`h-4 w-4 ${client.hasDocuments ? 'text-purple-600' : 'text-amber-500'}`} />
                                          <span className="text-gray-800 font-medium">{client.clientName}</span>
                                          <span className="text-gray-400 text-xs hidden md:inline">({client.clientEmail})</span>
                                          {client.hasDocuments ? (
                                            <Badge variant="outline" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
                                              <CheckCircle2 className="h-3 w-3 mr-1" />{client.totals.total} doc
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">
                                              <AlertCircle className="h-3 w-3 mr-1" />Da sincronizzare
                                            </Badge>
                                          )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="ml-8 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                          {client.hasDocuments ? (
                                            <div className="space-y-3">
                                              {client.totals.exerciseResponses > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-ex`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-ex`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-ex`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Dumbbell className="h-4 w-4 text-green-600" />
                                                    <span className="text-sm text-gray-700">Risposte Esercizi</span>
                                                    {getSyncStatusBadge(client.documents.exerciseResponses)}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {client.documents.exerciseResponses.map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {client.totals.consultationNotes > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-cons`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-cons`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-cons`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <MessageSquare className="h-4 w-4 text-pink-600" />
                                                    <span className="text-sm text-gray-700">Note Consulenze</span>
                                                    {getSyncStatusBadge(client.documents.consultationNotes)}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {client.documents.consultationNotes.map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {client.totals.knowledgeBase > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-kb`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-kb`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-kb`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Brain className="h-4 w-4 text-purple-600" />
                                                    <span className="text-sm text-gray-700">Knowledge Docs</span>
                                                    {getSyncStatusBadge(client.documents.knowledgeBase)}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {client.documents.knowledgeBase.map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.goals || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-goals`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-goals`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-goals`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Target className="h-4 w-4 text-emerald-600" />
                                                    <span className="text-sm text-gray-700">Obiettivi</span>
                                                    {getSyncStatusBadge(client.documents?.goals || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.goals || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.tasks || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-tasks`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-tasks`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-tasks`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <ClipboardCheck className="h-4 w-4 text-orange-600" />
                                                    <span className="text-sm text-gray-700">Task</span>
                                                    {getSyncStatusBadge(client.documents?.tasks || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.tasks || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.dailyReflections || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-reflections`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-reflections`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-reflections`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Heart className="h-4 w-4 text-pink-600" />
                                                    <span className="text-sm text-gray-700">Riflessioni Giornaliere</span>
                                                    {getSyncStatusBadge(client.documents?.dailyReflections || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.dailyReflections || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.clientProgressHistory || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-progress`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-progress`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-progress`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <TrendingUp className="h-4 w-4 text-teal-600" />
                                                    <span className="text-sm text-gray-700">Storico Progressi</span>
                                                    {getSyncStatusBadge(client.documents?.clientProgressHistory || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.clientProgressHistory || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.libraryProgress || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-libprog`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-libprog`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-libprog`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <BookOpen className="h-4 w-4 text-cyan-600" />
                                                    <span className="text-sm text-gray-700">Progressi Libreria</span>
                                                    {getSyncStatusBadge(client.documents?.libraryProgress || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.libraryProgress || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.emailJourneyProgress || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-emailprog`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-emailprog`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-emailprog`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Mail className="h-4 w-4 text-violet-600" />
                                                    <span className="text-sm text-gray-700">Progressi Email Journey</span>
                                                    {getSyncStatusBadge(client.documents?.emailJourneyProgress || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.emailJourneyProgress || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.assignedExercises || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-assignedex`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-assignedex`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-assignedex`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Dumbbell className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm text-gray-700">Esercizi Assegnati</span>
                                                    {getSyncStatusBadge(client.documents?.assignedExercises || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.assignedExercises || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.assignedLibrary || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-assignedlib`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-assignedlib`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-assignedlib`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <BookOpen className="h-4 w-4 text-indigo-600" />
                                                    <span className="text-sm text-gray-700">Libreria Assegnata</span>
                                                    {getSyncStatusBadge(client.documents?.assignedLibrary || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.assignedLibrary || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.assignedUniversity || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-assigneduni`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-assigneduni`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-assigneduni`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <GraduationCap className="h-4 w-4 text-amber-600" />
                                                    <span className="text-sm text-gray-700">University Assegnata</span>
                                                    {getSyncStatusBadge(client.documents?.assignedUniversity || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.assignedUniversity || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <FileText className="h-3 w-3 text-gray-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {(client.totals?.externalDocs || 0) > 0 && (
                                                <Collapsible open={openCategories[`client-${client.clientId}-extdocs`]} onOpenChange={() => toggleCategory(`client-${client.clientId}-extdocs`)}>
                                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-white rounded-lg transition-colors">
                                                    {openCategories[`client-${client.clientId}-extdocs`] ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
                                                    <Link className="h-4 w-4 text-orange-600" />
                                                    <span className="text-sm text-gray-700">Documenti Esterni</span>
                                                    {getSyncStatusBadge(client.documents?.externalDocs || [])}
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                                                    {(client.documents?.externalDocs || []).map(doc => (
                                                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-white rounded text-sm">
                                                        <Link className="h-3 w-3 text-orange-400" />
                                                        <span className="truncate flex-1">{doc.displayName}</span>
                                                        <Badge className={`text-xs ${doc.status === 'indexed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                          {doc.status === 'indexed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        </Badge>
                                                      </div>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                              {client.totals.exerciseResponses === 0 && client.totals.consultationNotes === 0 && client.totals.knowledgeBase === 0 && 
                                               (client.totals?.goals || 0) === 0 && (client.totals?.tasks || 0) === 0 && (client.totals?.dailyReflections || 0) === 0 &&
                                               (client.totals?.clientProgressHistory || 0) === 0 && (client.totals?.libraryProgress || 0) === 0 && (client.totals?.emailJourneyProgress || 0) === 0 &&
                                               (client.totals?.assignedExercises || 0) === 0 && (client.totals?.assignedLibrary || 0) === 0 && (client.totals?.assignedUniversity || 0) === 0 && 
                                               (client.totals?.externalDocs || 0) === 0 && (
                                                <p className="text-gray-500 text-sm text-center py-2">Nessun documento categorizzato</p>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="text-center py-3">
                                              <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                                              <p className="text-amber-600 text-sm font-medium mb-1">Nessun documento sincronizzato</p>
                                              <p className="text-gray-500 text-xs mb-3">Contenuti disponibili per la sincronizzazione:</p>
                                              <div className="flex flex-wrap justify-center gap-2">
                                                <Badge variant="outline" className="text-xs"><Dumbbell className="h-3 w-3 mr-1" />Risposte Esercizi</Badge>
                                                <Badge variant="outline" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Note Consulenze</Badge>
                                                <Badge variant="outline" className="text-xs"><Brain className="h-3 w-3 mr-1" />Knowledge Docs</Badge>
                                                <Badge variant="outline" className="text-xs"><Target className="h-3 w-3 mr-1" />Obiettivi</Badge>
                                                <Badge variant="outline" className="text-xs"><ClipboardCheck className="h-3 w-3 mr-1" />Task</Badge>
                                                <Badge variant="outline" className="text-xs"><Heart className="h-3 w-3 mr-1" />Riflessioni</Badge>
                                                <Badge variant="outline" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" />Progressi</Badge>
                                                <Badge variant="outline" className="text-xs"><BookOpen className="h-3 w-3 mr-1" />Libreria</Badge>
                                                <Badge variant="outline" className="text-xs"><Mail className="h-3 w-3 mr-1" />Email Journey</Badge>
                                                <Badge variant="outline" className="text-xs"><GraduationCap className="h-3 w-3 mr-1" />University</Badge>
                                                <Badge variant="outline" className="text-xs"><Link className="h-3 w-3 mr-1" />Doc Esterni</Badge>
                                              </div>
                                              <p className="text-gray-400 text-xs mt-3">Vai alla tab Audit per sincronizzare</p>
                                            </div>
                                          )}
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))
                                  ) : (
                                    <div className="text-center py-6">
                                      <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                      <p className="text-gray-400 text-sm">Nessun cliente associato</p>
                                    </div>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-gray-500 mb-2">Nessun documento sincronizzato</p>
                              <p className="text-sm text-gray-400 mb-4">
                                Vai nelle Impostazioni e clicca "Sincronizza Tutti i Documenti" per iniziare
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => syncAllMutation.mutate()}
                                disabled={syncAllMutation.isPending}
                              >
                                {syncAllMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Sincronizza Ora
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="usage" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Log Chiamate Recenti</CardTitle>
                    <CardDescription>
                      Ultime 50 chiamate AI con dettagli File Search
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3">Data</th>
                              <th className="text-left py-2 px-3">Tipo</th>
                              <th className="text-left py-2 px-3">Provider</th>
                              <th className="text-center py-2 px-3">File Search</th>
                              <th className="text-right py-2 px-3">Citazioni</th>
                              <th className="text-right py-2 px-3">Token Salvati</th>
                              <th className="text-right py-2 px-3">Tempo (ms)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.recentLogs.map((log) => (
                              <tr key={log.id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  {log.createdAt ? new Date(log.createdAt).toLocaleString('it-IT') : '-'}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant="outline">{log.requestType}</Badge>
                                </td>
                                <td className="py-2 px-3">
                                  <span className={log.providerUsed === 'google_ai_studio' ? 'text-emerald-600' : 'text-gray-600'}>
                                    {log.providerUsed === 'google_ai_studio' ? 'AI Studio' : log.providerUsed}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {log.usedFileSearch ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">{log.citationsCount || 0}</td>
                                <td className="py-2 px-3 text-right">{(log.tokensSaved || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{log.responseTimeMs || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Nessun log disponibile
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Impostazioni File Search
                    </CardTitle>
                    <CardDescription>
                      Configura il comportamento di File Search per il tuo account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">File Search Abilitato</Label>
                        <p className="text-sm text-gray-500">
                          Attiva la ricerca semantica nei tuoi documenti
                        </p>
                      </div>
                      <Switch
                        checked={settings?.enabled ?? true}
                        onCheckedChange={(checked) => handleToggle('enabled', checked)}
                        disabled={updateSettingsMutation.isPending}
                      />
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        Sincronizzazione Automatica Programmata
                      </h4>
                      
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <Label className="text-base font-medium text-blue-900">Sincronizzazione Giornaliera</Label>
                            <p className="text-sm text-blue-700">
                              I documenti verranno sincronizzati automaticamente ogni giorno all'ora selezionata (orario italiano)
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={settings?.scheduledSyncHour?.toString() ?? "3"}
                              onValueChange={(value) => handleToggle('scheduledSyncHour', parseInt(value))}
                              disabled={updateSettingsMutation.isPending || !(settings?.scheduledSyncEnabled ?? false)}
                            >
                              <SelectTrigger className="w-[80px] bg-white">
                                <SelectValue placeholder="Ora" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-gray-500 font-medium">:</span>
                            <Select
                              value={settings?.scheduledSyncMinute?.toString() ?? "0"}
                              onValueChange={(value) => handleToggle('scheduledSyncMinute', parseInt(value))}
                              disabled={updateSettingsMutation.isPending || !(settings?.scheduledSyncEnabled ?? false)}
                            >
                              <SelectTrigger className="w-[80px] bg-white">
                                <SelectValue placeholder="Min" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 60 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Switch
                              checked={settings?.scheduledSyncEnabled ?? false}
                              onCheckedChange={(checked) => handleToggle('scheduledSyncEnabled', checked)}
                              disabled={updateSettingsMutation.isPending}
                            />
                          </div>
                        </div>
                        {settings?.lastScheduledSync && (
                          <p className="text-xs text-blue-600 mt-2">
                            Ultima sincronizzazione programmata: {new Date(settings.lastScheduledSync).toLocaleString('it-IT')}
                          </p>
                        )}
                      </div>

                      <h5 className="font-medium mb-3 text-gray-700">Sorgenti da Sincronizzare</h5>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Guide Consulente</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le guide della piattaforma</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncConsultantGuides ?? true}
                            onCheckedChange={(checked) => handleToggle('autoSyncConsultantGuides', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Libreria Documenti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i documenti della libreria</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncLibrary ?? true}
                            onCheckedChange={(checked) => handleToggle('autoSyncLibrary', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Knowledge Base</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente la knowledge base</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncKnowledgeBase ?? true}
                            onCheckedChange={(checked) => handleToggle('autoSyncKnowledgeBase', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Esercizi</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente gli esercizi</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncExercises ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncExercises', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Consultazioni</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le consultazioni</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncConsultations ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncConsultations', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>University</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le lezioni</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncUniversity ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncUniversity', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Risposte Esercizi Clienti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le risposte degli esercizi dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncExerciseResponses ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncExerciseResponses', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Knowledge Base Clienti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente la knowledge base dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncClientKnowledge ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncClientKnowledge', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Dati Finanziari Clienti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i dati finanziari dei clienti (Percorso Capitale)</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncFinancial ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncFinancial', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Agenti WhatsApp</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente la knowledge base degli agenti WhatsApp</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncWhatsappAgents ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncWhatsappAgents', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="border-t pt-4 mt-4">
                          <h6 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Dati Personali Clienti
                          </h6>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Obiettivi Clienti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente gli obiettivi dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncGoals ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncGoals', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Task Clienti</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i task dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncTasks ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncTasks', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Riflessioni Giornaliere</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le riflessioni giornaliere dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncDailyReflections ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncDailyReflections', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="border-t pt-4 mt-4">
                          <h6 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Tracciamento Progressi
                          </h6>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Storico Progressi Cliente</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente lo storico dei progressi dei clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncClientProgress ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncClientProgress', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Progressi Libreria</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i progressi nella libreria</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncLibraryProgress ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncLibraryProgress', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Progressi Email Journey</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i progressi dell'email journey</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncEmailJourney ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncEmailJourney', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="border-t pt-4 mt-4">
                          <h6 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" />
                            Contenuti Assegnati
                          </h6>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Esercizi Assegnati</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente gli esercizi assegnati ai clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncAssignedExercises ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncAssignedExercises', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Libreria Assegnata</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i documenti libreria assegnati ai clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncAssignedLibrary ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncAssignedLibrary', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>University Assegnata</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente le lezioni university assegnate ai clienti</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncAssignedUniversity ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncAssignedUniversity', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Documenti Esterni Esercizi</Label>
                            <p className="text-sm text-gray-500">Sincronizza automaticamente i Google Docs collegati agli esercizi</p>
                          </div>
                          <Switch
                            checked={settings?.autoSyncExerciseExternalDocs ?? false}
                            onCheckedChange={(checked) => handleToggle('autoSyncExerciseExternalDocs', checked)}
                            disabled={updateSettingsMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-4">Sincronizzazione Manuale</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={startSyncWithSSE}
                          disabled={isSyncing || isResetting}
                          className="flex-1"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sincronizza Tutti i Documenti
                        </Button>
                        
                        <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50"
                              disabled={isSyncing || isResetting}
                            >
                              {isResetting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Reset Completo
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confermi eliminazione di tutti i documenti?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa operazione eliminerà TUTTI i documenti da Google File Search (store consulente e clienti).
                                <br /><br />
                                I dati originali nel database rimangono intatti. Dopo il reset, clicca "Sincronizza Tutti i Documenti" per ricaricare tutto.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={startResetOnly} className="bg-red-600 hover:bg-red-700">
                                Conferma Reset
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        {(syncLogs.length > 0 || Object.keys(categoryProgress).length > 0) && (
                          <Button
                            variant="outline"
                            onClick={() => setSyncConsoleOpen(!syncConsoleOpen)}
                          >
                            {syncConsoleOpen ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                            Console
                          </Button>
                        )}
                      </div>
                      
                      {syncConsoleOpen && (syncLogs.length > 0 || Object.keys(categoryProgress).length > 0) && (
                        <div className="mt-4 space-y-4">
                          {/* Barre di progresso per categoria */}
                          {Object.keys(categoryProgress).length > 0 && (
                            <div className="bg-gray-50 rounded-lg border p-4 space-y-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-sm flex items-center gap-2">
                                  <Activity className="h-4 w-4" />
                                  Progresso per Categoria
                                  {isSyncing && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                                </h5>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={showDetailedLogs} 
                                      onChange={(e) => setShowDetailedLogs(e.target.checked)}
                                      className="h-3 w-3"
                                    />
                                    Log dettagliati
                                  </label>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(categoryProgress).map(([category, progress]) => {
                                  const catInfo = CATEGORY_LABELS[category] || { label: category, icon: '📄', color: 'bg-gray-500' };
                                  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
                                  
                                  return (
                                    <div key={category} className="bg-white rounded-lg border p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium flex items-center gap-2">
                                          <span>{catInfo.icon}</span>
                                          {catInfo.label}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {progress.status === 'complete' ? (
                                            <span className="text-emerald-600 font-medium">
                                              {category === 'orphans' 
                                                ? (progress.synced === 0 ? 'Nessun orfano' : `${progress.synced} rimoss${progress.synced === 1 ? 'o' : 'i'}`)
                                                : `${progress.synced || progress.current}/${progress.total}`
                                              }
                                            </span>
                                          ) : progress.status === 'error' ? (
                                            <span className="text-red-600">Errore</span>
                                          ) : (
                                            `${progress.current}/${progress.total}`
                                          )}
                                        </span>
                                      </div>
                                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all duration-300 ${
                                            progress.status === 'complete' ? 'bg-emerald-500' :
                                            progress.status === 'error' ? 'bg-red-500' :
                                            catInfo.color
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      {progress.status === 'syncing' && progress.lastItem && (
                                        <p className="text-xs text-gray-400 mt-1 truncate" title={progress.lastItem}>
                                          {progress.lastItem}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Log riassuntivi */}
                          {syncLogs.length > 0 && (
                            <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                                <span className="text-sm font-mono text-gray-300 flex items-center gap-2">
                                  Log Eventi
                                </span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => { setSyncLogs([]); setCategoryProgress({}); }}
                                  className="h-6 text-gray-400 hover:text-white"
                                >
                                  Pulisci
                                </Button>
                              </div>
                              <div 
                                ref={logContainerRef}
                                onScroll={handleScrollConsole}
                                className="p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1"
                              >
                                {syncLogs.map(log => (
                                  <div 
                                    key={log.id} 
                                    className={`flex items-start gap-2 ${
                                      log.type === 'error' ? 'text-red-400' :
                                      log.type === 'success' ? 'text-emerald-400' :
                                      log.type === 'complete' ? 'text-blue-400 font-bold' :
                                      log.type === 'progress' ? 'text-gray-400' :
                                      'text-gray-300'
                                    }`}
                                  >
                                    <span className="text-gray-500 flex-shrink-0">
                                      {log.timestamp.toLocaleTimeString('it-IT')}
                                    </span>
                                    <span className="break-all">{log.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {settings?.lastSyncAt && (
                        <p className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Ultima sincronizzazione: {new Date(settings.lastSyncAt).toLocaleString('it-IT')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stato Configurazione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>GEMINI_API_KEY</span>
                        {analytics?.geminiApiKeyConfigured ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Configurata
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non configurata
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>File Search Stores</span>
                        <Badge variant={analytics?.summary.totalStores ? "default" : "secondary"}>
                          {analytics?.summary.totalStores || 0} store
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span>Documenti Indicizzati</span>
                        <Badge variant={analytics?.summary.totalDocuments ? "default" : "secondary"}>
                          {analytics?.summary.totalDocuments || 0} documenti
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Trash2 className="h-5 w-5" />
                      Migrazione Privacy - Reset Store
                    </CardTitle>
                    <CardDescription>
                      Dopo la correzione del bug di isolamento dati, usa questi pulsanti per pulire gli store e ri-sincronizzare con la logica corretta.
                      <strong className="block mt-2 text-amber-600">
                        I dati sensibili dei clienti (consulenze, finanze) ora vengono salvati nei loro store privati invece che nello store condiviso.
                      </strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 mb-3">
                        <strong>Procedura consigliata:</strong>
                      </p>
                      <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
                        <li>Clicca "Reset Tutti gli Store" per eliminare i dati con la logica vecchia</li>
                        <li>Torna in alto e clicca "Sincronizza Tutti i Documenti"</li>
                        <li>I nuovi dati verranno salvati con la logica corretta (privacy isolata)</li>
                      </ol>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => resetStoresMutation.mutate('consultant')}
                        disabled={resetStoresMutation.isPending}
                      >
                        {resetStoresMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Reset Store Consulente
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => resetStoresMutation.mutate('clients')}
                        disabled={resetStoresMutation.isPending}
                      >
                        {resetStoresMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Reset Store Clienti
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => resetStoresMutation.mutate('all')}
                        disabled={resetStoresMutation.isPending}
                      >
                        {resetStoresMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Reset Tutti gli Store
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      File Search per Cliente
                    </CardTitle>
                    <CardDescription>
                      Attiva o disattiva File Search per ogni cliente. Quando disattivato, l'AI userà il contesto tradizionale.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {clientsFileSearchLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    ) : clientsFileSearch && clientsFileSearch.length > 0 ? (
                      <div className="space-y-3">
                        {clientsFileSearch.map((client) => (
                          <div
                            key={client.id}
                            className={`flex items-center justify-between p-4 rounded-lg border ${
                              client.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                                client.fileSearchEnabled !== false ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}>
                                {client.firstName?.[0]?.toUpperCase() || '?'}
                                {client.lastName?.[0]?.toUpperCase() || ''}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {client.firstName} {client.lastName}
                                  {!client.isActive && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      Inattivo
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">{client.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-medium ${
                                client.fileSearchEnabled !== false ? 'text-emerald-600' : 'text-gray-500'
                              }`}>
                                {client.fileSearchEnabled !== false ? 'Attivo' : 'Disattivato'}
                              </span>
                              <Switch
                                checked={client.fileSearchEnabled !== false}
                                onCheckedChange={(checked) => 
                                  updateClientFileSearchMutation.mutate({ 
                                    clientId: client.id, 
                                    fileSearchEnabled: checked 
                                  })
                                }
                                disabled={updateClientFileSearchMutation.isPending}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>Nessun cliente trovato</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Audit Sincronizzazione
                    </CardTitle>
                    <CardDescription>
                      Verifica cosa manca e deve essere sincronizzato nel File Search
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Completezza Indicizzazione</span>
                        <span className={`font-bold ${getHealthScoreColor(auditData?.summary?.healthScore || 0)}`}>
                          {auditData?.summary?.healthScore || 0}%
                        </span>
                      </div>
                      <Progress 
                        value={auditData?.summary?.healthScore || 0} 
                        className="h-3"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-2xl font-bold text-red-700">
                          {auditData?.summary?.totalMissing || 0}
                        </p>
                        <p className="text-sm text-red-600">Elementi Mancanti</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-2xl font-bold text-amber-700">
                          {auditData?.summary?.totalOutdated || 0}
                        </p>
                        <p className="text-sm text-amber-600">Documenti Obsoleti</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-2xl font-bold text-blue-700">
                          {auditData?.summary?.consultantMissing || 0}
                        </p>
                        <p className="text-sm text-blue-600">Store Globale</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-2xl font-bold text-purple-700">
                          {auditData?.summary?.clientsMissing || 0}
                        </p>
                        <p className="text-sm text-purple-600">Store Privati Clienti</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-2xl font-bold text-green-700">
                          {auditData?.summary?.whatsappAgentsMissing || 0}
                        </p>
                        <p className="text-sm text-green-600">Agenti WhatsApp</p>
                      </div>
                    </div>

                    {auditData?.recommendations && auditData.recommendations.length > 0 && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          Raccomandazioni
                        </h4>
                        <ul className="space-y-1">
                          {auditData.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-600">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-blue-600" />
                      Store Globale - Elementi Mancanti
                    </CardTitle>
                    <CardDescription>
                      Documenti del consulente non ancora indicizzati
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Collapsible open={openAuditCategories['consultantGuide']} onOpenChange={() => toggleAuditCategory('consultantGuide')}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors">
                        {openAuditCategories['consultantGuide'] ? <ChevronDown className="h-4 w-4 text-indigo-600" /> : <ChevronRight className="h-4 w-4 text-indigo-600" />}
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        <span className="font-medium text-indigo-900">Guida Piattaforma</span>
                        <div className="ml-auto flex items-center gap-2">
                          {(auditData?.consultant?.consultantGuide?.missing?.length || 0) > 0 && (
                            <Badge className="bg-red-200 text-red-800">
                              {auditData?.consultant?.consultantGuide?.missing?.length || 0} mancanti
                            </Badge>
                          )}
                          {(auditData?.consultant?.consultantGuide?.outdated?.length || 0) > 0 && (
                            <Badge className="bg-amber-200 text-amber-800">
                              {auditData?.consultant?.consultantGuide?.outdated?.length || 0} obsoleti
                            </Badge>
                          )}
                          {(auditData?.consultant?.consultantGuide?.missing?.length || 0) === 0 && (auditData?.consultant?.consultantGuide?.outdated?.length || 0) === 0 && (
                            <Badge className="bg-emerald-200 text-emerald-800">
                              Sincronizzato
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {(auditData?.consultant?.consultantGuide?.missing?.length || 0) === 0 && (auditData?.consultant?.consultantGuide?.outdated?.length || 0) === 0 ? (
                          <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Guida piattaforma sincronizzata e aggiornata
                          </p>
                        ) : (
                          <>
                            {(auditData?.consultant?.consultantGuide?.missing?.length || 0) > 0 && (
                              <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-red-400" />
                                  <span className="text-sm">Guida Completa Piattaforma</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-300 text-red-700"
                                  onClick={() => syncSingleMutation.mutate({ type: 'consultant_guide', id: 'guide' })}
                                  disabled={syncSingleMutation.isPending}
                                >
                                  {syncSingleMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Sync
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                            {(auditData?.consultant?.consultantGuide?.outdated?.length || 0) > 0 && (
                              <div className="mt-2">
                                <h5 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Guida da aggiornare
                                </h5>
                                {auditData?.consultant?.consultantGuide?.outdated?.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium">{doc.title}</span>
                                      </div>
                                      {doc.indexedAt && (
                                        <p className="text-xs text-amber-600 mt-1">
                                          Ultima sincronizzazione: {new Date(doc.indexedAt).toLocaleDateString('it-IT')}
                                        </p>
                                      )}
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={() => syncSingleMutation.mutate({ type: 'consultant_guide', id: 'guide' })}
                                      disabled={syncSingleMutation.isPending}
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Aggiorna
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={openAuditCategories['library']} onOpenChange={() => toggleAuditCategory('library')}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                        {openAuditCategories['library'] ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-blue-600" />}
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Libreria</span>
                        <div className="ml-auto flex items-center gap-2">
                          {(auditData?.consultant?.library?.missing?.length || 0) > 0 && (
                            <Badge className="bg-red-200 text-red-800">
                              {auditData?.consultant?.library?.missing?.length || 0} mancanti
                            </Badge>
                          )}
                          {(auditData?.consultant?.library?.outdated?.length || 0) > 0 && (
                            <Badge className="bg-amber-200 text-amber-800">
                              {auditData?.consultant?.library?.outdated?.length || 0} obsoleti
                            </Badge>
                          )}
                          {(auditData?.consultant?.library?.missing?.length || 0) === 0 && (auditData?.consultant?.library?.outdated?.length || 0) === 0 && (
                            <Badge className="bg-emerald-200 text-emerald-800">
                              Sincronizzato
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {auditData?.consultant?.library?.missing?.length === 0 && auditData?.consultant?.library?.outdated?.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Tutti i documenti della libreria sono indicizzati e aggiornati
                          </p>
                        ) : (
                          <>
                            {auditData?.consultant?.library?.missing?.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-red-400" />
                                  <span className="text-sm">{doc.title}</span>
                                  <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-300 text-red-700"
                                  onClick={() => syncSingleMutation.mutate({ type: 'library', id: doc.id })}
                                  disabled={syncSingleMutation.isPending}
                                >
                                  {syncSingleMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Sync
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                            {(auditData?.consultant?.library?.outdated?.length || 0) > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <h5 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Documenti da aggiornare
                                </h5>
                                {auditData?.consultant?.library?.outdated?.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 mb-1">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium">{doc.title}</span>
                                        {doc.type && <Badge variant="outline" className="text-xs">{doc.type}</Badge>}
                                      </div>
                                      <p className="text-xs text-amber-600 mt-1">
                                        Sincronizzato: {new Date(doc.indexedAt).toLocaleDateString('it-IT')} | Modificato: {new Date(doc.sourceUpdatedAt).toLocaleDateString('it-IT')}
                                      </p>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={() => syncSingleMutation.mutate({ type: 'library', id: doc.id })}
                                      disabled={syncSingleMutation.isPending}
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Aggiorna
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={openAuditCategories['kb']} onOpenChange={() => toggleAuditCategory('kb')}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
                        {openAuditCategories['kb'] ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
                        <Brain className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-purple-900">Knowledge Base</span>
                        <div className="ml-auto flex items-center gap-2">
                          {(auditData?.consultant?.knowledgeBase?.missing?.length || 0) > 0 && (
                            <Badge className="bg-red-200 text-red-800">
                              {auditData?.consultant?.knowledgeBase?.missing?.length || 0} mancanti
                            </Badge>
                          )}
                          {(auditData?.consultant?.knowledgeBase?.outdated?.length || 0) > 0 && (
                            <Badge className="bg-amber-200 text-amber-800">
                              {auditData?.consultant?.knowledgeBase?.outdated?.length || 0} obsoleti
                            </Badge>
                          )}
                          {(auditData?.consultant?.knowledgeBase?.missing?.length || 0) === 0 && (auditData?.consultant?.knowledgeBase?.outdated?.length || 0) === 0 && (
                            <Badge className="bg-emerald-200 text-emerald-800">
                              Sincronizzato
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {auditData?.consultant?.knowledgeBase?.missing?.length === 0 && auditData?.consultant?.knowledgeBase?.outdated?.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Tutti i documenti della knowledge base sono indicizzati e aggiornati
                          </p>
                        ) : (
                          <>
                            {auditData?.consultant?.knowledgeBase?.missing?.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-red-400" />
                                  <span className="text-sm">{doc.title}</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-300 text-red-700"
                                  onClick={() => syncSingleMutation.mutate({ type: 'knowledge_base', id: doc.id })}
                                  disabled={syncSingleMutation.isPending}
                                >
                                  {syncSingleMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Sync
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                            {(auditData?.consultant?.knowledgeBase?.outdated?.length || 0) > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <h5 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Documenti da aggiornare
                                </h5>
                                {auditData?.consultant?.knowledgeBase?.outdated?.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 mb-1">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium">{doc.title}</span>
                                      </div>
                                      <p className="text-xs text-amber-600 mt-1">
                                        Sincronizzato: {new Date(doc.indexedAt).toLocaleDateString('it-IT')} | Modificato: {new Date(doc.sourceUpdatedAt).toLocaleDateString('it-IT')}
                                      </p>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={() => syncSingleMutation.mutate({ type: 'knowledge_base', id: doc.id })}
                                      disabled={syncSingleMutation.isPending}
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Aggiorna
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={openAuditCategories['exercises']} onOpenChange={() => toggleAuditCategory('exercises')}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                        {openAuditCategories['exercises'] ? <ChevronDown className="h-4 w-4 text-green-600" /> : <ChevronRight className="h-4 w-4 text-green-600" />}
                        <Dumbbell className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Esercizi</span>
                        <div className="ml-auto flex items-center gap-2">
                          {(auditData?.consultant?.exercises?.missing?.length || 0) > 0 && (
                            <Badge className="bg-red-200 text-red-800">
                              {auditData?.consultant?.exercises?.missing?.length || 0} mancanti
                            </Badge>
                          )}
                          {(auditData?.consultant?.exercises?.outdated?.length || 0) > 0 && (
                            <Badge className="bg-amber-200 text-amber-800">
                              {auditData?.consultant?.exercises?.outdated?.length || 0} obsoleti
                            </Badge>
                          )}
                          {(auditData?.consultant?.exercises?.missing?.length || 0) === 0 && (auditData?.consultant?.exercises?.outdated?.length || 0) === 0 && (
                            <Badge className="bg-emerald-200 text-emerald-800">
                              Sincronizzato
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {auditData?.consultant?.exercises?.missing?.length === 0 && auditData?.consultant?.exercises?.outdated?.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Tutti gli esercizi sono indicizzati e aggiornati
                          </p>
                        ) : (
                          <>
                            {auditData?.consultant?.exercises?.missing?.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2">
                                  <Dumbbell className="h-4 w-4 text-red-400" />
                                  <span className="text-sm">{doc.title}</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-300 text-red-700"
                                  onClick={() => syncSingleMutation.mutate({ type: 'exercise', id: doc.id })}
                                  disabled={syncSingleMutation.isPending}
                                >
                                  {syncSingleMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Sync
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                            {(auditData?.consultant?.exercises?.outdated?.length || 0) > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <h5 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Esercizi da aggiornare
                                </h5>
                                {auditData?.consultant?.exercises?.outdated?.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 mb-1">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <Dumbbell className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium">{doc.title}</span>
                                      </div>
                                      <p className="text-xs text-amber-600 mt-1">
                                        Sincronizzato: {new Date(doc.indexedAt).toLocaleDateString('it-IT')} | Modificato: {new Date(doc.sourceUpdatedAt).toLocaleDateString('it-IT')}
                                      </p>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={() => syncSingleMutation.mutate({ type: 'exercise', id: doc.id })}
                                      disabled={syncSingleMutation.isPending}
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Aggiorna
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={openAuditCategories['university']} onOpenChange={() => toggleAuditCategory('university')}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors">
                        {openAuditCategories['university'] ? <ChevronDown className="h-4 w-4 text-yellow-600" /> : <ChevronRight className="h-4 w-4 text-yellow-600" />}
                        <GraduationCap className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-900">University</span>
                        <div className="ml-auto flex items-center gap-2">
                          {(auditData?.consultant?.university?.missing?.length || 0) > 0 && (
                            <Badge className="bg-red-200 text-red-800">
                              {auditData?.consultant?.university?.missing?.length || 0} mancanti
                            </Badge>
                          )}
                          {(auditData?.consultant?.university?.outdated?.length || 0) > 0 && (
                            <Badge className="bg-amber-200 text-amber-800">
                              {auditData?.consultant?.university?.outdated?.length || 0} obsoleti
                            </Badge>
                          )}
                          {(auditData?.consultant?.university?.missing?.length || 0) === 0 && (auditData?.consultant?.university?.outdated?.length || 0) === 0 && (
                            <Badge className="bg-emerald-200 text-emerald-800">
                              Sincronizzato
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {auditData?.consultant?.university?.missing?.length === 0 && auditData?.consultant?.university?.outdated?.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Tutte le lezioni university sono indicizzate e aggiornate
                          </p>
                        ) : (
                          <>
                            {auditData?.consultant?.university?.missing?.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center gap-2">
                                  <GraduationCap className="h-4 w-4 text-red-400" />
                                  <span className="text-sm">{doc.title} - {doc.lessonTitle}</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-300 text-red-700"
                                  onClick={() => syncSingleMutation.mutate({ type: 'university_lesson', id: doc.id })}
                                  disabled={syncSingleMutation.isPending}
                                >
                                  {syncSingleMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Sync
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                            {(auditData?.consultant?.university?.outdated?.length || 0) > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <h5 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Lezioni da aggiornare
                                </h5>
                                {auditData?.consultant?.university?.outdated?.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 mb-1">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium">{doc.title}{doc.lessonTitle ? ` - ${doc.lessonTitle}` : ''}</span>
                                      </div>
                                      <p className="text-xs text-amber-600 mt-1">
                                        Sincronizzato: {new Date(doc.indexedAt).toLocaleDateString('it-IT')} | Modificato: {new Date(doc.sourceUpdatedAt).toLocaleDateString('it-IT')}
                                      </p>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={() => syncSingleMutation.mutate({ type: 'university_lesson', id: doc.id })}
                                      disabled={syncSingleMutation.isPending}
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Aggiorna
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600" />
                      Store Privati Clienti - Elementi Mancanti
                    </CardTitle>
                    <CardDescription>
                      Dati privati dei clienti non ancora indicizzati
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(!auditData?.clients || auditData.clients.length === 0) ? (
                      <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
                        Nessun cliente con dati da sincronizzare
                      </p>
                    ) : (
                      auditData.clients.map(client => {
                        const clientMissing = (client.exerciseResponses?.missing?.length || 0) + 
                                              (client.consultationNotes?.missing?.length || 0) +
                                              (client.knowledgeDocs?.missing?.length || 0) +
                                              (client.assignedExercises?.missing?.length || 0) +
                                              (client.assignedLibrary?.missing?.length || 0) +
                                              (client.assignedUniversity?.missing?.length || 0) +
                                              (client.externalDocs?.missing?.length || 0) +
                                              (client.goals?.missing?.length || 0) +
                                              (client.tasks?.missing?.length || 0) +
                                              (client.dailyReflections?.missing?.length || 0) +
                                              (client.clientProgressHistory?.missing?.length || 0) +
                                              (client.libraryProgress?.missing?.length || 0) +
                                              (client.emailJourneyProgress?.missing?.length || 0);
                        return (
                          <Collapsible key={client.clientId} open={openAuditClients[client.clientId]} onOpenChange={() => toggleAuditClient(client.clientId)}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
                              {openAuditClients[client.clientId] ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
                              <User className="h-4 w-4 text-purple-600" />
                              <span className="font-medium text-purple-900">{client.clientName}</span>
                              <span className="text-sm text-gray-500">({client.clientEmail})</span>
                              <Badge className={`ml-auto ${clientMissing > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                {clientMissing} mancanti
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 ml-6 space-y-2">
                              {client.assignedExercises?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-assignedExercises`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'assignedExercises')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-assignedExercises`] ?? false) ? <ChevronDown className="h-3 w-3 text-blue-600" /> : <ChevronRight className="h-3 w-3 text-blue-600" />}
                                    <Dumbbell className="h-3 w-3 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Esercizi Assegnati</span>
                                    <Badge className="ml-auto bg-blue-200 text-blue-800">{client.assignedExercises.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.assignedExercises.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <Dumbbell className="h-3 w-3 text-blue-500" />
                                          <span className="text-sm">{item.title}</span>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'assigned_exercise', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                          className="border-blue-300 hover:bg-blue-100"
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.assignedLibrary?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-assignedLibrary`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'assignedLibrary')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-assignedLibrary`] ?? false) ? <ChevronDown className="h-3 w-3 text-indigo-600" /> : <ChevronRight className="h-3 w-3 text-indigo-600" />}
                                    <BookOpen className="h-3 w-3 text-indigo-600" />
                                    <span className="text-sm font-medium text-indigo-700">Documenti Libreria Assegnati</span>
                                    <Badge className="ml-auto bg-indigo-200 text-indigo-800">{client.assignedLibrary.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.assignedLibrary.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-indigo-50 rounded border border-indigo-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <BookOpen className="h-3 w-3 text-indigo-500" />
                                          <span className="text-sm">{item.title}</span>
                                          {item.categoryName && (
                                            <Badge variant="outline" className="text-xs">{item.categoryName}</Badge>
                                          )}
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'assigned_library', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                          className="border-indigo-300 hover:bg-indigo-100"
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.assignedUniversity?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-assignedUniversity`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'assignedUniversity')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-assignedUniversity`] ?? false) ? <ChevronDown className="h-3 w-3 text-amber-600" /> : <ChevronRight className="h-3 w-3 text-amber-600" />}
                                    <GraduationCap className="h-3 w-3 text-amber-600" />
                                    <span className="text-sm font-medium text-amber-700">Lezioni University Assegnate</span>
                                    <Badge className="ml-auto bg-amber-200 text-amber-800">{client.assignedUniversity.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.assignedUniversity.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <GraduationCap className="h-3 w-3 text-amber-500" />
                                          <span className="text-sm">{item.title}</span>
                                          {item.yearName && (
                                            <Badge variant="outline" className="text-xs">{item.yearName}</Badge>
                                          )}
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'assigned_university', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                          className="border-amber-300 hover:bg-amber-100"
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.externalDocs?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-externalDocs`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'externalDocs')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-externalDocs`] ?? false) ? <ChevronDown className="h-3 w-3 text-red-600" /> : <ChevronRight className="h-3 w-3 text-red-600" />}
                                    <FileText className="h-3 w-3 text-red-600" />
                                    <span className="text-sm font-medium text-red-700">Documenti Esterni (Google Docs)</span>
                                    <Badge className="ml-auto bg-red-200 text-red-800">{client.externalDocs.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.externalDocs.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-3 w-3 text-red-500" />
                                          <span className="text-sm">{item.title}</span>
                                          {item.isPersonalized && (
                                            <Badge variant="outline" className="text-xs bg-red-100">Personalizzato</Badge>
                                          )}
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'external_doc', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                          className="border-red-300 hover:bg-red-100"
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.goals?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-goals`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'goals')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-goals`] ?? false) ? <ChevronDown className="h-3 w-3 text-emerald-600" /> : <ChevronRight className="h-3 w-3 text-emerald-600" />}
                                    <Target className="h-3 w-3 text-emerald-600" />
                                    <span className="text-sm font-medium text-emerald-700">Goals</span>
                                    <Badge className="ml-auto bg-emerald-200 text-emerald-800">{client.goals.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.goals.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <Target className="h-3 w-3 text-emerald-500" />
                                          <span className="text-sm">{item.title}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.tasks?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-tasks`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'tasks')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-tasks`] ?? false) ? <ChevronDown className="h-3 w-3 text-orange-600" /> : <ChevronRight className="h-3 w-3 text-orange-600" />}
                                    <CheckCircle2 className="h-3 w-3 text-orange-600" />
                                    <span className="text-sm font-medium text-orange-700">Tasks</span>
                                    <Badge className="ml-auto bg-orange-200 text-orange-800">{client.tasks.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.tasks.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle2 className="h-3 w-3 text-orange-500" />
                                          <span className="text-sm">{item.title}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.dailyReflections?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-dailyReflections`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'dailyReflections')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-pink-50 hover:bg-pink-100 rounded border border-pink-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-dailyReflections`] ?? false) ? <ChevronDown className="h-3 w-3 text-pink-600" /> : <ChevronRight className="h-3 w-3 text-pink-600" />}
                                    <Heart className="h-3 w-3 text-pink-600" />
                                    <span className="text-sm font-medium text-pink-700">Riflessioni Giornaliere</span>
                                    <Badge className="ml-auto bg-pink-200 text-pink-800">{client.dailyReflections.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.dailyReflections.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-pink-50 rounded border border-pink-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <Heart className="h-3 w-3 text-pink-500" />
                                          <span className="text-sm">{item.date ? new Date(item.date).toLocaleDateString('it-IT') : 'Data non disponibile'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.clientProgressHistory?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-clientProgressHistory`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'clientProgressHistory')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-clientProgressHistory`] ?? false) ? <ChevronDown className="h-3 w-3 text-teal-600" /> : <ChevronRight className="h-3 w-3 text-teal-600" />}
                                    <TrendingUp className="h-3 w-3 text-teal-600" />
                                    <span className="text-sm font-medium text-teal-700">Storico Progresso</span>
                                    <Badge className="ml-auto bg-teal-200 text-teal-800">{client.clientProgressHistory.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.clientProgressHistory.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-teal-50 rounded border border-teal-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-3 w-3 text-teal-500" />
                                          <span className="text-sm">{item.date ? new Date(item.date).toLocaleDateString('it-IT') : 'Data non disponibile'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.libraryProgress?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-libraryProgress`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'libraryProgress')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-cyan-50 hover:bg-cyan-100 rounded border border-cyan-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-libraryProgress`] ?? false) ? <ChevronDown className="h-3 w-3 text-cyan-600" /> : <ChevronRight className="h-3 w-3 text-cyan-600" />}
                                    <BookOpen className="h-3 w-3 text-cyan-600" />
                                    <span className="text-sm font-medium text-cyan-700">Progresso Libreria</span>
                                    <Badge className="ml-auto bg-cyan-200 text-cyan-800">{client.libraryProgress.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.libraryProgress.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-cyan-50 rounded border border-cyan-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <BookOpen className="h-3 w-3 text-cyan-500" />
                                          <span className="text-sm">{item.documentTitle || 'Documento'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.emailJourneyProgress?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-emailJourneyProgress`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'emailJourneyProgress')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-violet-50 hover:bg-violet-100 rounded border border-violet-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-emailJourneyProgress`] ?? false) ? <ChevronDown className="h-3 w-3 text-violet-600" /> : <ChevronRight className="h-3 w-3 text-violet-600" />}
                                    <Mail className="h-3 w-3 text-violet-600" />
                                    <span className="text-sm font-medium text-violet-700">Email Journey</span>
                                    <Badge className="ml-auto bg-violet-200 text-violet-800">{client.emailJourneyProgress.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.emailJourneyProgress.missing.map((item: any) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-violet-50 rounded border border-violet-200 ml-4">
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-3 w-3 text-violet-500" />
                                          <span className="text-sm">{item.templateTitle || 'Email'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.exerciseResponses?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-exerciseResponses`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'exerciseResponses')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-exerciseResponses`] ?? false) ? <ChevronDown className="h-3 w-3 text-gray-600" /> : <ChevronRight className="h-3 w-3 text-gray-600" />}
                                    <Dumbbell className="h-3 w-3 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Risposte Esercizi</span>
                                    <Badge className="ml-auto bg-gray-200 text-gray-800">{client.exerciseResponses.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.exerciseResponses.missing.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border ml-4">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="text-sm">{item.exerciseTitle}</span>
                                          {item.submittedAt && (
                                            <span className="text-xs text-gray-400">
                                              ({new Date(item.submittedAt).toLocaleDateString('it-IT')})
                                            </span>
                                          )}
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'exercise_response', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.consultationNotes?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-consultationNotes`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'consultationNotes')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-consultationNotes`] ?? false) ? <ChevronDown className="h-3 w-3 text-gray-600" /> : <ChevronRight className="h-3 w-3 text-gray-600" />}
                                    <MessageSquare className="h-3 w-3 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Note Consulenze</span>
                                    <Badge className="ml-auto bg-gray-200 text-gray-800">{client.consultationNotes.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.consultationNotes.missing.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border ml-4">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="text-sm">
                                            {new Date(item.date).toLocaleDateString('it-IT')} - {item.summary}
                                          </span>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'consultation', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {client.knowledgeDocs?.missing?.length > 0 && (
                                <Collapsible 
                                  open={openClientAuditCategories[`${client.clientId}-knowledgeDocs`] ?? false} 
                                  onOpenChange={() => toggleClientAuditCategory(client.clientId, 'knowledgeDocs')}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
                                    {(openClientAuditCategories[`${client.clientId}-knowledgeDocs`] ?? false) ? <ChevronDown className="h-3 w-3 text-gray-600" /> : <ChevronRight className="h-3 w-3 text-gray-600" />}
                                    <Brain className="h-3 w-3 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Knowledge Docs</span>
                                    <Badge className="ml-auto bg-gray-200 text-gray-800">{client.knowledgeDocs.missing.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-1 space-y-1">
                                    {client.knowledgeDocs.missing.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border ml-4">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-3 w-3 text-gray-400" />
                                          <span className="text-sm">{item.title}</span>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => syncSingleMutation.mutate({ type: 'client_knowledge', id: item.id, clientId: client.clientId })}
                                          disabled={syncSingleMutation.isPending}
                                        >
                                          {syncSingleMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <Plus className="h-3 w-3 mr-1" />
                                              Sync
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {clientMissing === 0 && (
                                <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  Tutti i dati di questo cliente sono indicizzati
                                </p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                      Agenti WhatsApp - Elementi Mancanti
                    </CardTitle>
                    <CardDescription>
                      Knowledge base degli agenti WhatsApp non ancora indicizzata
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(!auditData?.whatsappAgents || auditData.whatsappAgents.length === 0) ? (
                      <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
                        Nessun agente WhatsApp con knowledge base da sincronizzare
                      </p>
                    ) : (
                      auditData.whatsappAgents.map(agent => {
                        const agentMissing = agent.knowledgeItems?.missing?.length || 0;
                        return (
                          <Collapsible key={agent.agentId} open={openAuditAgents[agent.agentId]} onOpenChange={() => toggleAuditAgent(agent.agentId)}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                              {openAuditAgents[agent.agentId] ? <ChevronDown className="h-4 w-4 text-green-600" /> : <ChevronRight className="h-4 w-4 text-green-600" />}
                              <MessageSquare className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-900">{agent.agentName}</span>
                              <Badge className={`ml-auto ${agentMissing > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                {agentMissing} mancanti
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 ml-6 space-y-2">
                              {agentMissing === 0 ? (
                                <p className="text-sm text-gray-500 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  Tutta la knowledge base di questo agente e indicizzata
                                </p>
                              ) : (
                                <>
                                  <div className="flex justify-end mb-2">
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      onClick={() => syncSingleMutation.mutate({ type: 'whatsapp_agent', id: agent.agentId })}
                                      disabled={syncSingleMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      {syncSingleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                      )}
                                      Sincronizza Tutto Agente
                                    </Button>
                                  </div>
                                  {agent.knowledgeItems.missing.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3 text-gray-400" />
                                        <span className="text-sm">{item.title}</span>
                                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => syncSingleMutation.mutate({ type: 'whatsapp_knowledge', id: item.id, agentId: agent.agentId })}
                                        disabled={syncSingleMutation.isPending}
                                      >
                                        {syncSingleMutation.isPending ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Plus className="h-3 w-3 mr-1" />
                                            Sync
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  ))}
                                </>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      Dati Finanziari Clienti
                    </CardTitle>
                    <CardDescription>
                      Sincronizza i dati finanziari dei clienti (da Percorso Capitale) nel File Search
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(!auditData?.clients || auditData.clients.length === 0) ? (
                      <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
                        Nessun cliente disponibile
                      </p>
                    ) : (
                      auditData.clients.map(client => (
                        <div key={`financial-${client.clientId}`} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          client.hasFinancialDataIndexed 
                            ? 'bg-emerald-100 border-emerald-300' 
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {client.hasFinancialDataIndexed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Wallet className="h-4 w-4 text-gray-400" />
                            )}
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${client.hasFinancialDataIndexed ? 'text-emerald-900' : 'text-gray-700'}`}>
                                {client.clientName}
                              </span>
                              <span className="text-sm text-gray-500">({client.clientEmail})</span>
                              {client.hasFinancialDataIndexed && (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                                  Sincronizzato
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => syncFinancialMutation.mutate(client.clientId)}
                            disabled={syncFinancialMutation.isPending}
                            className={client.hasFinancialDataIndexed 
                              ? "border-emerald-300 text-emerald-700 hover:bg-emerald-200" 
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                            }
                          >
                            {syncFinancialMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                {client.hasFinancialDataIndexed ? 'Aggiorna' : 'Sync'}
                              </>
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                    <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      I dati finanziari vengono recuperati da Percorso Capitale e salvati nello store privato di ogni cliente
                    </p>
                  </CardContent>
                </Card>

                {/* External Docs from Exercises Section */}
                <Card className="border-orange-200 bg-orange-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <Link className="h-5 w-5" />
                      Documenti Esterni Esercizi - Elementi Mancanti
                    </CardTitle>
                    <CardDescription>
                      Google Docs collegati agli esercizi tramite workPlatform URL non ancora indicizzati
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {missingExternalDocsLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Caricamento...</span>
                      </div>
                    ) : (!missingExternalDocs?.byClient || missingExternalDocs.byClient.length === 0) ? (
                      <div className="flex items-center gap-2 text-emerald-600 p-4 bg-emerald-50 rounded-lg">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Tutti i documenti esterni sono sincronizzati!</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <Badge className="bg-orange-200 text-orange-800">
                            {missingExternalDocs.totalMissing} documenti mancanti in {missingExternalDocs.clientsWithMissing} client
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => syncAllExternalDocsMutation.mutate({})}
                            disabled={syncAllExternalDocsMutation.isPending}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            {syncAllExternalDocsMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sincronizzazione...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sincronizza Tutti
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {missingExternalDocs.byClient.map(client => (
                          <Collapsible key={client.clientId} open={openExternalDocsClients[client.clientId]} onOpenChange={() => toggleExternalDocsClient(client.clientId)}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-orange-100 hover:bg-orange-200 rounded-lg border border-orange-200 transition-colors">
                              {openExternalDocsClients[client.clientId] ? <ChevronDown className="h-4 w-4 text-orange-600" /> : <ChevronRight className="h-4 w-4 text-orange-600" />}
                              <User className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-orange-900">{client.clientName}</span>
                              <Badge className="ml-auto bg-orange-200 text-orange-800">
                                {client.count} mancanti
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 ml-6 space-y-2">
                              {client.missingDocs.map(doc => (
                                <div key={doc.assignmentId} className="flex items-center justify-between p-2 bg-white rounded border border-orange-200">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Link className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-sm font-medium block truncate">{doc.exerciseTitle}</span>
                                      <a 
                                        href={doc.workPlatformUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline truncate block"
                                      >
                                        {doc.workPlatformUrl}
                                      </a>
                                    </div>
                                    {doc.isPersonalized ? (
                                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs flex-shrink-0">
                                        Personalizzato
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs flex-shrink-0">
                                        Template
                                      </Badge>
                                    )}
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="border-orange-300 text-orange-700 hover:bg-orange-100 ml-2 flex-shrink-0"
                                    onClick={() => syncExternalDocMutation.mutate({ 
                                      assignmentId: doc.assignmentId, 
                                      clientId: client.clientId 
                                    })}
                                    disabled={syncExternalDocMutation.isPending}
                                  >
                                    {syncExternalDocMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Sync
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Source Orphans Section */}
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                      Documenti Orfani dalla Sorgente
                    </CardTitle>
                    <CardDescription>
                      Documenti nel FileSearch la cui sorgente originale è stata eliminata
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label className="text-sm font-medium mb-2 block">Seleziona Store da controllare:</Label>
                      <Select 
                        value={selectedStoreForOrphans || ""} 
                        onValueChange={(val) => setSelectedStoreForOrphans(val || null)}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="Seleziona uno store..." />
                        </SelectTrigger>
                        <SelectContent>
                          {analytics?.hierarchicalData?.consultantStore?.storeId && (
                            <SelectItem value={analytics.hierarchicalData.consultantStore.storeId}>
                              {analytics.hierarchicalData.consultantStore.storeName} (Consulente)
                            </SelectItem>
                          )}
                          {(analytics?.hierarchicalData as any)?.whatsappAgentStores?.filter((agent: any) => agent.storeId && agent.storeId !== "").map((agent: any) => (
                            <SelectItem key={agent.storeId} value={agent.storeId}>
                              {agent.storeName} (WhatsApp)
                            </SelectItem>
                          ))}
                          {analytics?.hierarchicalData?.clientStores?.filter(client => client.storeId && client.storeId !== "").map(client => (
                            <SelectItem key={client.storeId} value={client.storeId!}>
                              {client.clientName} (Cliente)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!selectedStoreForOrphans ? (
                      <p className="text-sm text-muted-foreground">Seleziona uno store per controllare i documenti orfani.</p>
                    ) : sourceOrphansLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Controllo in corso...</span>
                      </div>
                    ) : sourceOrphansData?.orphans?.length === 0 ? (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Nessun documento orfano trovato!</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="destructive">
                            {sourceOrphansData?.count || 0} documenti orfani
                          </Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cleanupOrphansMutation.mutate()}
                            disabled={cleanupOrphansMutation.isPending}
                          >
                            {cleanupOrphansMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Pulizia...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Pulisci Orfani
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {sourceOrphansData?.orphans?.map(orphan => (
                            <div key={orphan.id} className="flex items-center justify-between p-2 bg-red-100/50 rounded border border-red-200">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-red-500" />
                                <div>
                                  <p className="text-sm font-medium">{orphan.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Tipo: {orphan.sourceType} | ID Sorgente: {orphan.sourceId || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(auditData?.summary?.totalMissing || 0) > 0 && (
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      onClick={() => syncMissingMutation.mutate()}
                      disabled={syncMissingMutation.isPending}
                      className="gap-2"
                    >
                      {syncMissingMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-5 w-5" />
                      )}
                      Sincronizza Tutti gli Elementi Mancanti ({auditData?.summary?.totalMissing || 0})
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="migration" className="space-y-6">
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-800 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Migrazione Client - Architettura Privacy Isolata
                    </CardTitle>
                    <CardDescription className="text-blue-700">
                      Ogni client ha il proprio store privato con SOLO i contenuti assegnati. 
                      Questa migrazione sincronizza tutti i contenuti assegnati (esercizi, libreria, university) 
                      negli store privati dei client esistenti.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">Nuova Architettura Privacy</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Client vede SOLO il proprio store privato
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Contenuti copiati automaticamente quando assegnati
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Isolamento totale tra client diversi
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Consulente vede tutti gli store (proprio + client)
                        </li>
                      </ul>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                      <Card className="flex-1">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Migrazione Bulk</CardTitle>
                          <CardDescription>
                            Migra tutti i client esistenti alla nuova architettura
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button 
                            onClick={() => migrateAllClientsMutation.mutate()}
                            disabled={migrateAllClientsMutation.isPending}
                            className="w-full"
                          >
                            {migrateAllClientsMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Users className="h-4 w-4 mr-2" />
                            )}
                            Migra Tutti i Client
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    {auditData?.clientStores && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-800">Client Singoli</h4>
                        <div className="grid gap-3">
                          {auditData.clientStores.map((clientStore: any) => (
                            <div 
                              key={clientStore.clientId} 
                              className="flex items-center justify-between p-3 bg-white rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-gray-100 p-2 rounded-full">
                                  <User className="h-4 w-4 text-gray-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{clientStore.clientName}</p>
                                  <p className="text-xs text-gray-500">{clientStore.clientEmail}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {clientStore.hasStore ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Store Attivo
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                    No Store
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMigrateClient(clientStore.clientId)}
                                  disabled={migratingClients[clientStore.clientId]}
                                >
                                  {migratingClients[clientStore.clientId] ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          Storico Sincronizzazioni
                        </CardTitle>
                        <CardDescription>
                          Cronologia delle sincronizzazioni manuali e programmate
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchSyncReports()}
                        disabled={syncReportsLoading}
                      >
                        {syncReportsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Select
                        value={syncReportsFilter.syncType || "all"}
                        onValueChange={(value) => {
                          setSyncReportsPage(0);
                          setSyncReportsFilter(prev => ({ ...prev, syncType: value === "all" ? undefined : value }));
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Tipo sync" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i tipi</SelectItem>
                          <SelectItem value="manual">Manuale</SelectItem>
                          <SelectItem value="scheduled">Programmato</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={syncReportsFilter.status || "all"}
                        onValueChange={(value) => {
                          setSyncReportsPage(0);
                          setSyncReportsFilter(prev => ({ ...prev, status: value === "all" ? undefined : value }));
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Stato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti gli stati</SelectItem>
                          <SelectItem value="completed">Completato</SelectItem>
                          <SelectItem value="partial">Parziale</SelectItem>
                          <SelectItem value="failed">Fallito</SelectItem>
                          <SelectItem value="running">In corso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {syncReportsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : !syncReportsData?.reports.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Nessun report di sincronizzazione trovato</p>
                        <p className="text-sm">I report verranno creati automaticamente dopo ogni sincronizzazione</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {syncReportsData.reports.map((report) => (
                          <div
                            key={report.id}
                            className={`border rounded-lg p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                              selectedReport?.id === report.id ? "bg-muted/50 border-primary" : ""
                            }`}
                            onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                  report.syncType === 'scheduled' ? 'bg-blue-100' : 'bg-purple-100'
                                }`}>
                                  {report.syncType === 'scheduled' ? (
                                    <CalendarClock className={`h-4 w-4 ${
                                      report.syncType === 'scheduled' ? 'text-blue-600' : 'text-purple-600'
                                    }`} />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 text-purple-600" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {report.syncType === 'scheduled' ? 'Sync Programmato' : 'Sync Manuale'}
                                    </span>
                                    <Badge variant={
                                      report.status === 'completed' ? 'default' :
                                      report.status === 'partial' ? 'secondary' :
                                      report.status === 'running' ? 'outline' : 'destructive'
                                    } className={
                                      report.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                                      report.status === 'partial' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                      report.status === 'running' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      'bg-red-100 text-red-700 border-red-200'
                                    }>
                                      {report.status === 'completed' ? 'Completato' :
                                       report.status === 'partial' ? 'Parziale' :
                                       report.status === 'running' ? 'In corso' : 'Fallito'}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {new Date(report.startedAt).toLocaleString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                    {report.durationMs && (
                                      <span className="ml-2">
                                        ({(report.durationMs / 1000).toFixed(1)}s)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-green-600 font-medium">
                                      {report.totalSynced} sync
                                    </span>
                                    {report.totalSkipped > 0 && (
                                      <span className="text-gray-500">
                                        {report.totalSkipped} skip
                                      </span>
                                    )}
                                    {report.totalFailed > 0 && (
                                      <span className="text-red-500 font-medium">
                                        {report.totalFailed} errori
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminare il report?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Questa azione non può essere annullata. Il report verrà rimosso permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteSyncReportMutation.mutate(report.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Elimina
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  selectedReport?.id === report.id ? 'rotate-180' : ''
                                }`} />
                              </div>
                            </div>

                            {selectedReport?.id === report.id && (
                              <div className="mt-4 pt-4 border-t space-y-5">
                                {report.categoryDetails && Object.keys(report.categoryDetails).length > 0 && (
                                  <div className="space-y-4">
                                    {/* SEZIONE 1: Store Consulente */}
                                    {(() => {
                                      const consultantCategories = ['library', 'knowledgeBase', 'exercises', 'university', 'consultantGuide', 'consultations'];
                                      const consultantData = Object.entries(report.categoryDetails)
                                        .filter(([key]) => consultantCategories.includes(key))
                                        .filter(([, detail]) => detail.processed > 0 || detail.synced > 0);
                                      
                                      if (consultantData.length === 0) return null;
                                      
                                      const totalSynced = consultantData.reduce((sum, [, d]) => sum + (d.synced || 0), 0);
                                      const totalSkipped = consultantData.reduce((sum, [, d]) => sum + (d.skipped || 0), 0);
                                      const totalProcessed = consultantData.reduce((sum, [, d]) => sum + (d.processed || 0), 0);
                                      const totalIndexed = totalSynced + totalSkipped;
                                      
                                      return (
                                        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Database className="h-4 w-4 text-blue-600" />
                                            <h4 className="text-sm font-semibold text-blue-900">Store Consulente</h4>
                                            <Badge variant="outline" className="ml-auto text-xs bg-blue-100 text-blue-700 border-blue-300">
                                              {totalIndexed}/{totalProcessed} indicizzati
                                            </Badge>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {consultantData.map(([key, detail]) => (
                                              <div key={key} className="bg-white rounded-md p-2 text-xs border border-blue-100">
                                                <div className="flex items-center gap-1.5">
                                                  {key === 'library' && <BookOpen className="h-3 w-3 text-blue-500" />}
                                                  {key === 'knowledgeBase' && <Brain className="h-3 w-3 text-purple-500" />}
                                                  {key === 'exercises' && <Dumbbell className="h-3 w-3 text-orange-500" />}
                                                  {key === 'university' && <GraduationCap className="h-3 w-3 text-indigo-500" />}
                                                  {key === 'consultantGuide' && <FileText className="h-3 w-3 text-green-500" />}
                                                  {key === 'consultations' && <MessageSquare className="h-3 w-3 text-teal-500" />}
                                                  <span className="font-medium text-gray-700">{detail.name}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 text-muted-foreground">
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-gray-500 text-[10px]">Indicizzati:</span>
                                                    <span className={(detail.synced + (detail.skipped || 0)) > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                                                      {detail.synced + (detail.skipped || 0)}
                                                    </span>
                                                    <span className="text-gray-400">/</span>
                                                    <span>{detail.processed}</span>
                                                  </div>
                                                  {detail.synced > 0 && (
                                                    <span className="text-[10px] text-blue-500">+{detail.synced} nuovi</span>
                                                  )}
                                                  {detail.failed > 0 && (
                                                    <span className="text-red-500 text-[10px] font-medium">{detail.failed} errori</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* SEZIONE 2: Dati Clienti */}
                                    {(() => {
                                      const clientCategories = ['exerciseResponses', 'clientKnowledge', 'clientConsultations', 'financialData', 'goals', 'tasks', 'dailyReflections', 'progressHistory', 'libraryProgress', 'emailJourney'];
                                      const clientData = Object.entries(report.categoryDetails)
                                        .filter(([key]) => clientCategories.includes(key))
                                        .filter(([, detail]) => detail.processed > 0 || detail.synced > 0);
                                      
                                      if (clientData.length === 0) return null;
                                      
                                      const totalSynced = clientData.reduce((sum, [, d]) => sum + (d.synced || 0), 0);
                                      const totalSkipped = clientData.reduce((sum, [, d]) => sum + (d.skipped || 0), 0);
                                      const totalProcessed = clientData.reduce((sum, [, d]) => sum + (d.processed || 0), 0);
                                      const totalIndexed = totalSynced + totalSkipped;
                                      
                                      return (
                                        <div className="bg-green-50/50 border border-green-200 rounded-lg p-3">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Users className="h-4 w-4 text-green-600" />
                                            <h4 className="text-sm font-semibold text-green-900">Dati Clienti</h4>
                                            {report.clientDetails?.clientsProcessed && (
                                              <span className="text-xs text-green-600">({report.clientDetails.clientsProcessed} clienti)</span>
                                            )}
                                            <Badge variant="outline" className="ml-auto text-xs bg-green-100 text-green-700 border-green-300">
                                              {totalIndexed}/{totalProcessed} indicizzati
                                            </Badge>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {clientData.map(([key, detail]) => (
                                              <div key={key} className="bg-white rounded-md p-2 text-xs border border-green-100">
                                                <div className="flex items-center gap-1.5">
                                                  {key === 'exerciseResponses' && <CheckSquare className="h-3 w-3 text-green-500" />}
                                                  {key === 'clientKnowledge' && <Brain className="h-3 w-3 text-purple-500" />}
                                                  {key === 'clientConsultations' && <MessageSquare className="h-3 w-3 text-teal-500" />}
                                                  {key === 'financialData' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                                                  {key === 'goals' && <Target className="h-3 w-3 text-amber-500" />}
                                                  {key === 'tasks' && <ListTodo className="h-3 w-3 text-blue-500" />}
                                                  {key === 'dailyReflections' && <Heart className="h-3 w-3 text-pink-500" />}
                                                  {key === 'progressHistory' && <BarChart3 className="h-3 w-3 text-cyan-500" />}
                                                  {key === 'libraryProgress' && <BookMarked className="h-3 w-3 text-indigo-500" />}
                                                  {key === 'emailJourney' && <Mail className="h-3 w-3 text-violet-500" />}
                                                  <span className="font-medium text-gray-700 truncate">{detail.name}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 text-muted-foreground">
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-gray-500 text-[10px]">Indicizzati:</span>
                                                    <span className={(detail.synced + (detail.skipped || 0)) > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                                                      {detail.synced + (detail.skipped || 0)}
                                                    </span>
                                                    <span className="text-gray-400">/</span>
                                                    <span>{detail.processed}</span>
                                                  </div>
                                                  {detail.synced > 0 && (
                                                    <span className="text-[10px] text-blue-500">+{detail.synced} nuovi</span>
                                                  )}
                                                  {detail.failed > 0 && (
                                                    <span className="text-red-500 text-[10px] font-medium">{detail.failed} errori</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* SEZIONE 3: Contenuti Assegnati (copiati nei client store) */}
                                    {(() => {
                                      const assignedCategories = ['assignedExercises', 'assignedLibrary', 'assignedUniversity'];
                                      const assignedData = Object.entries(report.categoryDetails)
                                        .filter(([key]) => assignedCategories.includes(key))
                                        .filter(([, detail]) => detail.processed > 0 || detail.synced > 0);
                                      
                                      if (assignedData.length === 0) return null;
                                      
                                      const totalSynced = assignedData.reduce((sum, [, d]) => sum + (d.synced || 0), 0);
                                      const totalSkipped = assignedData.reduce((sum, [, d]) => sum + (d.skipped || 0), 0);
                                      const totalProcessed = assignedData.reduce((sum, [, d]) => sum + (d.processed || 0), 0);
                                      const totalIndexed = totalSynced + totalSkipped;
                                      
                                      return (
                                        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Share2 className="h-4 w-4 text-amber-600" />
                                            <h4 className="text-sm font-semibold text-amber-900">Contenuti Assegnati ai Clienti</h4>
                                            <Badge variant="outline" className="ml-auto text-xs bg-amber-100 text-amber-700 border-amber-300">
                                              {totalIndexed}/{totalProcessed} indicizzati
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-amber-700 mb-2">
                                            Documenti copiati negli store privati dei clienti
                                          </p>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {assignedData.map(([key, detail]) => (
                                              <div key={key} className="bg-white rounded-md p-2 text-xs border border-amber-100">
                                                <div className="flex items-center gap-1.5">
                                                  {key === 'assignedExercises' && <Dumbbell className="h-3 w-3 text-orange-500" />}
                                                  {key === 'assignedLibrary' && <BookOpen className="h-3 w-3 text-blue-500" />}
                                                  {key === 'assignedUniversity' && <GraduationCap className="h-3 w-3 text-indigo-500" />}
                                                  <span className="font-medium text-gray-700">{detail.name}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 text-muted-foreground">
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-gray-500 text-[10px]">Indicizzati:</span>
                                                    <span className={(detail.synced + (detail.skipped || 0)) > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                                                      {detail.synced + (detail.skipped || 0)}
                                                    </span>
                                                    <span className="text-gray-400">/</span>
                                                    <span>{detail.processed}</span>
                                                  </div>
                                                  {detail.synced > 0 && (
                                                    <span className="text-[10px] text-blue-500">+{detail.synced} nuovi</span>
                                                  )}
                                                  {detail.failed > 0 && (
                                                    <span className="text-red-500 text-[10px] font-medium">{detail.failed} errori</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {report.errors && report.errors.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 text-red-600 flex items-center gap-1">
                                      <AlertTriangle className="h-4 w-4" />
                                      Errori ({report.errors.length})
                                    </h4>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                                      {report.errors.slice(0, 10).map((error, idx) => (
                                        <div key={idx} className="text-xs text-red-700 py-1">
                                          {error}
                                        </div>
                                      ))}
                                      {report.errors.length > 10 && (
                                        <div className="text-xs text-red-500 pt-2">
                                          ... e altri {report.errors.length - 10} errori
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {syncReportsData.pagination.total > 20 && (
                          <div className="flex items-center justify-between pt-4">
                            <div className="text-sm text-muted-foreground">
                              Pagina {syncReportsPage + 1} di {Math.ceil(syncReportsData.pagination.total / 20)}
                              ({syncReportsData.pagination.total} totali)
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSyncReportsPage(p => Math.max(0, p - 1))}
                                disabled={syncReportsPage === 0}
                              >
                                Precedente
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSyncReportsPage(p => p + 1)}
                                disabled={!syncReportsData.pagination.hasMore}
                              >
                                Successiva
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="memory" className="space-y-6 relative">
                {memoryTabLoading && (
                  <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                      <span className="text-sm text-gray-600">Caricamento dati memoria...</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Riassunti Totali</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {memoryStats?.totalSummaries || 0}
                          </p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <Brain className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Utenti con Memoria</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {memoryStats?.usersWithMemory || 0}/{memoryStats?.totalUsers || 0}
                          </p>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-lg">
                          <Users className="h-6 w-6 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Token Medi/Utente</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {(memoryStats?.averageTokensPerUser || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Zap className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Copertura</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {memoryStats?.coveragePercent || 0}%
                          </p>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className={`border-blue-200 ${memoryGenerationProgress.isRunning || memoryGenerationProgress.finalResult ? 'bg-purple-50 border-purple-200' : 'bg-blue-50'}`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${memoryGenerationProgress.isRunning ? 'bg-purple-100' : 'bg-blue-100'}`}>
                          {memoryGenerationProgress.isRunning ? (
                            <Brain className="h-6 w-6 text-purple-600 animate-pulse" />
                          ) : (
                            <CalendarClock className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <h3 className={`font-semibold ${memoryGenerationProgress.isRunning ? 'text-purple-800' : 'text-blue-800'}`}>
                            {memoryGenerationProgress.isRunning ? 'Generazione in corso...' : 'Generazione Automatica'}
                          </h3>
                          <p className={`text-sm mt-1 ${memoryGenerationProgress.isRunning ? 'text-purple-700' : 'text-blue-700'}`}>
                            {memoryGenerationProgress.isRunning 
                              ? (memoryGenerationProgress.phase === 'gold' 
                                  ? `Elaborazione Dipendenti Gold ${memoryGenerationProgress.currentGoldIndex}/${memoryGenerationProgress.totalGoldUsers}`
                                  : `Elaborazione Utenti ${memoryGenerationProgress.currentIndex}/${memoryGenerationProgress.totalUsers}`)
                              : 'La memoria AI viene generata automaticamente ogni giorno all\'ora impostata.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="flex items-center gap-2">
                          <Label className="text-blue-700 text-sm whitespace-nowrap">Ora generazione:</Label>
                          <Select
                            value={String(memorySettings?.memoryGenerationHour ?? 3)}
                            onValueChange={(value) => updateMemorySettingsMutation.mutate(parseInt(value))}
                            disabled={updateMemorySettingsMutation.isPending || memoryGenerationProgress.isRunning}
                          >
                            <SelectTrigger className="w-24 bg-white border-blue-300">
                              <SelectValue placeholder="Ora" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {String(i).padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {updateMemorySettingsMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          )}
                        </div>
                        <Button
                          onClick={() => startMemoryGeneration()}
                          disabled={memoryGenerationProgress.isRunning}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {memoryGenerationProgress.isRunning ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Generazione...
                            </>
                          ) : (
                            <>
                              <Brain className="h-4 w-4 mr-2" />
                              Genera Ora
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {(memoryGenerationProgress.isRunning || memoryGenerationProgress.finalResult) && (
                      <div className="mt-4 pt-4 border-t border-purple-200 space-y-4">
                        {/* SECTION 1: Users Progress */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-purple-700">Utenti</span>
                          </div>
                          {memoryGenerationProgress.totalUsers > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-purple-600">Progresso</span>
                                <span className="font-medium text-purple-700">
                                  {memoryGenerationProgress.currentIndex} / {memoryGenerationProgress.totalUsers}
                                </span>
                              </div>
                              <Progress 
                                value={(memoryGenerationProgress.currentIndex / memoryGenerationProgress.totalUsers) * 100} 
                                className="h-2 bg-purple-100"
                              />
                            </div>
                          )}

                          {memoryGenerationProgress.isRunning && memoryGenerationProgress.phase === 'users' && memoryGenerationProgress.currentUser && (
                            <div className="bg-white/70 p-3 rounded-lg border border-purple-200">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                <span className="text-sm text-purple-700">
                                  <span className="font-medium">{memoryGenerationProgress.currentUser}</span>
                                  <Badge variant="secondary" className="ml-2 text-xs capitalize">
                                    {memoryGenerationProgress.currentRole}
                                  </Badge>
                                </span>
                              </div>
                              {memoryGenerationProgress.currentDay !== undefined && memoryGenerationProgress.totalDays !== undefined && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-purple-600">
                                  <Clock className="h-3 w-3" />
                                  Giorno {memoryGenerationProgress.currentDay} di {memoryGenerationProgress.totalDays}
                                  {memoryGenerationProgress.currentDate && (
                                    <span className="text-purple-500">({memoryGenerationProgress.currentDate})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {memoryGenerationProgress.results.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {memoryGenerationProgress.results.map((result) => (
                                <div 
                                  key={result.userId} 
                                  className={`flex items-center gap-1.5 p-2 rounded-md text-xs ${
                                    result.status === 'processing' ? 'bg-purple-100 border border-purple-200' :
                                    result.status === 'generated' ? 'bg-emerald-100 border border-emerald-200' :
                                    result.status === 'skipped' ? 'bg-gray-100 border border-gray-200' :
                                    'bg-red-100 border border-red-200'
                                  }`}
                                >
                                  {result.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-purple-500 flex-shrink-0" />}
                                  {result.status === 'generated' && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                  {result.status === 'skipped' && <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                                  {result.status === 'error' && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                  <span className="truncate" title={result.userName}>{result.userName.split(' ')[0]}</span>
                                  {result.status === 'generated' && result.generated !== undefined && (
                                    <span className="text-emerald-600 font-medium">+{result.generated}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SECTION 2: Gold Users Progress */}
                        {(memoryGenerationProgress.totalGoldUsers > 0 || memoryGenerationProgress.goldResults.length > 0) && (
                          <div className="space-y-3 pt-3 border-t border-amber-200">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4 text-amber-600" />
                              <span className="font-medium text-amber-700">Dipendenti Gold</span>
                            </div>
                            {memoryGenerationProgress.totalGoldUsers > 0 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-amber-600">Progresso</span>
                                  <span className="font-medium text-amber-700">
                                    {memoryGenerationProgress.currentGoldIndex} / {memoryGenerationProgress.totalGoldUsers}
                                  </span>
                                </div>
                                <Progress 
                                  value={(memoryGenerationProgress.currentGoldIndex / memoryGenerationProgress.totalGoldUsers) * 100} 
                                  className="h-2 bg-amber-100"
                                />
                              </div>
                            )}

                            {memoryGenerationProgress.isRunning && memoryGenerationProgress.phase === 'gold' && memoryGenerationProgress.currentUser && (
                              <div className="bg-white/70 p-3 rounded-lg border border-amber-200">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                                  <span className="text-sm text-amber-700">
                                    <span className="font-medium">{memoryGenerationProgress.currentUser}</span>
                                    <Badge className="ml-2 text-xs bg-amber-100 text-amber-700 border-amber-200">
                                      Gold
                                    </Badge>
                                  </span>
                                </div>
                                {memoryGenerationProgress.currentDay !== undefined && memoryGenerationProgress.totalDays !== undefined && (
                                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                                    <Clock className="h-3 w-3" />
                                    Giorno {memoryGenerationProgress.currentDay} di {memoryGenerationProgress.totalDays}
                                    {memoryGenerationProgress.currentDate && (
                                      <span className="text-amber-500">({memoryGenerationProgress.currentDate})</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {memoryGenerationProgress.goldResults.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {memoryGenerationProgress.goldResults.map((result) => (
                                  <div 
                                    key={result.userId} 
                                    className={`flex items-center gap-1.5 p-2 rounded-md text-xs ${
                                      result.status === 'processing' ? 'bg-amber-100 border border-amber-200' :
                                      result.status === 'generated' ? 'bg-emerald-100 border border-emerald-200' :
                                      result.status === 'skipped' ? 'bg-gray-100 border border-gray-200' :
                                      'bg-red-100 border border-red-200'
                                    }`}
                                  >
                                    {result.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-amber-500 flex-shrink-0" />}
                                    {result.status === 'generated' && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                                    {result.status === 'skipped' && <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                                    {result.status === 'error' && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                    <span className="truncate" title={result.userName}>{result.userName.split(' ')[0]}</span>
                                    {result.status === 'generated' && result.generated !== undefined && (
                                      <span className="text-emerald-600 font-medium">+{result.generated}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Final Summary with separate counters */}
                        {memoryGenerationProgress.finalResult && (
                          <div className="bg-gradient-to-r from-emerald-50 to-purple-50 p-4 rounded-lg border border-emerald-200">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-700">Completato!</span>
                              </div>
                              <div className="flex gap-4 flex-wrap">
                                {/* Users stats */}
                                <div className="flex items-center gap-3 bg-purple-100/50 px-3 py-1 rounded-lg">
                                  <Users className="h-4 w-4 text-purple-600" />
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-purple-600">
                                      {memoryGenerationProgress.finalResult.generated}
                                    </div>
                                    <div className="text-xs text-purple-600">riassunti</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-purple-600">
                                      {memoryGenerationProgress.finalResult.usersWithNewSummaries}
                                    </div>
                                    <div className="text-xs text-purple-600">utenti</div>
                                  </div>
                                </div>
                                {/* Gold stats */}
                                {(memoryGenerationProgress.finalResult.goldGenerated > 0 || memoryGenerationProgress.finalResult.goldUsersProcessed > 0) && (
                                  <div className="flex items-center gap-3 bg-amber-100/50 px-3 py-1 rounded-lg">
                                    <Crown className="h-4 w-4 text-amber-600" />
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-amber-600">
                                        {memoryGenerationProgress.finalResult.goldGenerated}
                                      </div>
                                      <div className="text-xs text-amber-600">riassunti</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-amber-600">
                                        {memoryGenerationProgress.finalResult.goldUsersWithNewSummaries}
                                      </div>
                                      <div className="text-xs text-amber-600">gold</div>
                                    </div>
                                  </div>
                                )}
                                {/* Duration */}
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600">
                                    {(memoryGenerationProgress.finalResult.durationMs / 1000).toFixed(1)}s
                                  </div>
                                  <div className="text-xs text-gray-600">Tempo</div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemoryGenerationProgress(prev => ({ ...prev, finalResult: undefined, results: [], goldResults: [] }))}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-600" />
                      Audit Memoria Utenti
                    </CardTitle>
                    <CardDescription>
                      Stato della memoria AI per ogni utente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-3 font-medium">Nome</th>
                            <th className="text-left p-3 font-medium">Ruolo</th>
                            <th className="text-center p-3 font-medium">Giorni Totali</th>
                            <th className="text-center p-3 font-medium">Coperti</th>
                            <th className="text-center p-3 font-medium">Mancanti</th>
                            <th className="text-left p-3 font-medium">Ultimo Riassunto</th>
                            <th className="text-center p-3 font-medium">Status</th>
                            <th className="text-center p-3 font-medium">Memoria</th>
                            <th className="text-center p-3 font-medium">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memoryAudit?.map((user) => (
                            <tr key={user.userId} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <div className="font-medium">{user.firstName} {user.lastName}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </td>
                              <td className="p-3 capitalize">{user.role}</td>
                              <td className="p-3 text-center">{user.totalDays}</td>
                              <td className="p-3 text-center text-emerald-600 font-medium">{user.coveredDays}</td>
                              <td className="p-3 text-center text-red-600 font-medium">{user.missingDays}</td>
                              <td className="p-3">
                                {user.lastSummaryDate ? (
                                  <span className="text-gray-600">
                                    {formatDistanceToNow(new Date(user.lastSummaryDate), { addSuffix: true, locale: it })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Mai</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {user.status === 'complete' && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                    Completo
                                  </Badge>
                                )}
                                {user.status === 'partial' && (
                                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                    Parziale
                                  </Badge>
                                )}
                                {user.status === 'missing' && (
                                  <Badge className="bg-red-100 text-red-700 border-red-200">
                                    Mancante
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setViewingMemoryUserId(user.userId)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                              <td className="p-3 text-center">
                                {user.missingDays > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateUserMemoryMutation.mutate(user.userId)}
                                    disabled={generateUserMemoryMutation.isPending}
                                  >
                                    {generateUserMemoryMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {(!memoryAudit || memoryAudit.length === 0) && (
                            <tr>
                              <td colSpan={9} className="p-6 text-center text-gray-500">
                                Nessun utente trovato
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-600" />
                      Dipendenti Gold
                    </CardTitle>
                    <CardDescription>
                      Stato della memoria AI per i dipendenti con abbonamento Gold
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {managerMemoryAuditLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                      </div>
                    ) : managerMemoryAudit && managerMemoryAudit.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-3 font-medium w-8"></th>
                              <th className="text-left p-3 font-medium">Email/Nome</th>
                              <th className="text-center p-3 font-medium">Agenti</th>
                              <th className="text-center p-3 font-medium">Giorni Totali</th>
                              <th className="text-center p-3 font-medium">Riassunti</th>
                              <th className="text-center p-3 font-medium">Mancanti</th>
                              <th className="text-center p-3 font-medium">Status</th>
                              <th className="text-center p-3 font-medium">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {managerMemoryAudit.map((manager) => (
                              <React.Fragment key={manager.subscriptionId}>
                                <tr 
                                  className={`border-b hover:bg-gray-50 cursor-pointer ${!manager.agentAccessEnabled ? 'opacity-50' : ''}`}
                                  onClick={() => setExpandedGoldUserId(expandedGoldUserId === manager.subscriptionId ? null : manager.subscriptionId)}
                                >
                                  <td className="p-3">
                                    {expandedGoldUserId === manager.subscriptionId ? (
                                      <ChevronDown className="h-4 w-4 text-amber-600" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-400" />
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium">{manager.firstName || manager.email}</div>
                                    {manager.firstName && (
                                      <div className="text-xs text-gray-500">{manager.email}</div>
                                    )}
                                    <div className="flex gap-1 mt-1">
                                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                        {manager.tier}
                                      </Badge>
                                      {!manager.agentAccessEnabled && (
                                        <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                                          Disabilitato
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <Badge variant="secondary" className="text-xs">
                                      {expandedGoldUserId === manager.subscriptionId && goldUserAgentBreakdown 
                                        ? `${goldUserAgentBreakdown.length} agenti` 
                                        : '-'}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-center">{manager.totalDays}</td>
                                  <td className="p-3 text-center text-emerald-600 font-medium">{manager.existingSummaries}</td>
                                  <td className="p-3 text-center text-red-600 font-medium">{manager.missingDays}</td>
                                  <td className="p-3 text-center">
                                    {!manager.agentAccessEnabled ? (
                                      <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                                        Inattivo
                                      </Badge>
                                    ) : manager.status === 'complete' ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                        Completo
                                      </Badge>
                                    ) : manager.status === 'partial' ? (
                                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                                        Parziale
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-red-100 text-red-700 border-red-200">
                                        Vuoto
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-2">
                                      {manager.existingSummaries > 0 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setViewingManagerSubscriptionId(manager.subscriptionId)}
                                        >
                                          <Brain className="h-4 w-4 mr-1" />
                                          Visualizza
                                        </Button>
                                      )}
                                      {manager.agentAccessEnabled && manager.missingDays > 0 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => generateManagerMemoryMutation.mutate(manager.subscriptionId)}
                                          disabled={generateManagerMemoryMutation.isPending}
                                        >
                                          {generateManagerMemoryMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <>
                                              <RefreshCw className="h-4 w-4 mr-1" />
                                              Genera
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {expandedGoldUserId === manager.subscriptionId && (
                                  <tr>
                                    <td colSpan={8} className="p-0">
                                      <div className="bg-amber-50/50 border-l-4 border-amber-300 px-6 py-4">
                                        {agentBreakdownLoading ? (
                                          <div className="flex items-center gap-2 text-amber-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">Caricamento agenti...</span>
                                          </div>
                                        ) : goldUserAgentBreakdown && goldUserAgentBreakdown.length > 0 ? (
                                          <div className="space-y-3">
                                            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                                              Dettaglio per Agente
                                            </div>
                                            <div className="grid gap-2">
                                              {goldUserAgentBreakdown.map((agent) => (
                                                <div 
                                                  key={agent.agentId}
                                                  className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200"
                                                >
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                      <Bot className="h-4 w-4 text-amber-600" />
                                                    </div>
                                                    <div>
                                                      <div className="font-medium text-gray-900">{agent.agentName}</div>
                                                      <div className="text-xs text-gray-500">
                                                        {agent.lastMessageAt 
                                                          ? `Ultimo msg: ${format(new Date(agent.lastMessageAt), "d MMM", { locale: it })}`
                                                          : 'Nessun messaggio'}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-4">
                                                    <div className="text-center">
                                                      <div className="text-lg font-semibold text-gray-900">{agent.conversationCount}</div>
                                                      <div className="text-xs text-gray-500">chat</div>
                                                    </div>
                                                    <div className="text-center">
                                                      <div className="text-lg font-semibold text-amber-600">{agent.messageCount}</div>
                                                      <div className="text-xs text-gray-500">messaggi</div>
                                                    </div>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingAgentMemory({
                                                          subscriptionId: manager.subscriptionId,
                                                          agentId: agent.agentId,
                                                          agentName: agent.agentName
                                                        });
                                                      }}
                                                    >
                                                      <Eye className="h-4 w-4 mr-1" />
                                                      Visualizza
                                                    </Button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                            <div className="text-xs text-gray-500 pt-2 border-t border-amber-200">
                                              Totale: {goldUserAgentBreakdown.reduce((sum, a) => sum + a.conversationCount, 0)} conversazioni, {goldUserAgentBreakdown.reduce((sum, a) => sum + a.messageCount, 0)} messaggi
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm text-gray-500 flex items-center gap-2">
                                            <Bot className="h-4 w-4" />
                                            Nessuna conversazione con agenti trovata
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>Nessun dipendente Gold trovato</p>
                        <p className="text-sm text-gray-400 mt-1">
                          I dipendenti con abbonamento Gold appariranno qui
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={!!viewingMemoryUserId} onOpenChange={(open) => !open && setViewingMemoryUserId(null)}>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600" />
                        Memoria AI - {viewingMemoryUser?.firstName} {viewingMemoryUser?.lastName}
                      </DialogTitle>
                      <DialogDescription>
                        Riassunti giornalieri delle conversazioni (ultimi 30 giorni)
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                      {summariesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        </div>
                      ) : userSummaries && userSummaries.length > 0 ? (
                        <div className="space-y-4">
                          {userSummaries.map((summary) => (
                            <div key={summary.id} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-purple-700">
                                  {format(new Date(summary.summaryDate), "EEEE d MMMM yyyy", { locale: it })}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Badge variant="secondary" className="text-xs">
                                    {summary.conversationCount} chat
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {summary.messageCount} msg
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {summary.summary}
                              </p>
                              {summary.topics && summary.topics.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {summary.topics.slice(0, 5).map((topic, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-white">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                          <Brain className="h-12 w-12 text-gray-300 mb-2" />
                          <p>Nessun riassunto disponibile</p>
                          <p className="text-xs text-gray-400 mt-1">
                            I riassunti vengono generati automaticamente dalle conversazioni
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!viewingManagerSubscriptionId} onOpenChange={(open) => !open && setViewingManagerSubscriptionId(null)}>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-amber-600" />
                        Memoria AI - {viewingManagerData?.firstName || viewingManagerData?.email}
                      </DialogTitle>
                      <DialogDescription>
                        Riassunti giornalieri delle conversazioni Gold (ultimi 30 giorni)
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                      {managerSummariesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                        </div>
                      ) : managerSummaries && managerSummaries.length > 0 ? (
                        <div className="space-y-4">
                          {managerSummaries.map((summary) => (
                            <div key={summary.id} className="border rounded-lg p-4 bg-amber-50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-amber-700">
                                    {format(new Date(summary.summaryDate), "EEEE d MMMM yyyy", { locale: it })}
                                  </span>
                                  {summary.agentName && (
                                    <span className="text-xs text-amber-600 flex items-center gap-1">
                                      <Bot className="h-3 w-3" />
                                      Agente: {summary.agentName}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Badge variant="secondary" className="text-xs">
                                    {summary.conversationCount} chat
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {summary.messageCount} msg
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {summary.summary}
                              </p>
                              {summary.topics && summary.topics.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {summary.topics.slice(0, 5).map((topic, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-white">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                          <Brain className="h-12 w-12 text-gray-300 mb-2" />
                          <p>Nessun riassunto disponibile</p>
                          <p className="text-xs text-gray-400 mt-1">
                            I riassunti vengono generati automaticamente dalle conversazioni
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!viewingAgentMemory} onOpenChange={(open) => !open && setViewingAgentMemory(null)}>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-amber-600" />
                        Memoria AI - {viewingAgentMemory?.agentName}
                      </DialogTitle>
                      <DialogDescription>
                        Riassunti giornalieri delle conversazioni con questo agente (ultimi 30 giorni)
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                      {agentSummariesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                        </div>
                      ) : agentSummaries && agentSummaries.length > 0 ? (
                        <div className="space-y-4">
                          {agentSummaries.map((summary) => (
                            <div key={summary.id} className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-amber-700">
                                  {format(new Date(summary.summaryDate), "EEEE d MMMM yyyy", { locale: it })}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                    {summary.conversationCount} chat
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                    {summary.messageCount} msg
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {summary.summary}
                              </p>
                              {summary.topics && summary.topics.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {summary.topics.slice(0, 5).map((topic, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-white border-amber-200 text-amber-700">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                          <Bot className="h-12 w-12 text-amber-200 mb-2" />
                          <p>Nessun riassunto disponibile per questo agente</p>
                          <p className="text-xs text-gray-400 mt-1">
                            I riassunti vengono generati automaticamente dalle conversazioni
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Collapsible>
                  <Card>
                    <CardHeader>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-gray-600" />
                            <CardTitle className="text-lg">Log Generazione</CardTitle>
                          </div>
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        </div>
                      </CollapsibleTrigger>
                      <CardDescription>
                        Storico delle generazioni automatiche e manuali
                      </CardDescription>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left p-3 font-medium">Data</th>
                                <th className="text-center p-3 font-medium">Tipo</th>
                                <th className="text-left p-3 font-medium">Utente Target</th>
                                <th className="text-center p-3 font-medium">Riassunti Generati</th>
                                <th className="text-center p-3 font-medium">Durata</th>
                                <th className="text-left p-3 font-medium">Errori</th>
                              </tr>
                            </thead>
                            <tbody>
                              {memoryLogs?.map((log) => (
                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                  <td className="p-3">
                                    {log.createdAt ? (
                                      format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: it })
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {log.generationType === 'automatic' ? (
                                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                        Automatico
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                        Manuale
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {log.targetUserName || log.targetUserId || (
                                      <span className="text-gray-400 italic">Tutti gli utenti</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-medium text-emerald-600">
                                    {log.summariesGenerated}
                                  </td>
                                  <td className="p-3 text-center">
                                    {(log.durationMs / 1000).toFixed(1)}s
                                  </td>
                                  <td className="p-3">
                                    {log.errors && log.errors.length > 0 ? (
                                      <Badge variant="destructive" className="text-xs">
                                        {log.errors.length} errori
                                      </Badge>
                                    ) : (
                                      <span className="text-emerald-600">✓</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(!memoryLogs || memoryLogs.length === 0) && (
                                <tr>
                                  <td colSpan={6} className="p-6 text-center text-gray-500">
                                    Nessun log di generazione trovato
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
