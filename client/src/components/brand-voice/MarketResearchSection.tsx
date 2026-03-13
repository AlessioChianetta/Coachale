import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ChevronDown,
  CheckCircle,
  Loader2,
  Wand2,
  Trash2,
  ArrowRightLeft,
  UserCircle,
  Flame,
  Shield,
  Eye,
  Lightbulb,
  Target,
  Compass,
  Users,
  Building2,
} from "lucide-react";
import { type MarketResearchData, EMPTY_MARKET_RESEARCH } from "@shared/schema";

export const EMOTIONAL_DRIVERS = [
  { key: "sopravvivenza", label: "Sopravvivenza e Longevità", desc: "Prolungare la carriera, garantire la salute a lungo termine" },
  { key: "piacere", label: "Godersi la Vita", desc: "Vivere senza dolori, godersi la routine quotidiana" },
  { key: "fuga_dolore", label: "Libertà da Paure e Frustrazioni", desc: "Eliminare stress, paura e frustrazione di non raggiungere obiettivi" },
  { key: "sessualita", label: "Compagnia / Aspetto Fisico", desc: "Migliorare l'attrattiva fisica e l'energia" },
  { key: "status", label: "Essere Superiore / Vincere", desc: "Aumentare la performance, ottenere riconoscimento e supremazia" },
  { key: "protezione", label: "Cura e Protezione dei Cari", desc: "Avere salute/energia per sostenere o ispirare la famiglia" },
  { key: "approvazione", label: "Approvazione Sociale / Status", desc: "Essere rispettato dalla comunità, guadagnare status" },
  { key: "comfort", label: "Ricerca di Comfort e Sicurezza", desc: "Sicurezza finanziaria, stabilità e tranquillità" },
];

export interface MarketResearchSectionProps {
  data: MarketResearchData;
  onDataChange: (data: MarketResearchData) => void;
  isGenerating?: boolean;
  generatingPhase?: string | null;
  onGenerateFullResearch?: () => void;
  onGeneratePhase?: (phase: string, mode: 'add' | 'overwrite') => void;
  topic?: string;
  targetAudience?: string;
  compact?: boolean;
  researchCompletedPhases?: number;
  useBrandVoice?: boolean;
  brandVoiceActive?: boolean;
}

export function MarketResearchSection({
  data,
  onDataChange,
  isGenerating = false,
  generatingPhase = null,
  onGenerateFullResearch,
  onGeneratePhase,
  topic,
  targetAudience,
  compact = false,
  researchCompletedPhases: externalCompletedPhases,
  useBrandVoice = false,
  brandVoiceActive = false,
}: MarketResearchSectionProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const safeData = useMemo<MarketResearchData>(() => ({
    ...EMPTY_MARKET_RESEARCH,
    ...data,
    avatar: { ...EMPTY_MARKET_RESEARCH.avatar, ...(data?.avatar || {}) },
    uniqueMechanism: { ...EMPTY_MARKET_RESEARCH.uniqueMechanism, ...(data?.uniqueMechanism || {}) },
    currentState: data?.currentState || EMPTY_MARKET_RESEARCH.currentState,
    idealState: data?.idealState || EMPTY_MARKET_RESEARCH.idealState,
    emotionalDrivers: data?.emotionalDrivers || EMPTY_MARKET_RESEARCH.emotionalDrivers,
    existingSolutionProblems: data?.existingSolutionProblems || EMPTY_MARKET_RESEARCH.existingSolutionProblems,
    internalObjections: data?.internalObjections || EMPTY_MARKET_RESEARCH.internalObjections,
    externalObjections: data?.externalObjections || EMPTY_MARKET_RESEARCH.externalObjections,
    coreLies: data?.coreLies || EMPTY_MARKET_RESEARCH.coreLies,
    uvp: data?.uvp || EMPTY_MARKET_RESEARCH.uvp,
  }), [data]);

  const togglePhase = useCallback((phase: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phase)) newSet.delete(phase);
      else newSet.add(phase);
      return newSet;
    });
  }, []);

  const updateField = useCallback(<K extends keyof MarketResearchData>(field: K, value: MarketResearchData[K]) => {
    onDataChange({ ...safeData, [field]: value });
  }, [safeData, onDataChange]);

  const updateAvatarField = useCallback((field: keyof MarketResearchData["avatar"], value: string) => {
    onDataChange({
      ...safeData,
      avatar: { ...safeData.avatar, [field]: value },
    });
  }, [safeData, onDataChange]);

  const updateMechanismField = useCallback((field: keyof MarketResearchData["uniqueMechanism"], value: string) => {
    onDataChange({
      ...safeData,
      uniqueMechanism: { ...safeData.uniqueMechanism, [field]: value },
    });
  }, [safeData, onDataChange]);

  const completedPhases = useMemo(() => {
    if (externalCompletedPhases !== undefined) return externalCompletedPhases;
    const d = safeData;
    let count = 0;
    if ((d.currentState || []).some(s => s.trim()) || (d.idealState || []).some(s => s.trim())) count++;
    if (d.avatar && Object.values(d.avatar).some(v => typeof v === 'string' && v.trim())) count++;
    if ((d.emotionalDrivers || []).length > 0) count++;
    if ((d.existingSolutionProblems || []).some(s => s.trim()) || (d.internalObjections || []).some(s => s.trim()) || (d.externalObjections || []).some(s => s.trim())) count++;
    if ((d.coreLies || []).length > 0 && (d.coreLies || []).some(c => c.name?.trim())) count++;
    if (d.uniqueMechanism && (d.uniqueMechanism.name?.trim() || d.uniqueMechanism.description?.trim())) count++;
    if ((d.uvp || '').trim()) count++;
    return count;
  }, [safeData, externalCompletedPhases]);

  const phaseHasData = useCallback((phase: string): boolean => {
    const d = safeData;
    switch (phase) {
      case 'trasformazione': return (d.currentState?.some(s => s.trim()) || d.idealState?.some(s => s.trim())) || false;
      case 'avatar': return !!(d.avatar?.nightThought || d.avatar?.biggestFear || d.avatar?.dailyFrustration);
      case 'leve': return (d.emotionalDrivers?.length > 0 || d.existingSolutionProblems?.some(s => s.trim())) || false;
      case 'obiezioni': return (d.internalObjections?.some(s => s.trim()) || d.externalObjections?.some(s => s.trim())) || false;
      case 'errore': return (d.coreLies?.length > 0) || false;
      case 'meccanismo': return !!(d.uniqueMechanism?.name || d.uniqueMechanism?.description);
      case 'posizionamento': return !!d.uvp;
      default: return false;
    }
  }, [safeData]);

  const handlePhaseClick = useCallback((phase: string) => {
    if (!onGeneratePhase) return;
    if (phaseHasData(phase)) {
      onGeneratePhase(phase, 'add');
    } else {
      onGeneratePhase(phase, 'overwrite');
    }
  }, [onGeneratePhase, phaseHasData]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">
              L'AI analizza il tuo mercato cercando dati reali su Google, forum e recensioni. Compila almeno nicchia e target.
            </p>
            <div className="flex flex-wrap gap-2">
              {topic && (
                <Badge variant="secondary" className="text-xs"><Compass className="h-3 w-3 mr-1" />{topic.length > 30 ? topic.slice(0, 30) + "..." : topic}</Badge>
              )}
              {targetAudience && (
                <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-1" />{targetAudience.length > 30 ? targetAudience.slice(0, 30) + "..." : targetAudience}</Badge>
              )}
              {useBrandVoice && brandVoiceActive && (
                <Badge variant="secondary" className="text-xs"><Building2 className="h-3 w-3 mr-1" />Brand Voice attivo</Badge>
              )}
            </div>
          </div>
          {onGenerateFullResearch && (
            <Button
              onClick={onGenerateFullResearch}
              disabled={isGenerating || generatingPhase !== null || (!topic && !targetAudience && !(useBrandVoice && brandVoiceActive))}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 flex-shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isGenerating ? "Ricerca in corso..." : "Genera Ricerca di Mercato"}
            </Button>
          )}
        </div>
      </div>

      {/* Phase 1: Trasformazione */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("trasformazione")} className="w-full px-4 py-2.5 flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">1. Trasformazione</span>
            {(safeData.currentState.some(s => s.trim()) || safeData.idealState.some(s => s.trim())) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "trasformazione"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("trasformazione"); }}>
                {generatingPhase === "trasformazione" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("trasformazione") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("trasformazione") && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Stato Attuale (Problemi)</Label>
                {safeData.currentState.map((item, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Textarea placeholder="es. Perde clienti perché il menù è solo cartaceo..." value={item} onChange={(e) => { const updated = [...safeData.currentState]; updated[i] = e.target.value; updateField("currentState", updated); }} rows={2} className="flex-1 resize-none text-sm" />
                    {safeData.currentState.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-0.5 text-muted-foreground hover:text-destructive" onClick={() => updateField("currentState", safeData.currentState.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {safeData.currentState.length < 7 && (
                  <Button variant="ghost" size="sm" className="text-xs text-blue-500" onClick={() => updateField("currentState", [...safeData.currentState, ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Stato Ideale (Risultati)</Label>
                {safeData.idealState.map((item, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Textarea placeholder="es. Riceve più ordini grazie al menù digitale..." value={item} onChange={(e) => { const updated = [...safeData.idealState]; updated[i] = e.target.value; updateField("idealState", updated); }} rows={2} className="flex-1 resize-none text-sm" />
                    {safeData.idealState.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-0.5 text-muted-foreground hover:text-destructive" onClick={() => updateField("idealState", safeData.idealState.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {safeData.idealState.length < 7 && (
                  <Button variant="ghost" size="sm" className="text-xs text-blue-500" onClick={() => updateField("idealState", [...safeData.idealState, ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 2: Avatar del Cliente */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("avatar")} className="w-full px-4 py-2.5 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">2. Avatar del Cliente</span>
            {Object.values(safeData.avatar).some(v => v.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "avatar"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("avatar"); }}>
                {generatingPhase === "avatar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("avatar") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("avatar") && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { field: "nightThought" as const, label: "Pensiero alle 3 di notte", placeholder: "Cosa lo tormenta quando non riesce a dormire?" },
              { field: "biggestFear" as const, label: "Paura più grande", placeholder: "Qual è la sua paura più profonda?" },
              { field: "dailyFrustration" as const, label: "Frustrazione quotidiana", placeholder: "Cosa lo fa arrabbiare o frustrare ogni giorno?" },
              { field: "deepestDesire" as const, label: "Desiderio più profondo", placeholder: "Qual è il suo sogno o obiettivo nascosto?" },
              { field: "currentSituation" as const, label: "Situazione attuale", placeholder: "Come vive la sua situazione oggi?" },
              { field: "decisionStyle" as const, label: "Stile decisionale", placeholder: "Di impulso, con analisi, per fiducia...?" },
              { field: "languageUsed" as const, label: "Linguaggio usato", placeholder: "Parole o frasi che usa per descrivere i suoi problemi" },
              { field: "influencers" as const, label: "Influenze", placeholder: "Chi lo influenza già (brand, persone, media)?" },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Textarea placeholder={placeholder} value={safeData.avatar[field]} onChange={(e) => updateAvatarField(field, e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 3: Leve Motivazionali */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("leve")} className="w-full px-4 py-2.5 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">3. Leve Motivazionali</span>
            {safeData.emotionalDrivers.length > 0 && (
              <Badge variant="outline" className="text-xs">{safeData.emotionalDrivers.length} selezionate</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "leve"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("leve"); }}>
                {generatingPhase === "leve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("leve") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("leve") && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">Seleziona le 2-3 forze emotive più potenti che guidano il tuo pubblico:</p>
            {EMOTIONAL_DRIVERS.map(({ key, label, desc }) => (
              <label key={key} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${safeData.emotionalDrivers.includes(key) ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "hover:bg-muted/50 border-transparent"}`}>
                <Checkbox checked={safeData.emotionalDrivers.includes(key)} onCheckedChange={(checked) => {
                  const drivers = checked ? [...safeData.emotionalDrivers, key] : safeData.emotionalDrivers.filter(d => d !== key);
                  updateField("emotionalDrivers", drivers);
                }} className="mt-0.5" />
                <div>
                  <span className="text-sm font-medium">{label}</span>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Phase 4: Obiezioni e Resistenze */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("obiezioni")} className="w-full px-4 py-2.5 flex items-center justify-between bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">4. Obiezioni e Resistenze</span>
            {(safeData.existingSolutionProblems.some(s => s.trim()) || safeData.internalObjections.some(s => s.trim()) || safeData.externalObjections.some(s => s.trim())) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "obiezioni"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("obiezioni"); }}>
                {generatingPhase === "obiezioni" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("obiezioni") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("obiezioni") && (
          <div className="p-4 space-y-4">
            {[
              { field: "existingSolutionProblems" as const, label: "Problemi con soluzioni esistenti", desc: "Dove fallisce la concorrenza o il fai-da-te?", color: "text-orange-600 dark:text-orange-400" },
              { field: "internalObjections" as const, label: "Obiezioni interne (credenze limitanti)", desc: "Paure del cliente su sé stesso", color: "text-amber-600 dark:text-amber-400" },
              { field: "externalObjections" as const, label: "Obiezioni esterne", desc: "Dubbi su prodotto, prezzo, mercato", color: "text-yellow-600 dark:text-yellow-400" },
            ].map(({ field, label, desc, color }) => (
              <div key={field} className="space-y-2">
                <Label className={`text-xs font-semibold ${color} uppercase tracking-wide`}>{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {(safeData[field] as string[]).map((item: string, i: number) => (
                  <div key={i} className="flex gap-1.5">
                    <Input placeholder={`Obiezione ${i + 1}...`} value={item} onChange={(e) => { const updated = [...(safeData[field] as string[])]; updated[i] = e.target.value; updateField(field, updated); }} className="text-sm" />
                    {(safeData[field] as string[]).length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateField(field, (safeData[field] as string[]).filter((_: string, idx: number) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {(safeData[field] as string[]).length < 5 && (
                  <Button variant="ghost" size="sm" className="text-xs text-orange-500" onClick={() => updateField(field, [...(safeData[field] as string[]), ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 5: Errore Nascosto (Core Lie) */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("errore")} className="w-full px-4 py-2.5 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-medium">5. Errore Nascosto (Core Lie)</span>
            {safeData.coreLies.length > 0 && safeData.coreLies.some(c => c.name.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "errore"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("errore"); }}>
                {generatingPhase === "errore" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("errore") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("errore") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Falsa credenza che il mercato ha venduto al tuo cliente — il motivo nascosto per cui fallisce.</p>
            {safeData.coreLies.map((lie, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Input placeholder="Nome errore (es. 'Dipendenza dal contenuto gratuito')" value={lie.name} onChange={(e) => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], name: e.target.value }; updateField("coreLies", updated); }} className="text-sm font-medium flex-1 mr-2" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => updateField("coreLies", safeData.coreLies.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Textarea placeholder="Descrivi le conseguenze di questa credenza errata..." value={lie.problem} onChange={(e) => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], problem: e.target.value }; updateField("coreLies", updated); }} rows={2} className="resize-none text-sm" />
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Button variant={lie.cureOrPrevent === 'C' ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs" onClick={() => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], cureOrPrevent: 'C' }; updateField("coreLies", updated); }}>Cura</Button>
                    <Button variant={lie.cureOrPrevent === 'P' ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs" onClick={() => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], cureOrPrevent: 'P' }; updateField("coreLies", updated); }}>Previene</Button>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={lie.isAware} onCheckedChange={(checked) => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], isAware: !!checked }; updateField("coreLies", updated); }} />
                    <span className="text-muted-foreground">Consapevole</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Importanza:</span>
                    <Select value={lie.importance.toString()} onValueChange={(v) => { const updated = [...safeData.coreLies]; updated[i] = { ...updated[i], importance: parseInt(v) }; updateField("coreLies", updated); }}>
                      <SelectTrigger className="h-6 w-14 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={n.toString()}>{n}/10</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            {safeData.coreLies.length < 5 && (
              <Button variant="ghost" size="sm" className="text-xs text-rose-500" onClick={() => updateField("coreLies", [...safeData.coreLies, { name: "", problem: "", cureOrPrevent: 'C' as const, isAware: false, importance: 7 }])}><span className="mr-1">+</span> Aggiungi errore nascosto</Button>
            )}
          </div>
        )}
      </div>

      {/* Phase 6: Meccanismo Unico */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("meccanismo")} className="w-full px-4 py-2.5 flex items-center justify-between bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">6. Meccanismo Unico</span>
            {(safeData.uniqueMechanism.name.trim() || safeData.uniqueMechanism.description.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "meccanismo"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("meccanismo"); }}>
                {generatingPhase === "meccanismo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("meccanismo") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("meccanismo") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">La tua metodologia proprietaria — il "COME" unico che ti differenzia. Non basta dire cosa fai, devi dire come lo fai in modo diverso.</p>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Nome del Meccanismo</Label>
              <Input placeholder='es. "Metodo 5D", "Protocollo 6X-Performance", "Sistema Crescita Rapida"' value={safeData.uniqueMechanism.name} onChange={(e) => updateMechanismField("name", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Descrizione</Label>
              <Textarea placeholder="Spiega brevemente il cuore del processo e perché funziona diversamente..." value={safeData.uniqueMechanism.description} onChange={(e) => updateMechanismField("description", e.target.value)} rows={3} className="resize-none text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Phase 7: Posizionamento (UVP) */}
      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => togglePhase("posizionamento")} className="w-full px-4 py-2.5 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">7. Posizionamento (UVP)</span>
            {safeData.uvp.trim() && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "posizionamento"} onClick={(e) => { e.stopPropagation(); handlePhaseClick("posizionamento"); }}>
                {generatingPhase === "posizionamento" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPhases.has("posizionamento") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedPhases.has("posizionamento") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Formula: <span className="font-medium">Aiuto [CHI] a [FARE COSA — trasformazione] attraverso [COME — meccanismo unico]</span>
            </p>
            <Textarea placeholder='es. "Aiuto ristoratori a raddoppiare gli ordini in 90 giorni attraverso il Sistema Menu Digitale 360°"' value={safeData.uvp} onChange={(e) => updateField("uvp", e.target.value)} rows={3} className="resize-none text-sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketResearchSection;
