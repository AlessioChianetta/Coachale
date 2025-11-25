import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Loader2, CheckCircle2, Clock, XCircle, Calendar, Mail, FileText, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";

interface EmailJourneyTemplate {
  id: string;
  dayOfMonth: number;
  title: string;
  description: string;
  emailType: string;
  promptTemplate: string;
  tone: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClientEmailJourneyProgress {
  id: string;
  consultantId: string;
  clientId: string;
  currentDay: number;
  monthStartDate: string;
  lastEmailSentAt: string | null;
  lastTemplateUsedId: string | null;
  lastEmailSubject: string | null;
  lastEmailBody: string | null;
  lastEmailActions: Array<{action: string; type: string; expectedCompletion?: string}>;
  actionsCompletedData: {
    completed: boolean;
    details: Array<{action: string; completed: boolean; completedAt?: string}>;
  };
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  } | null;
}

export default function ConsultantEmailJourney() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailJourneyTemplate | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const { data: allProgress, isLoading } = useQuery<ClientEmailJourneyProgress[]>({
    queryKey: ["/api/email-journey-progress"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<EmailJourneyTemplate[]>({
    queryKey: ["/api/email-journey-templates"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter progress based on actions status
  const filteredProgress = allProgress?.filter((progress) => {
    if (statusFilter === "all") return true;
    
    const hasActions = progress.lastEmailActions.length > 0;
    if (!hasActions) return statusFilter === "no-actions";
    
    const allCompleted = progress.actionsCompletedData.completed;
    const someCompleted = progress.actionsCompletedData.details.some(d => d.completed);
    
    if (statusFilter === "completed") return allCompleted;
    if (statusFilter === "pending") return !allCompleted && someCompleted;
    if (statusFilter === "not-started") return !someCompleted;
    
    return true;
  });

  // Calculate statistics
  const stats = {
    total: allProgress?.length || 0,
    active: allProgress?.filter(p => p.currentDay <= 31).length || 0,
    allActionsCompleted: allProgress?.filter(p => p.actionsCompletedData.completed).length || 0,
    needsAttention: allProgress?.filter(p => 
      p.lastEmailActions.length > 0 && 
      !p.actionsCompletedData.completed
    ).length || 0,
  };

  const handlePreviewTemplate = (template: EmailJourneyTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'professionale': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'amichevole': return 'bg-green-100 text-green-800 border-green-300';
      case 'motivazionale': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    if (type.includes('esercizi')) return 'bg-orange-50 border-orange-200';
    if (type.includes('corsi') || type.includes('università')) return 'bg-indigo-50 border-indigo-200';
    if (type.includes('celebra')) return 'bg-pink-50 border-pink-200';
    if (type.includes('recap') || type.includes('check')) return 'bg-cyan-50 border-cyan-200';
    if (type.includes('motivazional')) return 'bg-purple-50 border-purple-200';
    return 'bg-slate-50 border-slate-200';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Journey Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitora il progresso del journey email mensile completo (1-31 giorni) per tutti i tuoi clienti
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clienti Totali</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Journey Attivi</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Azioni Completate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.allActionsCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Richiedono Attenzione</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.needsAttention}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="progress" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progress">👥 Progresso Clienti</TabsTrigger>
          <TabsTrigger value="templates">📧 Template Journey (31 giorni)</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Progresso Clienti</CardTitle>
              <CardDescription>
                Visualizza e monitora il progresso di ogni cliente nel journey email
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                <SelectItem value="completed">✅ Azioni completate</SelectItem>
                <SelectItem value="pending">⏳ Azioni in corso</SelectItem>
                <SelectItem value="not-started">❌ Azioni non iniziate</SelectItem>
                <SelectItem value="no-actions">Nessuna azione</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Giorno Journey</TableHead>
                <TableHead>Inizio Ciclo</TableHead>
                <TableHead>Ultima Email</TableHead>
                <TableHead>Azioni Email Precedente</TableHead>
                <TableHead>Status Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProgress && filteredProgress.length > 0 ? (
                filteredProgress.map((progress) => {
                  const client = progress.client;
                  const actionsCount = progress.lastEmailActions.length;
                  const completedCount = progress.actionsCompletedData.details.filter(d => d.completed).length;
                  
                  let actionBadge;
                  if (actionsCount === 0) {
                    actionBadge = <Badge variant="outline">Nessuna azione</Badge>;
                  } else if (progress.actionsCompletedData.completed) {
                    actionBadge = <Badge className="bg-green-500">✅ {completedCount}/{actionsCount} Completate</Badge>;
                  } else if (completedCount > 0) {
                    actionBadge = <Badge className="bg-orange-500">⏳ {completedCount}/{actionsCount} In corso</Badge>;
                  } else {
                    actionBadge = <Badge variant="destructive">❌ {completedCount}/{actionsCount} Non iniziate</Badge>;
                  }

                  return (
                    <TableRow key={progress.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {client?.avatar ? (
                            <img src={client.avatar} alt={client.firstName} className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">{client?.firstName.charAt(0)}</span>
                            </div>
                          )}
                          <div>
                            <div>{client?.firstName} {client?.lastName}</div>
                            <div className="text-xs text-muted-foreground">{client?.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={progress.currentDay > 28 ? 'bg-purple-100 text-purple-800' : ''}>
                          Giorno {progress.currentDay}/31
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(progress.monthStartDate).toLocaleDateString('it-IT')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {progress.lastEmailSentAt 
                          ? new Date(progress.lastEmailSentAt).toLocaleDateString('it-IT')
                          : 'Mai'
                        }
                      </TableCell>
                      <TableCell>
                        {actionsCount > 0 ? (
                          <div className="space-y-1 text-sm">
                            {progress.lastEmailActions.slice(0, 2).map((action, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground">
                                • {action.action}
                              </div>
                            ))}
                            {actionsCount > 2 && (
                              <div className="text-xs text-muted-foreground italic">
                                ...e altre {actionsCount - 2} azioni
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nessuna</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {actionBadge}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nessun cliente trovato con i filtri selezionati
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Template Journey Email (1-31 Giorni)
              </CardTitle>
              <CardDescription>
                Calendario completo dei template email con supporto per mesi di 28, 29, 30 e 31 giorni
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-6">
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 bg-slate-200 border-2 border-slate-400 rounded" />
                      <span>Giorni 1-28 (tutti i mesi)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 bg-purple-200 border-2 border-purple-400 rounded" />
                      <span>Giorno 29 (mesi di 29+ giorni)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 bg-indigo-200 border-2 border-indigo-400 rounded" />
                      <span>Giorno 30 (mesi di 30+ giorni)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 bg-pink-200 border-2 border-pink-400 rounded" />
                      <span>Giorno 31 (mesi di 31 giorni)</span>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-3">
                    {templates.sort((a, b) => a.dayOfMonth - b.dayOfMonth).map((template) => {
                      const isExtraDay = template.dayOfMonth > 28;
                      let cardClass = 'border-2 transition-all hover:shadow-lg cursor-pointer ';
                      
                      if (template.dayOfMonth === 29) {
                        cardClass += 'bg-purple-50 border-purple-300 hover:border-purple-500';
                      } else if (template.dayOfMonth === 30) {
                        cardClass += 'bg-indigo-50 border-indigo-300 hover:border-indigo-500';
                      } else if (template.dayOfMonth === 31) {
                        cardClass += 'bg-pink-50 border-pink-300 hover:border-pink-500';
                      } else {
                        cardClass += 'bg-white border-slate-300 hover:border-blue-500';
                      }

                      return (
                        <div
                          key={template.id}
                          className={cardClass}
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <div className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="font-bold">
                                Giorno {template.dayOfMonth}
                              </Badge>
                              {isExtraDay && (
                                <Badge className="bg-amber-500 text-xs">Extra</Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm line-clamp-2">{template.title}</h4>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className={`text-xs ${getToneColor(template.tone)}`}>
                                {template.tone}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-slate-100">
                                {template.emailType}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewTemplate(template);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <Card className="border-slate-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">{templates.filter(t => t.dayOfMonth <= 28).length}</div>
                        <div className="text-xs text-muted-foreground">Template Standard</div>
                      </CardContent>
                    </Card>
                    <Card className="border-purple-200 bg-purple-50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-900">{templates.filter(t => t.dayOfMonth === 29).length}</div>
                        <div className="text-xs text-muted-foreground">Template Giorno 29</div>
                      </CardContent>
                    </Card>
                    <Card className="border-indigo-200 bg-indigo-50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-indigo-900">{templates.filter(t => t.dayOfMonth === 30).length}</div>
                        <div className="text-xs text-muted-foreground">Template Giorno 30</div>
                      </CardContent>
                    </Card>
                    <Card className="border-pink-200 bg-pink-50">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-pink-900">{templates.filter(t => t.dayOfMonth === 31).length}</div>
                        <div className="text-xs text-muted-foreground">Template Giorno 31</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold text-muted-foreground">Nessun template trovato</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Esegui lo script di seeding per creare i template journey
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Template Giorno {selectedTemplate?.dayOfMonth}: {selectedTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tipo Email</p>
                  <Badge className={getTypeColor(selectedTemplate.emailType)}>
                    {selectedTemplate.emailType}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tono</p>
                  <Badge className={getToneColor(selectedTemplate.tone)}>
                    {selectedTemplate.tone}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Priorità</p>
                  <Badge variant="outline">
                    {selectedTemplate.priority}/10
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold">Prompt Template AI</h4>
                </div>
                <Textarea
                  value={selectedTemplate.promptTemplate}
                  readOnly
                  rows={20}
                  className="font-mono text-xs bg-slate-50 border-slate-300"
                />
              </div>

              {selectedTemplate.dayOfMonth > 28 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Template Extra</p>
                      <p>
                        Questo template viene utilizzato solo per mesi con{' '}
                        {selectedTemplate.dayOfMonth === 29 && '29+'}
                        {selectedTemplate.dayOfMonth === 30 && '30+'}
                        {selectedTemplate.dayOfMonth === 31 && '31'} giorni
                      </p>
                    </div>
                  </div>
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
