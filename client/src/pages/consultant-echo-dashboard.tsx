import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  ClipboardCheck,
  Loader2,
  TrendingUp,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  Eye,
  Edit,
  Send,
  Save,
  Trash2,
  Calendar,
  User,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface EchoStats {
  totalEmails: number;
  totalTasks: number;
  pendingApprovals: number;
  missingEmails: number;
  successRate: number;
}

interface PendingConsultation {
  id: string;
  clientId: string;
  scheduledAt: string;
  duration: number;
  notes: string | null;
  transcript: string | null;
  fathomShareLink: string | null;
  summaryEmailStatus: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface DraftEmail {
  id: string;
  clientId: string;
  scheduledAt: string;
  summaryEmailDraft: {
    subject: string;
    body: string;
    extractedTasks: Array<{
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: string;
      category: string;
    }>;
  };
  summaryEmailGeneratedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  draftTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: string;
    category: string;
  }>;
}

export default function ConsultantEchoDashboardPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; email: DraftEmail | null }>({
    open: false,
    email: null,
  });
  const [generateDialog, setGenerateDialog] = useState<{ open: boolean; consultation: PendingConsultation | null; notes: string }>({
    open: false,
    consultation: null,
    notes: "",
  });

  const { data: stats, isLoading: statsLoading } = useQuery<EchoStats>({
    queryKey: ["/api/echo/stats"],
    queryFn: async () => {
      const response = await fetch("/api/echo/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: pendingConsultations = [], isLoading: pendingLoading } = useQuery<PendingConsultation[]>({
    queryKey: ["/api/echo/pending-consultations"],
    queryFn: async () => {
      const response = await fetch("/api/echo/pending-consultations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch pending consultations");
      return response.json();
    },
  });

  const { data: draftEmails = [], isLoading: draftsLoading } = useQuery<DraftEmail[]>({
    queryKey: ["/api/echo/draft-emails"],
    queryFn: async () => {
      const response = await fetch("/api/echo/draft-emails", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch draft emails");
      return response.json();
    },
  });

  const generateEmailMutation = useMutation({
    mutationFn: async ({ consultationId, additionalNotes }: { consultationId: string; additionalNotes?: string }) => {
      const response = await fetch("/api/echo/generate-email", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId, additionalNotes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Generata",
        description: "L'email è stata generata con successo. Controlla la sezione 'In Attesa Approvazione'.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/pending-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      setGenerateDialog({ open: false, consultation: null, notes: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveAndSendMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/approve-and-send", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve and send");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Inviata",
        description: "L'email è stata approvata e inviata al cliente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      setPreviewDialog({ open: false, email: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveForAIMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/save-for-ai", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save for AI");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Salvato per AI",
        description: "Il contenuto è stato salvato nel contesto AI senza inviare l'email.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      setPreviewDialog({ open: false, email: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch("/api/echo/discard", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consultationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to discard");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bozza Scartata",
        description: "La bozza dell'email è stata scartata.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/draft-emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/echo/pending-consultations"] });
      setPreviewDialog({ open: false, email: null });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = statsLoading || pendingLoading || draftsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-100">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                  <ClipboardCheck className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Echo Dashboard
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Gestisci le email di riepilogo delle consulenze
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Email Generate</p>
                      <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{stats?.totalEmails || 0}</p>
                    </div>
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                      <Mail className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Task Estratti</p>
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats?.totalTasks || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                      <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">In Attesa</p>
                      <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{stats?.pendingApprovals || 0}</p>
                    </div>
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                      <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Tasso Successo</p>
                      <p className="text-3xl font-bold text-green-900 dark:text-green-100">{stats?.successRate || 0}%</p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                      <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-orange-200 dark:border-orange-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <AlertCircle className="h-5 w-5" />
                    Consulenze Senza Email
                  </CardTitle>
                  <CardDescription>
                    Consulenze completate che non hanno ancora un riepilogo email
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingConsultations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                      <p>Tutte le consulenze hanno già un'email di riepilogo!</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {pendingConsultations.map((consultation) => (
                        <div
                          key={consultation.id}
                          className="p-4 rounded-lg border border-orange-100 dark:border-orange-900 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {consultation.client?.firstName} {consultation.client?.lastName}
                              </span>
                            </div>
                            {consultation.transcript ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                <FileText className="h-3 w-3 mr-1" />
                                Trascrizione
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                No Trascrizione
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(consultation.scheduledAt), "d MMM yyyy", { locale: it })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(consultation.scheduledAt), { addSuffix: true, locale: it })}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                            disabled={!consultation.transcript || generateEmailMutation.isPending}
                            onClick={() => setGenerateDialog({ open: true, consultation, notes: "" })}
                          >
                            {generateEmailMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4 mr-2" />
                            )}
                            Genera Email
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <Clock className="h-5 w-5" />
                    Email in Attesa Approvazione
                  </CardTitle>
                  <CardDescription>
                    Bozze di email generate dall'AI pronte per la revisione
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {draftEmails.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Nessuna bozza in attesa di approvazione</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {draftEmails.map((email) => (
                        <div
                          key={email.id}
                          className="p-4 rounded-lg border border-yellow-100 dark:border-yellow-900 bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {email.client?.firstName} {email.client?.lastName}
                              </span>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                              <ClipboardCheck className="h-3 w-3 mr-1" />
                              {email.draftTasks?.length || 0} Task
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">
                            {email.summaryEmailDraft?.subject || "Riepilogo Consulenza"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                            <Clock className="h-3 w-3" />
                            Generata {formatDistanceToNow(new Date(email.summaryEmailGeneratedAt), { addSuffix: true, locale: it })}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewDialog({ open: true, email })}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.location.href = `/consultant/appointments?consultationId=${email.id}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Modifica
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white"
                              disabled={approveAndSendMutation.isPending}
                              onClick={() => approveAndSendMutation.mutate(email.id)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Approva & Invia
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <ConsultantAIAssistant />
      </div>

      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, email: open ? previewDialog.email : null })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              Anteprima Email
            </DialogTitle>
            <DialogDescription>
              Rivedi l'email prima di inviarla al cliente
            </DialogDescription>
          </DialogHeader>
          {previewDialog.email && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Destinatario</p>
                <p className="font-medium">
                  {previewDialog.email.client?.firstName} {previewDialog.email.client?.lastName} ({previewDialog.email.client?.email})
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Oggetto</p>
                <p className="font-medium">{previewDialog.email.summaryEmailDraft?.subject}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Contenuto</p>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {previewDialog.email.summaryEmailDraft?.body}
                </div>
              </div>
              {previewDialog.email.draftTasks && previewDialog.email.draftTasks.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                    Task Estratti ({previewDialog.email.draftTasks.length})
                  </p>
                  <ul className="space-y-1">
                    {previewDialog.email.draftTasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-2 text-sm">
                        <ClipboardCheck className="h-3 w-3 text-blue-500" />
                        {task.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => discardMutation.mutate(previewDialog.email!.id)}
              disabled={discardMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Scarta
            </Button>
            <Button
              variant="outline"
              onClick={() => saveForAIMutation.mutate(previewDialog.email!.id)}
              disabled={saveForAIMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Salva per AI
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => approveAndSendMutation.mutate(previewDialog.email!.id)}
              disabled={approveAndSendMutation.isPending}
            >
              {approveAndSendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Approva & Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateDialog.open} onOpenChange={(open) => setGenerateDialog({ open, consultation: open ? generateDialog.consultation : null, notes: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              Genera Email di Riepilogo
            </DialogTitle>
            <DialogDescription>
              L'AI genererà un'email di riepilogo basata sulla trascrizione della consulenza
            </DialogDescription>
          </DialogHeader>
          {generateDialog.consultation && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="font-medium">
                  {generateDialog.consultation.client?.firstName} {generateDialog.consultation.client?.lastName}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Data Consulenza</p>
                <p className="font-medium">
                  {format(new Date(generateDialog.consultation.scheduledAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Note Aggiuntive (opzionale)</label>
                <Textarea
                  placeholder="Aggiungi note o istruzioni per l'AI..."
                  value={generateDialog.notes}
                  onChange={(e) => setGenerateDialog({ ...generateDialog, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateDialog({ open: false, consultation: null, notes: "" })}
            >
              Annulla
            </Button>
            <Button
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              onClick={() => generateEmailMutation.mutate({
                consultationId: generateDialog.consultation!.id,
                additionalNotes: generateDialog.notes || undefined,
              })}
              disabled={generateEmailMutation.isPending}
            >
              {generateEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Genera Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
