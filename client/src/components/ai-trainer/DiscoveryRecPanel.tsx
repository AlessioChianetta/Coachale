import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Target,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface DiscoveryRec {
  motivazioneCall?: string;
  altroProvato?: string;
  tipoAttivita?: string;
  statoAttuale?: string;
  livelloFatturato?: string;
  problemi?: string[];
  statoIdeale?: string;
  urgenza?: string;
  decisionMaker?: boolean;
  budget?: string;
  obiezioniEmerse?: string[];
  noteAggiuntive?: string;
  generatedAt?: string;
}

interface DiscoveryRecPanelProps {
  conversationId: number;
  className?: string;
}

export function DiscoveryRecPanel({ conversationId, className = '' }: DiscoveryRecPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['discovery-rec', conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/ai-trainer/conversations/${conversationId}/discovery-rec`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch Discovery REC');
      }
      return response.json() as Promise<{
        conversationId: number;
        discoveryRec: DiscoveryRec | null;
        hasTranscript: boolean;
        createdAt: string;
      }>;
    },
    enabled: !!conversationId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/ai-trainer/conversations/${conversationId}/discovery-rec/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate REC');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-rec', conversationId] });
      toast({
        title: 'REC Generato',
        description: 'Il Discovery REC è stato generato con successo.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleExport = () => {
    if (!data?.discoveryRec) return;
    
    const rec = data.discoveryRec;
    const content = `DISCOVERY REC - Riepilogo Chiamata
========================================
Data generazione: ${rec.generatedAt ? new Date(rec.generatedAt).toLocaleDateString('it-IT') : 'N/A'}

MOTIVAZIONE CALL
${rec.motivazioneCall || 'Non specificato'}

TIPO ATTIVITÀ
${rec.tipoAttivita || 'Non specificato'}

STATO ATTUALE
${rec.statoAttuale || 'Non specificato'}

LIVELLO FATTURATO
${rec.livelloFatturato || 'Non specificato'}

PROBLEMI IDENTIFICATI
${rec.problemi?.length ? rec.problemi.map(p => `• ${p}`).join('\n') : 'Nessuno specificato'}

STATO IDEALE / OBIETTIVI
${rec.statoIdeale || 'Non specificato'}

URGENZA
${rec.urgenza || 'Non specificato'}

DECISION MAKER
${rec.decisionMaker === true ? 'Sì' : rec.decisionMaker === false ? 'No (altri coinvolti)' : 'Non discusso'}

BUDGET
${rec.budget || 'Non specificato'}

OBIEZIONI EMERSE
${rec.obiezioniEmerse?.length ? rec.obiezioniEmerse.map(o => `• ${o}`).join('\n') : 'Nessuna'}

ALTRO PROVATO
${rec.altroProvato || 'Non specificato'}

NOTE AGGIUNTIVE
${rec.noteAggiuntive || 'Nessuna'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovery-rec-${conversationId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Esportazione completata',
      description: 'Il file REC è stato scaricato.',
    });
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Caricamento REC...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardContent className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Errore nel caricamento del Discovery REC</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const rec = data?.discoveryRec;
  const hasTranscript = data?.hasTranscript;

  return (
    <Card className={`${className}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Discovery REC</CardTitle>
              {rec && (
                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                  Disponibile
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {rec && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-8"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Esporta
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                title={!hasTranscript ? 'La trascrizione potrebbe non essere disponibile' : ''}
                className="h-8"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                {rec ? 'Rigenera' : 'Genera'}
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!rec ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nessun REC disponibile</p>
                <p className="text-sm mt-1">
                  {hasTranscript 
                    ? 'Clicca "Genera" per creare il riepilogo della discovery'
                    : 'Trascrizione non disponibile per generare il REC'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rec.generatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Generato il {new Date(rec.generatedAt).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RecField
                    icon={<Target className="h-4 w-4 text-purple-500" />}
                    label="Motivazione Call"
                    value={rec.motivazioneCall}
                  />
                  <RecField
                    icon={<Building className="h-4 w-4 text-blue-500" />}
                    label="Tipo Attività"
                    value={rec.tipoAttivita}
                  />
                  <RecField
                    icon={<DollarSign className="h-4 w-4 text-green-500" />}
                    label="Fatturato"
                    value={rec.livelloFatturato}
                  />
                  <RecField
                    icon={<User className="h-4 w-4 text-orange-500" />}
                    label="Decision Maker"
                    value={
                      rec.decisionMaker === true 
                        ? 'Sì - È lui a decidere' 
                        : rec.decisionMaker === false 
                          ? 'No - Altri coinvolti' 
                          : undefined
                    }
                    valueClassName={rec.decisionMaker === true ? 'text-green-600' : rec.decisionMaker === false ? 'text-orange-600' : ''}
                  />
                </div>

                <RecField
                  icon={<MessageSquare className="h-4 w-4 text-gray-500" />}
                  label="Stato Attuale"
                  value={rec.statoAttuale}
                  fullWidth
                />

                {rec.problemi && rec.problemi.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Problemi Identificati
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rec.problemi.map((problema, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                          {problema}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <RecField
                  icon={<Sparkles className="h-4 w-4 text-yellow-500" />}
                  label="Stato Ideale / Obiettivi"
                  value={rec.statoIdeale}
                  fullWidth
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RecField
                    icon={<Clock className="h-4 w-4 text-amber-500" />}
                    label="Urgenza"
                    value={rec.urgenza}
                    valueClassName={
                      rec.urgenza?.includes('10') || rec.urgenza?.toLowerCase().includes('alta') 
                        ? 'text-red-600 font-semibold' 
                        : ''
                    }
                  />
                  <RecField
                    icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                    label="Budget"
                    value={rec.budget}
                  />
                </div>

                {rec.obiezioniEmerse && rec.obiezioniEmerse.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <XCircle className="h-4 w-4 text-orange-500" />
                      Obiezioni Emerse
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rec.obiezioniEmerse.map((obiezione, idx) => (
                        <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          {obiezione}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {rec.altroProvato && (
                  <RecField
                    icon={<CheckCircle className="h-4 w-4 text-gray-500" />}
                    label="Altro Provato"
                    value={rec.altroProvato}
                    fullWidth
                  />
                )}

                {rec.noteAggiuntive && (
                  <RecField
                    icon={<FileText className="h-4 w-4 text-gray-500" />}
                    label="Note Aggiuntive"
                    value={rec.noteAggiuntive}
                    fullWidth
                  />
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface RecFieldProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  fullWidth?: boolean;
  valueClassName?: string;
}

function RecField({ icon, label, value, fullWidth = false, valueClassName = '' }: RecFieldProps) {
  if (!value) return null;
  
  return (
    <div className={`space-y-1 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-sm pl-6 ${valueClassName}`}>{value}</p>
    </div>
  );
}
