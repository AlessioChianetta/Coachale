import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, BookOpen, Target, Brain, MessageSquare, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScriptReferencePanel } from './ScriptReferencePanel';
import { VisualFlowRoadmap } from './VisualFlowRoadmap';
import { AIReasoningPanel } from './AIReasoningPanel';
import { CheckpointDetailPanel } from './CheckpointDetailPanel';
import { GeminiReportPanel } from './GeminiReportPanel';
import { DiscoveryRecPanel } from '@/components/ai-trainer/DiscoveryRecPanel';
import { cn } from '@/lib/utils';

interface ScriptStructure {
  version: string;
  phases: any[];
  metadata: any;
}

interface ConversationDetail {
  conversationId: string;
  agentId: string;
  prospectName: string | null;
  currentPhase: string;
  phasesReached: string[];
  phaseActivations: Array<{
    phase: string;
    timestamp: string;
    trigger: string;
    matchedQuestion?: string;
    keywordsMatched?: string[];
    similarity?: number;
    messageId?: string;
    excerpt?: string;
    reasoning?: string;
  }>;
  checkpointsCompleted: Array<{
    checkpointId: string;
    status?: "completed" | "pending" | "failed";
    completedAt: string;
    verifications: Array<{
      requirement: string;
      status: "verified" | "pending" | "failed";
      evidence?: {
        messageId: string;
        excerpt: string;
        matchedKeywords: string[];
        timestamp: string;
      };
    }> | string[];
  }>;
  semanticTypes: string[];
  aiReasoning: Array<{
    timestamp: string;
    phase: string;
    decision: string;
    reasoning: string;
  }>;
  fullTranscript: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    phase: string;
    messageId?: string;
  }>;
  contextualResponses: Array<{
    timestamp: string;
    phase: string;
    prospectQuestion: string;
    aiResponse: string;
  }>;
  ladderActivations: Array<{
    timestamp: string;
    phase: string;
    level: number;
    question: string;
    userResponse: string;
    wasVague: boolean;
  }>;
  questionsAsked: Array<{
    timestamp: string;
    phase: string;
    question: string;
    questionType: string;
  }>;
  completionRate: number;
  totalDuration: number;
  createdAt: string;
  scriptSnapshot?: ScriptStructure;
  scriptVersion?: string;
  aiAnalysisResult?: {
    insights: Array<{ category: string; text: string; priority: string }>;
    problems: Array<{ category: string; text: string; severity: string }>;
    suggestions: Array<{ category: string; text: string; impact: string }>;
    strengths: Array<{ category: string; text: string }>;
    score: number | { overall: number; [key: string]: any }; // Updated type definition
    analyzedAt: string;
    analyzedFiles: string[];
  };
}

interface TrainingMapLayoutProps {
  conversationDetail: ConversationDetail;
  scriptStructure: ScriptStructure;
  onBack: () => void;
}

export function TrainingMapLayout({
  conversationDetail,
  scriptStructure,
  onBack,
}: TrainingMapLayoutProps) {
 
  // We keep track of the currently "viewed" phase for the roadmap highlight
  const [activePhaseId, setActivePhaseId] = useState<string | null>(
    conversationDetail.phasesReached[0] || null
  );
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const observerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const effectiveScript = conversationDetail.scriptSnapshot || scriptStructure;
  const snapshotVersionDiffers = !!conversationDetail.scriptSnapshot && 
    conversationDetail.scriptSnapshot.version !== scriptStructure.version;

  // Helper to safely get the score
  const getOverallScore = () => {
    const score = conversationDetail.aiAnalysisResult?.score;
    if (typeof score === 'number') return score;
    if (typeof score === 'object' && score !== null) return score.overall || 0;
    return 0;
  };

  const overallScore = getOverallScore();

  // Scroll logic: When clicking on the roadmap
  const scrollToPhase = (phaseId: string) => {
    const element = document.getElementById(`phase-block-${phaseId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActivePhaseId(phaseId);
    }
  };

  // Setup Intersection Observer to update activePhaseId on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const phaseId = entry.target.getAttribute('data-phase-id');
            if (phaseId) {
              setActivePhaseId(phaseId);
            }
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '-20% 0px -60% 0px', // Trigger when element is near top
        threshold: 0.1,
      }
    );

    observerRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [conversationDetail.phasesReached]);

  // Order phases as they appeared in the conversation
  // We use phasesReached to know order of activation
  const orderedPhases = conversationDetail.phasesReached.map(phaseId => {
    const phaseConfig = effectiveScript.phases.find(p => p.id === phaseId);
    return {
      id: phaseId,
      name: phaseConfig?.name || phaseId,
      config: phaseConfig
    };
  });

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card p-4 flex items-center justify-between shrink-0 h-16 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold truncate">
                {conversationDetail.prospectName || 'Unknown Prospect'}
              </h1>
              {conversationDetail.aiAnalysisResult && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Score: {overallScore}/100
                </Badge>
              )}
              {snapshotVersionDiffers && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Script v{effectiveScript.version} (attuale: v{scriptStructure.version})
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{new Date(conversationDetail.createdAt).toLocaleDateString()}</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full" />
              <span>{Math.floor(conversationDetail.totalDuration / 60)} min</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Vedi Script
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto" side="right">
              <SheetHeader className="mb-4">
                <SheetTitle>Script di Vendita</SheetTitle>
                <SheetDescription>Riferimento completo dello script v{effectiveScript.version}</SheetDescription>
              </SheetHeader>
              <ScriptReferencePanel
                scriptStructure={effectiveScript}
                conversationDetail={conversationDetail}
                selectedPhaseId={activePhaseId}
                onSelectPhase={scrollToPhase}
                currentScriptVersion={scriptStructure.version}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        
        {/* Left Panel: Visual Roadmap */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="flex flex-col border-r bg-muted/5 relative z-0">
          <div className="p-3 border-b bg-background/50 backdrop-blur text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 sticky top-0 z-10">
            <Target className="h-3 w-3" />
            Mappa Conversazione
          </div>
          <div className="flex-1 overflow-hidden relative">
             <VisualFlowRoadmap
                scriptStructure={effectiveScript}
                conversationDetail={conversationDetail}
                selectedPhaseId={activePhaseId}
                onSelectPhase={scrollToPhase}
              />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Panel: Storyline Timeline */}
        <ResizablePanel defaultSize={70}>
          <ScrollArea className="h-full bg-background" ref={scrollAreaRef}>
            <div className="p-8 max-w-5xl mx-auto space-y-12 pb-32">

              {/* 1. Executive Summary */}
              {conversationDetail.aiAnalysisResult && (
                <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                   <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold tracking-tight">Report Performance AI</h2>
                  </div>
                  <GeminiReportPanel conversationDetail={conversationDetail} />
                </section>
              )}

              {/* 1.5 Discovery REC - Mappa Cliente */}
              <section className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700" style={{ animationDelay: '100ms' }}>
                <DiscoveryRecPanel 
                  conversationId={conversationDetail.conversationId} 
                />
              </section>

              {/* 2. Chat Completa - Trascrizione Intera */}
              {conversationDetail.fullTranscript && conversationDetail.fullTranscript.length > 0 && (
                <section className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700" style={{ animationDelay: '150ms' }}>
                  <Card className="border-l-4 border-l-indigo-500/50 shadow-sm">
                    <CardHeader className="py-3 px-4 bg-indigo-50/30 dark:bg-indigo-950/20">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                        Chat Completa
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {conversationDetail.fullTranscript.length} messaggi
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3 text-sm max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {conversationDetail.fullTranscript.map((msg, idx) => (
                          <div key={idx} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                              msg.role === 'assistant' 
                                ? 'bg-indigo-500 text-white' 
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {msg.role === 'assistant' ? 'AI' : 'P'}
                            </div>
                            <div className="flex flex-col gap-1 max-w-[80%]">
                              <div className={`p-3 rounded-2xl text-pretty ${
                                msg.role === 'assistant' 
                                  ? 'bg-indigo-100/80 dark:bg-indigo-900/40 rounded-tr-sm' 
                                  : 'bg-muted/60 rounded-tl-sm'
                              }`}>
                                {msg.content}
                              </div>
                              <span className={`text-[10px] text-muted-foreground/60 ${msg.role === 'assistant' ? 'text-right' : 'text-left'}`}>
                                {msg.phase && <span className="font-medium">{orderedPhases.find(p => p.id === msg.phase)?.name || msg.phase}</span>}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              <Separator className="my-8" />

              {/* 3. Timeline Loop per Fase */}
              <div className="relative border-l-2 border-muted pl-8 space-y-16">
                {orderedPhases.map((phase, index) => {
                  const isLast = index === orderedPhases.length - 1;
                  
                  return (
                    <div 
                      key={phase.id} 
                      id={`phase-block-${phase.id}`}
                      data-phase-id={phase.id}
                      ref={(el) => {
                        if (el) observerRefs.current.set(phase.id, el);
                        else observerRefs.current.delete(phase.id);
                      }}
                      className="relative animate-in fade-in duration-500 slide-in-from-bottom-8"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Timeline Node */}
                      <div className={cn(
                        "absolute -left-[41px] top-0 h-5 w-5 rounded-full border-4 border-background flex items-center justify-center",
                        activePhaseId === phase.id ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/30"
                      )} />

                      {/* Phase Header */}
                      <div className="flex items-baseline gap-3 mb-6">
                         <span className="text-sm font-mono text-muted-foreground font-bold opacity-50">
                           {String(index + 1).padStart(2, '0')}
                         </span>
                         <h2 className={cn(
                           "text-2xl font-bold tracking-tight",
                           activePhaseId === phase.id ? "text-primary" : "text-foreground"
                         )}>
                           {phase.name}
                         </h2>
                      </div>

                      <div className="grid gap-6">
                        
                        {/* A. Transcript Block */}
                        <Card className="border-l-4 border-l-blue-500/50 shadow-sm">
                          <CardHeader className="py-3 px-4 bg-muted/30">
                            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                              <MessageSquare className="h-4 w-4" />
                              Scambio Verbale
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4 text-sm max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {conversationDetail.fullTranscript
                                .filter(msg => msg.phase === phase.id)
                                .length > 0 ? (
                                  conversationDetail.fullTranscript
                                    .filter(msg => msg.phase === phase.id)
                                    .map((msg, idx) => (
                                      <div key={idx} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                          msg.role === 'assistant' 
                                            ? 'bg-primary text-primary-foreground' 
                                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                          {msg.role === 'assistant' ? 'AI' : 'U'}
                                        </div>
                                        <div className={`p-3 rounded-2xl max-w-[85%] text-pretty ${
                                          msg.role === 'assistant' 
                                            ? 'bg-primary/10 rounded-tr-sm' 
                                            : 'bg-muted/60 rounded-tl-sm'
                                        }`}>
                                          {msg.content}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="text-center py-4 text-muted-foreground/60 text-xs italic">
                                    Nessuna trascrizione registrata per questa fase.
                                  </div>
                                )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* B. AI Reasoning & Checkpoints (Side by Side) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Reasoning */}
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              <Brain className="h-3 w-3" />
                              Logica AI
                            </div>
                            <AIReasoningPanel
                              scriptStructure={effectiveScript}
                              conversationDetail={conversationDetail}
                              selectedPhaseId={phase.id}
                            />
                          </div>

                          {/* Checkpoints */}
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              <Target className="h-3 w-3" />
                              Obiettivi
                            </div>
                            <CheckpointDetailPanel
                              scriptStructure={effectiveScript}
                              conversationDetail={conversationDetail}
                              selectedPhaseId={phase.id}
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {/* End of Timeline */}
                <div className="relative pt-8">
                   <div className="absolute -left-[41px] top-8 h-5 w-5 rounded-full bg-slate-900 border-4 border-background flex items-center justify-center dark:bg-slate-100" />
                   <div className="flex items-center gap-3">
                     <span className="text-sm font-mono text-muted-foreground font-bold opacity-50">END</span>
                     <h2 className="text-xl font-bold text-foreground">Fine Conversazione</h2>
                   </div>
                </div>

              </div>

            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
