import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Eye, 
  Filter,
  Calendar,
  TrendingUp,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MailOpen,
  MailX,
  TestTube,
  Sparkles,
  History
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import it from "date-fns/locale/it";

/**
 * Email log entry interface
 */
interface EmailLog {
  id: string;
  clientId: string;
  clientName: string;
  subject: string;
  body: string;
  status: "sent" | "failed" | "pending";
  emailType: string;
  sentAt: string;
  openedAt?: string | null;
  isTest?: boolean;
  errorMessage?: string;
}

/**
 * Email stats interface
 */
interface EmailStats {
  totalEmails: number;
  sentToday: number;
  successRate: number;
  openRate: number;
}

/**
 * Consultant Email Logs Page
 * 
 * Displays a comprehensive log of all emails sent to clients.
 * Features include filtering, search, preview, and pagination.
 */
export default function ConsultantEmailLogsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTestEmails, setShowTestEmails] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<EmailLog | null>(null);
  const { toast } = useToast();

  const itemsPerPage = 10;

  // Fetch email logs
  const { data: emailLogs = [], isLoading: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/consultant/email-logs", selectedClient, selectedType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClient !== "all") params.append("clientId", selectedClient);
      
      // Only send type param for concrete emailType values (not categories like "journey")
      if (selectedType !== "all" && selectedType !== "journey") {
        params.append("type", selectedType);
      }

      const response = await fetch(`/api/consultant/email-logs?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch email logs");
      return response.json();
    },
  });

  // Fetch clients for filter
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Calculate stats
  const stats: EmailStats = {
    totalEmails: emailLogs.length,
    sentToday: emailLogs.filter(log => {
      const logDate = new Date(log.sentAt);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
    successRate: emailLogs.length > 0 
      ? (emailLogs.filter(log => log.status === "sent").length / emailLogs.length) * 100 
      : 0,
    openRate: emailLogs.length > 0
      ? (emailLogs.filter(log => log.openedAt !== null && log.openedAt !== undefined).length / emailLogs.length) * 100
      : 0,
  };

  // Filter emails based on search, type, and test filter
  const filteredEmails = emailLogs.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTestFilter = showTestEmails || !email.isTest;
    
    // Type filtering with category support
    let matchesType = true;
    if (selectedType !== "all") {
      if (selectedType === "journey") {
        // Email Journey = all types EXCEPT consultation_summary
        matchesType = email.emailType !== "consultation_summary";
      } else {
        // Specific type (including consultation_summary)
        matchesType = email.emailType === selectedType;
      }
    }
    
    return matchesSearch && matchesTestFilter && matchesType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage);
  const paginatedEmails = filteredEmails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePreview = (email: EmailLog) => {
    setPreviewEmail(email);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Inviata
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Fallita
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            In attesa
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Navigation Tabs */}
          <NavigationTabs
            tabs={[
              { label: "Configurazione", href: "/consultant/ai-config", icon: Sparkles },
              { label: "Log Email", href: "/consultant/email-logs", icon: History },
            ]}
          />

          {logsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Card className="p-8 shadow-2xl bg-white/80 backdrop-blur-sm border-0">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                  <p className="mt-6 text-slate-700 font-semibold text-lg">Caricamento email logs...</p>
                </div>
              </Card>
            </div>
          ) : (
            <>
          {/* Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                      <Mail className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold">Log Email</h1>
                      <p className="text-blue-100 text-lg">Monitora tutte le email inviate ai tuoi clienti</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-700">Email Totali</p>
                    <p className="text-3xl font-bold text-blue-900">{stats.totalEmails}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                    <Mail className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-emerald-700">Inviate Oggi</p>
                    <p className="text-3xl font-bold text-emerald-900">{stats.sentToday}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                    <Send className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-purple-700">% Apertura Email</p>
                    <p className="text-3xl font-bold text-purple-900">{stats.openRate.toFixed(1)}%</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center">
                    <MailOpen className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutti i clienti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i clienti</SelectItem>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.firstName} {client.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo Email</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutti i tipi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i tipi</SelectItem>
                      <SelectItem value="journey">📧 Email Journey</SelectItem>
                      <SelectItem value="consultation_summary">📋 Riepilogo Consulenza</SelectItem>
                      <SelectItem value="welcome">Benvenuto</SelectItem>
                      <SelectItem value="reminder">Promemoria</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="custom">Personalizzata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cerca</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per oggetto o cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Test Emails Filter */}
                <div className="flex items-center space-x-2 mt-4 pt-4 border-t">
                  <Checkbox 
                    id="show-test"
                    checked={showTestEmails}
                    onCheckedChange={(checked) => setShowTestEmails(checked as boolean)}
                  />
                  <label
                    htmlFor="show-test"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Mostra email di test
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Logs Table */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Email Inviate</CardTitle>
              <CardDescription>
                Storico completo delle email inviate ai clienti
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paginatedEmails.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nessuna email trovata</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Oggetto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Lettura</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedEmails.map((email) => (
                          <TableRow key={email.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(email.sentAt), "dd MMM yyyy", { locale: it })}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.sentAt), "HH:mm")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{email.clientName}</TableCell>
                            <TableCell className="max-w-xs truncate">{email.subject}</TableCell>
                            <TableCell>
                              <div className="flex gap-1.5">
                                <Badge variant="outline">{email.emailType}</Badge>
                                {email.isTest && (
                                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                    <TestTube className="h-3 w-3 mr-1" />
                                    Test
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(email.status)}</TableCell>
                            <TableCell>
                              {email.openedAt ? (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                  <MailOpen className="h-3 w-3 mr-1" />
                                  Letta
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  <MailX className="h-3 w-3 mr-1" />
                                  Non letta
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(email)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-sm text-muted-foreground">
                        Pagina {currentPage} di {totalPages} ({filteredEmails.length} email totali)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Precedente
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Successiva
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
            </>
          )}
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Anteprima Email
            </DialogTitle>
            <DialogDescription>
              Email inviata a {previewEmail?.clientName} il {previewEmail && format(new Date(previewEmail.sentAt), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
            </DialogDescription>
          </DialogHeader>

          {previewEmail && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{previewEmail.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stato</p>
                    {getStatusBadge(previewEmail.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                    <Badge variant="outline">{previewEmail.emailType}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data invio</p>
                    <p className="text-sm">{format(new Date(previewEmail.sentAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Oggetto</p>
                <p className="text-lg font-semibold">{previewEmail.subject}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Corpo del messaggio</p>
                <div className="bg-white border rounded-lg overflow-auto max-h-[500px]">
                  <div dangerouslySetInnerHTML={{ __html: previewEmail.body }} />
                </div>
              </div>

              {previewEmail.status === "failed" && previewEmail.errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Errore</p>
                  <p className="text-sm text-red-600">{previewEmail.errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConsultantAIAssistant />
    </div>
  );
}
