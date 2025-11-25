import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CheckCircle, 
  Map,
  Target,
  Clock,
  Trophy,
  Star,
  ChevronRight,
  ChevronDown,
  BookOpen,
  ArrowLeft,
  Award,
  MessageSquare,
  GraduationCap,
  Link,
  ExternalLink,
  User,
  Calendar,
  BarChart3,
  TrendingUp
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link as RouterLink } from "wouter";
import type { RoadmapPhase, RoadmapGroup, RoadmapItem, ClientRoadmapProgress } from "@shared/schema";

interface RoadmapItemWithProgress extends RoadmapItem {
  progress?: ClientRoadmapProgress;
}

interface RoadmapGroupWithItems extends RoadmapGroup {
  items: RoadmapItemWithProgress[];
}

interface RoadmapPhaseWithGroups extends RoadmapPhase {
  groups: RoadmapGroupWithItems[];
}

export default function ConsultantClientRoadmap() {
  const user = getAuthUser();
  const [match, params] = useRoute<{ clientId: string }>("/consultant/client/:clientId/roadmap");
  const clientId = params?.clientId;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editingConsultantNotes, setEditingConsultantNotes] = useState<string | null>(null);
  const [consultantNoteText, setConsultantNoteText] = useState("");
  const [editingExternalLink, setEditingExternalLink] = useState<string | null>(null);
  const [externalLinkUrl, setExternalLinkUrl] = useState("");
  const [externalLinkTitle, setExternalLinkTitle] = useState("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch client details
  const { data: clientDetails } = useQuery<User>({
    queryKey: [`/api/users/${clientId}`],
    enabled: !!clientId,
  });

  // Fetch full roadmap with progress
  const { data: roadmap = [], isLoading, error } = useQuery<RoadmapPhaseWithGroups[]>({
    queryKey: ["/api/roadmap/full", clientId],
    enabled: !!clientId,
  });

  // Mutations
  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted, notes }: { itemId: string; isCompleted: boolean; notes?: string }) => {
      try {
        return await apiRequest('PUT', `/api/roadmap/progress/${clientId}/${itemId}`, {
          isCompleted,
          notes: notes || "",
          completedAt: isCompleted ? new Date().toISOString() : null,
        });
      } catch (error: any) {
        if (error.message?.includes('not found') || error.status === 404) {
          return await apiRequest('POST', `/api/roadmap/progress`, {
            clientId: clientId,
            itemId: itemId,
            isCompleted,
            notes: notes || "",
            completedAt: isCompleted ? new Date().toISOString() : null,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/full", clientId] });
      toast({
        title: "Progresso aggiornato",
        description: "Il progresso del cliente è stato aggiornato.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare il progresso.",
        variant: "destructive",
      });
    },
  });

  const updateConsultantProgressMutation = useMutation({
    mutationFn: async ({ itemId, consultantNotes, grade }: { itemId: string; consultantNotes?: string; grade?: number }) => {
      return apiRequest('PUT', `/api/roadmap/progress/${clientId}/${itemId}`, {
        consultantNotes,
        grade,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/full", clientId] });
      setEditingConsultantNotes(null);
      setConsultantNoteText("");
      toast({
        title: "Valutazione salvata",
        description: "La valutazione è stata salvata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la valutazione.",
        variant: "destructive",
      });
    },
  });

  const updateExternalLinkMutation = useMutation({
    mutationFn: async ({ itemId, externalLink, externalLinkTitle }: { itemId: string; externalLink?: string; externalLinkTitle?: string }) => {
      return apiRequest('PATCH', `/api/roadmap/items/${itemId}/external-link`, {
        externalLink,
        externalLinkTitle,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/full", clientId] });
      setEditingExternalLink(null);
      setExternalLinkUrl("");
      setExternalLinkTitle("");
      toast({
        title: "Link salvato",
        description: "Il link esterno è stato salvato.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il link.",
        variant: "destructive",
      });
    },
  });

  const handleToggleItem = (itemId: string, isCompleted: boolean, currentNotes?: string) => {
    toggleItemMutation.mutate({ itemId, isCompleted, notes: currentNotes || "" });
  };

  const handleSaveConsultantProgress = (itemId: string, grade?: number) => {
    updateConsultantProgressMutation.mutate({ itemId, consultantNotes: consultantNoteText, grade });
  };

  const startEditingConsultantNotes = (itemId: string, currentNotes?: string) => {
    setEditingConsultantNotes(itemId);
    setConsultantNoteText(currentNotes || "");
  };

  const startEditingExternalLink = (itemId: string, currentUrl?: string, currentTitle?: string) => {
    setEditingExternalLink(itemId);
    setExternalLinkUrl(currentUrl || "");
    setExternalLinkTitle(currentTitle || "");
  };

  const handleSaveExternalLink = (itemId: string) => {
    updateExternalLinkMutation.mutate({ itemId, externalLink: externalLinkUrl || null, externalLinkTitle: externalLinkTitle || null });
  };

  const getGradeColor = (grade: number | null | undefined) => {
    if (!grade) return "text-gray-500";
    if (grade >= 4) return "text-emerald-600";
    if (grade >= 3) return "text-amber-600";
    return "text-red-600";
  };

  const getGradeText = (grade: number | null | undefined) => {
    if (!grade) return "Non valutato";
    const gradeTexts = ["", "Insufficiente", "Sufficiente", "Buono", "Ottimo", "Eccellente"];
    return gradeTexts[grade] || "Non valutato";
  };

  // Calculate stats
  const totalItems = roadmap.reduce((total, phase) => 
    total + phase.groups.reduce((groupTotal, group) => 
      groupTotal + group.items.length, 0
    ), 0
  );

  const completedItems = roadmap.reduce((total, phase) => 
    total + phase.groups.reduce((groupTotal, group) => 
      groupTotal + group.items.filter(item => item.progress?.isCompleted).length, 0
    ), 0
  );

  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const itemsWithGrades: RoadmapItemWithProgress[] = roadmap.reduce((items, phase) => 
    items.concat(phase.groups.reduce((groupItems: RoadmapItemWithProgress[], group) => 
      groupItems.concat(group.items.filter(item => item.progress?.grade)), [] as RoadmapItemWithProgress[]
    )), [] as RoadmapItemWithProgress[]
  );

  const averageGrade = itemsWithGrades.length > 0 
    ? itemsWithGrades.reduce((sum, item) => sum + (item.progress?.grade || 0), 0) / itemsWithGrades.length 
    : 0;

  const getPhaseProgress = (phase: RoadmapPhaseWithGroups) => {
    const phaseItems = phase.groups.reduce((total, group) => total + group.items.length, 0);
    const phaseCompleted = phase.groups.reduce((total, group) => 
      total + group.items.filter(item => item.progress?.isCompleted).length, 0
    );
    return phaseItems > 0 ? Math.round((phaseCompleted / phaseItems) * 100) : 0;
  };

  const getGroupProgress = (group: RoadmapGroupWithItems) => {
    const completed = group.items.filter(item => item.progress?.isCompleted).length;
    return group.items.length > 0 ? Math.round((completed / group.items.length) * 100) : 0;
  };

  if (!clientId) {
    return <div>Client ID mancante</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex">
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
                <p className="text-gray-600 text-lg">Caricamento roadmap...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex">
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-8">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                  <Map className="h-12 w-12 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold text-red-900 mb-2">Errore nel caricamento</h3>
                <p className="text-red-700">Si è verificato un errore. Riprova più tardi.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto">
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <RouterLink href="/consultant/roadmap">
                  <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </RouterLink>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-20 w-20 ring-4 ring-white/30 shadow-xl">
                  <AvatarImage src={clientDetails?.avatar ?? undefined} />
                  <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                    {clientDetails ? `${clientDetails.firstName[0]}${clientDetails.lastName[0]}` : "C"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold mb-2">
                    {clientDetails ? `${clientDetails.firstName} ${clientDetails.lastName}` : "Caricamento..."}
                  </h1>
                  <p className="text-indigo-100 text-lg mb-3">Roadmap Metodo ORBITALE</p>
                  <div className="flex items-center gap-3 bg-white/20 rounded-lg px-3 py-1 w-fit">
                    <User className="h-4 w-4" />
                    <span className="text-sm">{clientDetails?.email || "..."}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-700">Progresso</CardTitle>
                  <Trophy className="h-5 w-5 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-900">{overallProgress}%</div>
                  <p className="text-sm text-emerald-600 mt-1">{completedItems}/{totalItems} completati</p>
                  <Progress value={overallProgress} className="h-2 mt-3 bg-emerald-200" />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-blue-700">Voto Medio</CardTitle>
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getGradeColor(Math.round(averageGrade))}`}>
                    {averageGrade > 0 ? `${Math.round(averageGrade * 10) / 10}/5` : "N/A"}
                  </div>
                  <p className="text-sm text-blue-600 mt-1">{itemsWithGrades.length} valutati</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 sm:col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-purple-700">Fase Attuale</CardTitle>
                  <Target className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">
                    {roadmap.find(phase => getPhaseProgress(phase) < 100)?.title.split(" ")[1] || "Completato"}
                  </div>
                  <p className="text-sm text-purple-600 mt-1">{roadmap.length} fasi totali</p>
                </CardContent>
              </Card>
            </div>

            {/* Accordion Roadmap */}
            <Accordion type="multiple" className="space-y-4">
              {roadmap.map((phase) => {
                const phaseProgress = getPhaseProgress(phase);

                return (
                  <AccordionItem key={phase.id} value={phase.id} className="border-0">
                    <Card className="border-0 shadow-lg overflow-hidden">
                      <AccordionTrigger className="hover:no-underline px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <Map className="h-6 w-6 text-white" />
                              </div>
                            </div>

                            <div className="flex-1 text-left min-w-0">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">{phase.title}</h3>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {phase.monthRange}
                                </span>
                                <span>•</span>
                                <span className="text-blue-600">{phase.objective}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-gray-900">{phaseProgress}%</div>
                              <Progress value={phaseProgress} className="h-2 w-24 mt-1 bg-gray-200" />
                            </div>
                            <Badge variant={phaseProgress === 100 ? "default" : "secondary"} className="text-sm px-3 py-1">
                              {phaseProgress === 100 ? "Completata" : "In Corso"}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent>
                        <div className="px-6 pb-6 pt-2">
                          {/* Phase Description */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-blue-900 mb-1">Obiettivo</h4>
                                <p className="text-sm text-blue-700">{phase.description}</p>
                              </div>
                            </div>
                          </div>

                          {/* Groups Accordion */}
                          <Accordion type="multiple" className="space-y-3">
                            {phase.groups.map((group) => {
                              const groupProgress = getGroupProgress(group);

                              return (
                                <AccordionItem key={group.id} value={group.id} className="border rounded-lg">
                                  <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-gray-50">
                                    <div className="flex items-center justify-between w-full pr-4">
                                      <div className="flex items-center gap-3 flex-1">
                                        <TrendingUp className="h-5 w-5 text-purple-600" />
                                        <h4 className="font-semibold text-gray-900">{group.title}</h4>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-gray-600">{groupProgress}%</span>
                                        <Badge variant={groupProgress === 100 ? "default" : "outline"} className="text-xs">
                                          {group.items.filter(item => item.progress?.isCompleted).length}/{group.items.length}
                                        </Badge>
                                      </div>
                                    </div>
                                  </AccordionTrigger>

                                  <AccordionContent>
                                    <div className="px-4 pb-4 space-y-3">
                                      {group.items.map((item) => {
                                        const isCompleted = item.progress?.isCompleted || false;
                                        const notes = item.progress?.notes || "";
                                        const consultantNotes = item.progress?.consultantNotes || "";
                                        const grade = item.progress?.grade;

                                        return (
                                          <div
                                            key={item.id}
                                            className={`p-4 rounded-lg border transition-all ${
                                              isCompleted 
                                                ? "bg-blue-50/50 border-blue-200" 
                                                : "bg-white border-gray-200 hover:border-blue-300"
                                            }`}
                                          >
                                            <div className="space-y-3">
                                              {/* Item Header */}
                                              <div className="flex items-start gap-3">
                                                <Checkbox
                                                  checked={isCompleted}
                                                  onCheckedChange={(checked) => 
                                                    handleToggleItem(item.id, !!checked, notes)
                                                  }
                                                  className="mt-1"
                                                />

                                                <div className="flex-1">
                                                  <div className="flex items-start justify-between gap-2">
                                                    <h5 className={`font-semibold ${isCompleted ? 'text-blue-700' : 'text-gray-900'}`}>
                                                      {item.title}
                                                    </h5>
                                                    {grade && (
                                                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-3 py-1.5 shadow-sm">
                                                        <Star className={`h-4 w-4 ${getGradeColor(grade)} fill-current`} />
                                                        <span className={`text-sm font-bold ${getGradeColor(grade)}`}>
                                                          {grade}/5
                                                        </span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                                </div>
                                              </div>

                                              {/* Client Notes */}
                                              {notes && (
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 shadow-sm">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-semibold text-blue-800">Note Cliente</span>
                                                  </div>
                                                  <p className="text-sm text-blue-700 leading-relaxed">{notes}</p>
                                                </div>
                                              )}

                                              {/* External Link & Assessment Cards Side by Side */}
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* External Link Card */}
                                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 shadow-sm">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <div className="bg-indigo-100 p-1.5 rounded-md">
                                                      <Link className="h-3.5 w-3.5 text-indigo-600" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-indigo-900">Risorsa</span>
                                                  </div>

                                                  {editingExternalLink === item.id ? (
                                                    <div className="space-y-2">
                                                      <Input
                                                        value={externalLinkTitle}
                                                        onChange={(e) => setExternalLinkTitle(e.target.value)}
                                                        placeholder="Titolo risorsa"
                                                        className="text-sm bg-white"
                                                      />
                                                      <Input
                                                        value={externalLinkUrl}
                                                        onChange={(e) => setExternalLinkUrl(e.target.value)}
                                                        placeholder="https://..."
                                                        className="text-sm bg-white"
                                                      />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" onClick={() => handleSaveExternalLink(item.id)} className="bg-indigo-600 hover:bg-indigo-700">Salva</Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingExternalLink(null)}>Annulla</Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div>
                                                      {item.externalLink ? (
                                                        <div className="space-y-2">
                                                          <a 
                                                            href={item.externalLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 font-medium group"
                                                          >
                                                            <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                            <span className="hover:underline line-clamp-1">{item.externalLinkTitle || item.externalLink}</span>
                                                          </a>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => startEditingExternalLink(item.id, item.externalLink, item.externalLinkTitle)}
                                                            className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                                                          >
                                                            Modifica
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <div>
                                                          <p className="text-xs text-indigo-600/60 italic mb-2">Nessuna risorsa collegata</p>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => startEditingExternalLink(item.id, item.externalLink, item.externalLinkTitle)}
                                                            className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                                                          >
                                                            + Aggiungi
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Consultant Assessment Card */}
                                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 shadow-sm">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <div className="bg-purple-100 p-1.5 rounded-md">
                                                      <Award className="h-3.5 w-3.5 text-purple-600" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-purple-900">Valutazione</span>
                                                  </div>

                                                  {editingConsultantNotes === item.id ? (
                                                    <div className="space-y-2">
                                                      <Select
                                                        value={grade?.toString() || ""}
                                                        onValueChange={(value) => {
                                                          const gradeNum = value ? parseInt(value) : undefined;
                                                          handleSaveConsultantProgress(item.id, gradeNum);
                                                        }}
                                                      >
                                                        <SelectTrigger className="text-sm bg-white h-8">
                                                          <SelectValue placeholder="Seleziona voto" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="1">1 - Insufficiente</SelectItem>
                                                          <SelectItem value="2">2 - Sufficiente</SelectItem>
                                                          <SelectItem value="3">3 - Buono</SelectItem>
                                                          <SelectItem value="4">4 - Ottimo</SelectItem>
                                                          <SelectItem value="5">5 - Eccellente</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                      <Textarea
                                                        value={consultantNoteText}
                                                        onChange={(e) => setConsultantNoteText(e.target.value)}
                                                        placeholder="Note private sulla valutazione..."
                                                        className="text-sm min-h-[60px] bg-white"
                                                      />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" onClick={() => handleSaveConsultantProgress(item.id)} className="bg-purple-600 hover:bg-purple-700 h-7 text-xs">Salva</Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingConsultantNotes(null)} className="h-7 text-xs">Annulla</Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-2">
                                                      {grade ? (
                                                        <div className="space-y-1">
                                                          <div className="flex items-center gap-1.5">
                                                            <Badge variant="outline" className={`${getGradeColor(grade)} border-current font-bold`}>
                                                              {grade}/5 - {getGradeText(grade)}
                                                            </Badge>
                                                          </div>
                                                          {consultantNotes && (
                                                            <p className="text-xs text-purple-700 leading-relaxed mt-2">{consultantNotes}</p>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <p className="text-xs text-purple-600/60 italic">Nessuna valutazione</p>
                                                      )}
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => startEditingConsultantNotes(item.id, consultantNotes)}
                                                        className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                                                      >
                                                        {grade || consultantNotes ? "Modifica" : "+ Aggiungi"}
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {item.progress?.completedAt && (
                                                <div className="flex items-center gap-2 text-blue-600 text-xs font-medium bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 w-fit">
                                                  <CheckCircle className="h-3.5 w-3.5" />
                                                  <span>Completato il {new Date(item.progress.completedAt).toLocaleDateString('it-IT')}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}