import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScriptReferencePanel } from './ScriptReferencePanel';
import { VisualFlowRoadmap } from './VisualFlowRoadmap';
import { AIReasoningPanel } from './AIReasoningPanel';
import { CheckpointDetailPanel } from './CheckpointDetailPanel';
import { GeminiReportPanel } from './GeminiReportPanel';

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
    score: number;
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
 
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(
    conversationDetail.currentPhase
  );

  const effectiveScript = conversationDetail.scriptSnapshot || scriptStructure;

  console.log('[TrainingMapLayout] Rendering with:', {
    hasConversationDetail: !!conversationDetail,
    hasScriptStructure: !!scriptStructure,
    hasScriptSnapshot: !!conversationDetail.scriptSnapshot,
    usingSnapshot: !!conversationDetail.scriptSnapshot,
    effectiveScriptVersion: effectiveScript.version,
    selectedPhaseId
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b bg-card p-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              🧠 Sales Training Map - {conversationDetail.prospectName || 'Unknown Prospect'}
            </h1>
            {conversationDetail.aiAnalysisResult && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">
                <Sparkles className="h-3 w-3 mr-1" />
                Analisi AI Disponibile
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Conversazione #{conversationDetail.conversationId.substring(0, 8)} • Script v{scriptStructure.version}
          </p>
        </div>
      </div>

      <Tabs defaultValue="journey" className="flex-1 flex flex-col">
        <div className="border-b bg-card px-4 pt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="script" className="text-sm">
              📜 Sales Script
            </TabsTrigger>
            <TabsTrigger value="journey" className="text-sm">
              🗺️ Conversation Journey
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-sm">
              🧠 AI Analysis
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="script" className="flex-1 m-0 overflow-hidden">
          <ScriptReferencePanel
            scriptStructure={effectiveScript}
            conversationDetail={conversationDetail}
            selectedPhaseId={selectedPhaseId}
            onSelectPhase={setSelectedPhaseId}
          />
        </TabsContent>
        
        <TabsContent value="journey" className="flex-1 m-0 overflow-hidden">
          <VisualFlowRoadmap
            scriptStructure={effectiveScript}
            conversationDetail={conversationDetail}
            selectedPhaseId={selectedPhaseId}
            onSelectPhase={setSelectedPhaseId}
          />
        </TabsContent>
        
        <TabsContent value="analysis" className="flex-1 m-0 overflow-hidden">
          <Tabs defaultValue="reasoning" className="h-full flex flex-col">
            <div className="border-b bg-card px-4 pt-2">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="reasoning" className="text-xs">
                  🧠 AI Reasoning
                </TabsTrigger>
                <TabsTrigger value="checkpoints" className="text-xs">
                  🎯 Checkpoints
                </TabsTrigger>
                <TabsTrigger value="gemini" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Gemini Report
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="reasoning" className="flex-1 m-0 overflow-hidden">
              <AIReasoningPanel
                scriptStructure={effectiveScript}
                conversationDetail={conversationDetail}
                selectedPhaseId={selectedPhaseId}
              />
            </TabsContent>
            
            <TabsContent value="checkpoints" className="flex-1 m-0 overflow-hidden">
              <CheckpointDetailPanel
                scriptStructure={effectiveScript}
                conversationDetail={conversationDetail}
                selectedPhaseId={selectedPhaseId}
              />
            </TabsContent>
            
            <TabsContent value="gemini" className="flex-1 m-0 overflow-hidden">
              <GeminiReportPanel conversationDetail={conversationDetail} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
