import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Award,
  MessageSquare,
  GraduationCap,
  ExternalLink // Import ExternalLink icon
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { getAuthUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RoadmapPhase, RoadmapGroup, RoadmapItem, ClientRoadmapProgress } from "@shared/schema";

interface RoadmapItemWithProgress extends RoadmapItem {
  progress?: ClientRoadmapProgress;
  externalLink?: string; // Add external link field
  externalLinkTitle?: string; // Add external link title field
}

interface RoadmapGroupWithItems extends RoadmapGroup {
  items: RoadmapItemWithProgress[];
}

interface RoadmapPhaseWithGroups extends RoadmapPhase {
  groups: RoadmapGroupWithItems[];
}

export default function ClientRoadmap() {
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();

  // Fetch full roadmap with progress
  const { data: roadmap = [], isLoading, error } = useQuery<RoadmapPhaseWithGroups[]>({
    queryKey: ["/api/roadmap/full", user?.id],
  });

  // Toggle item completion mutation
  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted, notes }: { itemId: string; isCompleted: boolean; notes?: string }) => {
      return apiRequest('PUT', `/api/roadmap/progress/${user?.id}/${itemId}`, {
        isCompleted,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/full", user?.id] });
      toast({
        title: "Progresso aggiornato",
        description: "Il tuo progresso è stato salvato con successo.",
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

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      return apiRequest('PUT', `/api/roadmap/progress/${user?.id}/${itemId}`, {
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/full", user?.id] });
      setEditingNotes(null);
      setNoteText("");
      toast({
        title: "Note salvate",
        description: "Le tue note sono state salvate con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare le note.",
        variant: "destructive",
      });
    },
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => 
      prev.includes(phaseId) 
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleToggleItem = (itemId: string, isCompleted: boolean, currentNotes?: string) => {
    toggleItemMutation.mutate({ itemId, isCompleted, notes: currentNotes });
  };

  const handleSaveNotes = (itemId: string) => {
    updateNotesMutation.mutate({ itemId, notes: noteText });
  };

  const startEditingNotes = (itemId: string, currentNotes?: string) => {
    setEditingNotes(itemId);
    setNoteText(currentNotes || "");
  };

  const getGradeColor = (grade: number | null | undefined) => {
    if (!grade) return "text-muted-foreground";
    if (grade >= 4) return "text-green-600";
    if (grade >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getGradeText = (grade: number | null | undefined) => {
    if (!grade) return "Non valutato";
    const gradeTexts = ["", "Insufficiente", "Sufficiente", "Buono", "Ottimo", "Eccellente"];
    return gradeTexts[grade] || "Non valutato";
  };

  // Calculate overall progress
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

  // Calculate average grade
  const itemsWithGrades = roadmap.reduce((items, phase) => 
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

  const pageContext = {
    consultations: "/client/consultations",
    roadmap: "/client/roadmap",
    dailyTasks: "/client/daily-tasks",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Caricamento della tua roadmap...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-8">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Map className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Errore nel caricamento</h3>
                <p className="text-muted-foreground text-center">
                  Si è verificato un errore nel caricamento della tua roadmap. Riprova più tardi.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="client-roadmap">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-hidden">
          <div className="space-y-6 sm:space-8 max-w-full">
            {/* Header - Mobile Optimized */}
            <div className="space-y-4">
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">La Mia Roadmap</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  Il tuo percorso personalizzato nel Metodo ORBITALE
                </p>
              </div>

              {/* Progress Cards - Mobile Optimized */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <Card className="w-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                      <span className="truncate">Progresso Complessivo</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xl sm:text-2xl font-bold" data-testid="overall-progress">{overallProgress}%</span>
                        <Badge variant={overallProgress === 100 ? "default" : "secondary"} className="text-xs sm:text-sm whitespace-nowrap">
                          {completedItems}/{totalItems} completati
                        </Badge>
                      </div>
                      <Progress value={overallProgress} className="h-2 sm:h-3 w-full" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="w-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                      <span className="truncate">Valutazione Media</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xl sm:text-2xl font-bold ${getGradeColor(Math.round(averageGrade))}`}>
                          {averageGrade > 0 ? `${Math.round(averageGrade * 10) / 10}/5` : "N/A"}
                        </span>
                        <Badge variant="secondary" className={`${getGradeColor(Math.round(averageGrade))} text-xs sm:text-sm whitespace-nowrap`}>
                          {averageGrade > 0 ? getGradeText(Math.round(averageGrade)) : "Non valutato"}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {itemsWithGrades.length} item valutati dal tuo consulente
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Roadmap Phases - Ottimizzato */}
            <div className="space-y-3">
              {roadmap.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4" data-testid="empty-roadmap">
                    <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2 text-center">Roadmap non disponibile</h3>
                    <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
                      Il tuo consulente deve ancora configurare la tua roadmap personalizzata.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                roadmap.map((phase, phaseIndex) => {
                  const phaseProgress = getPhaseProgress(phase);
                  const isExpanded = expandedPhases.includes(phase.id);

                  return (
                    <Card key={phase.id} className={`overflow-hidden w-full transition-all ${isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow'}`}>
                      <CardHeader 
                        className="cursor-pointer hover:bg-muted/30 transition-colors p-3 sm:p-4"
                        onClick={() => togglePhase(phase.id)}
                        data-testid={`phase-header-${phase.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-sm sm:text-base font-bold break-words">
                                  {phase.title}
                                </CardTitle>
                                <Badge variant={phaseProgress === 100 ? "default" : "outline"} className="text-xs">
                                  {phaseProgress}%
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                                {phase.monthRange}
                              </p>
                            </div>
                          </div>
                          <Progress value={phaseProgress} className="w-12 sm:w-16 h-1.5 flex-shrink-0" />
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="space-y-3 px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                          {phase.description && (
                            <div className="text-xs sm:text-sm text-muted-foreground bg-muted/30 rounded-md p-2 sm:p-3 break-words">
                              {phase.description}
                            </div>
                          )}

                          {/* Groups within Phase - Ottimizzato */}
                          <div className="space-y-2">
                            {phase.groups.map((group) => {
                              const groupProgress = getGroupProgress(group);
                              const isGroupExpanded = expandedGroups.includes(group.id);

                              return (
                                <div key={group.id} className={`border rounded-lg overflow-hidden transition-all ${isGroupExpanded ? 'border-primary/30 bg-accent/5' : 'border-border'}`}>
                                  <div
                                    className="cursor-pointer hover:bg-muted/30 transition-colors py-2 px-3"
                                    onClick={() => toggleGroup(group.id)}
                                    data-testid={`group-header-${group.id}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {isGroupExpanded ? (
                                          <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        )}
                                        <h4 className="font-medium text-xs sm:text-sm break-words">{group.title}</h4>
                                      </div>
                                      <Badge variant={groupProgress === 100 ? "default" : "secondary"} className="text-[10px] sm:text-xs h-5 px-1.5">
                                        {groupProgress}%
                                      </Badge>
                                    </div>
                                  </div>

                                  {isGroupExpanded && (
                                    <div className="space-y-2 p-2 sm:p-3 bg-background">
                                      {/* Items within Group - Ottimizzato */}
                                      {group.items.map((item) => {
                                        const isCompleted = item.progress?.isCompleted || false;
                                        const notes = item.progress?.notes || "";
                                        const consultantNotes = item.progress?.consultantNotes || "";
                                        const grade = item.progress?.grade;

                                        return (
                                          <div
                                            key={item.id}
                                            className={`p-2 sm:p-3 border rounded-md transition-all w-full ${
                                              isCompleted 
                                                ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800" 
                                                : "bg-card hover:bg-accent/5 border-border"
                                            }`}
                                            data-testid={`item-${item.id}`}
                                          >
                                            <div className="space-y-2">
                                              {/* Item Header - Compatto */}
                                              <div className="flex items-start gap-2 sm:gap-3">
                                                <div className="mt-0.5 flex-shrink-0">
                                                  {isCompleted ? (
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                  ) : (
                                                    <div className="h-4 w-4 border-2 border-gray-300 rounded-sm bg-background"></div>
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h5 className={`font-medium text-xs sm:text-sm break-words ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                                      {item.title}
                                                    </h5>
                                                    {isCompleted && (
                                                      <Badge variant="outline" className="text-[10px] h-4 px-1 bg-green-50 text-green-700 border-green-300">
                                                        ✓
                                                      </Badge>
                                                    )}
                                                    {grade && (
                                                      <div className="flex items-center gap-0.5">
                                                        <Star className={`h-3 w-3 ${getGradeColor(grade)} flex-shrink-0`} />
                                                        <span className={`text-[10px] sm:text-xs font-medium ${getGradeColor(grade)}`}>
                                                          {grade}/5
                                                        </span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <p className={`text-[11px] sm:text-xs break-words ${isCompleted ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                                    {item.description}
                                                  </p>
                                                </div>
                                              </div>

                                              {/* External Link Section - Compatto */}
                                              {item.externalLink && (
                                                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                                                  <a 
                                                    href={item.externalLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-medium"
                                                  >
                                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{item.externalLinkTitle || "Visualizza risorsa"}</span>
                                                  </a>
                                                </div>
                                              )}

                                              {/* Client Notes Section - Compatto */}
                                              {editingNotes === item.id ? (
                                                <div className="space-y-2">
                                                  <Textarea
                                                    value={noteText}
                                                    onChange={(e) => setNoteText(e.target.value)}
                                                    placeholder="Le tue note..."
                                                    className="min-h-[50px] text-xs"
                                                    data-testid={`textarea-notes-${item.id}`}
                                                  />
                                                  <div className="flex gap-1.5">
                                                    <Button
                                                      size="sm"
                                                      onClick={() => handleSaveNotes(item.id)}
                                                      disabled={updateNotesMutation.isPending}
                                                      data-testid={`button-save-notes-${item.id}`}
                                                      className="text-xs h-7"
                                                    >
                                                      Salva
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() => {
                                                        setEditingNotes(null);
                                                        setNoteText("");
                                                      }}
                                                      data-testid={`button-cancel-notes-${item.id}`}
                                                      className="text-xs h-7"
                                                    >
                                                      Annulla
                                                    </Button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="space-y-1.5">
                                                  {notes && (
                                                    <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded-md p-2 border border-blue-100 dark:border-blue-900">
                                                      <p className="text-xs text-blue-900 dark:text-blue-100 break-words">{notes}</p>
                                                    </div>
                                                  )}
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => startEditingNotes(item.id, notes)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-medium"
                                                    data-testid={`button-edit-notes-${item.id}`}
                                                  >
                                                    {notes ? "✏️ Modifica" : "+ Aggiungi note"}
                                                  </Button>
                                                </div>
                                              )}

                                              {/* Consultant Feedback - Compatto */}
                                              {(grade || consultantNotes) && (
                                                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-700 rounded-md p-2">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <Award className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">
                                                      Feedback Consulente
                                                    </span>
                                                  </div>

                                                  {grade && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                      <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                          <Star
                                                            key={star}
                                                            className={`h-3 w-3 ${
                                                              star <= grade
                                                                ? 'text-yellow-500 fill-yellow-500'
                                                                : 'text-gray-300 dark:text-gray-600'
                                                            }`}
                                                          />
                                                        ))}
                                                      </div>
                                                      <Badge 
                                                        variant="secondary" 
                                                        className={`${getGradeColor(grade)} text-[10px] h-4 px-1.5`}
                                                      >
                                                        {getGradeText(grade)}
                                                      </Badge>
                                                    </div>
                                                  )}

                                                  {consultantNotes && (
                                                    <p className="text-xs text-purple-800 dark:text-purple-200 break-words leading-relaxed">
                                                      {consultantNotes}
                                                    </p>
                                                  )}
                                                </div>
                                              )}

                                              {item.progress?.completedAt && (
                                                <div className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                                                  <Clock className="h-2.5 w-2.5" />
                                                  <span>{new Date(item.progress.completedAt).toLocaleDateString('it-IT')}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}