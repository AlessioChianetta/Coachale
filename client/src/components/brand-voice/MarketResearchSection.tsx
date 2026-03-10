import { useState, useMemo } from "react";
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
  ArrowRightLeft,
  UserCircle,
  Flame,
  Shield,
  Eye,
  Lightbulb,
  Target,
  Trash2,
  Compass,
  Users,
  Building2,
} from "lucide-react";
import { type MarketResearchData } from "@shared/schema";

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
}: MarketResearchSectionProps) {
  const [expandedResearchPhases, setExpandedResearchPhases] = useState<Set<string>>(new Set());

  const toggleResearchPhase = (phase: string) => {
    setExpandedResearchPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phase)) newSet.delete(phase);
      else newSet.add(phase);
      return newSet;
    });
  };

  const updateResearchField = <K extends keyof MarketResearchData>(field: K, value: MarketResearchData[K]) => {
    onDataChange({ ...data, [field]: value });
  };

  const updateAvatarField = (field: keyof MarketResearchData["avatar"], value: string) => {
    onDataChange({
      ...data,
      avatar: { ...data.avatar, [field]: value },
    });
  };

  const updateMechanismField = (field: keyof MarketResearchData["uniqueMechanism"], value: string) => {
    onDataChange({
      ...data,
      uniqueMechanism: { ...data.uniqueMechanism, [field]: value },
    });
  };

  const researchCompletedPhases = useMemo(() => {
    const d = data;
    let count = 0;
    if (d.currentState.some(s => s.trim()) || d.idealState.some(s => s.trim())) count++;
    if (Object.values(d.avatar).some(v => v.trim())) count++;
    if (d.emotionalDrivers.length > 0) count++;
    if (d.existingSolutionProblems.some(s => s.trim()) || d.internalObjections.some(s => s.trim()) || d.externalObjections.some(s => s.trim())) count++;
    if (d.coreLies.length > 0 && d.coreLies.some(c => c.name.trim())) count++;
    if (d.uniqueMechanism.name.trim() || d.uniqueMechanism.description.trim()) count++;
    if (d.uvp.trim()) count++;
    return count;
  }, [data]);

  const handlePhaseButtonClick = (phase: string) => {
    if (onGeneratePhase) {
      const hasData = phaseHasData(phase);
      if (hasData) {
        onGeneratePhase(phase, 'overwrite');
      } else {
        onGeneratePhase(phase, 'add');
      }
    }
  };

  const phaseHasData = (phase: string): boolean => {
    switch (phase) {
      case "trasformazione":
        return data.currentState.some(s => s.trim()) || data.idealState.some(s => s.trim());
      case "avatar":
        return Object.values(data.avatar).some(v => v.trim());
      case "leve":
        return data.emotionalDrivers.length > 0;
      case "obiezioni":
        return data.existingSolutionProblems.some(s => s.trim()) || data.internalObjections.some(s => s.trim()) || data.externalObjections.some(s => s.trim());
      case "errore":
        return data.coreLies.length > 0 && data.coreLies.some(c => c.name.trim());
      case "meccanismo":
        return data.uniqueMechanism.name.trim() !== "" || data.uniqueMechanism.description.trim() !== "";
      case "posizionamento":
        return data.uvp.trim() !== "";
      default:
        return false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">
              L'AI analizza il tuo mercato cercando dati reali su Google, forum e recensioni. Compila almeno nicchia e target nello Step 1.
            </p>
            <div className="flex flex-wrap gap-2">
              {topic && (
                <Badge variant="secondary" className="text-xs"><Compass className="h-3 w-3 mr-1" />{topic.length > 30 ? topic.slice(0, 30) + "..." : topic}</Badge>
              )}
              {targetAudience && (
                <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-1" />{targetAudience.length > 30 ? targetAudience.slice(0, 30) + "..." : targetAudience}</Badge>
              )}
            </div>
            {researchCompletedPhases > 0 && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  {researchCompletedPhases}/7 fasi completate
                </Badge>
              </div>
            )}
          </div>
          {onGenerateFullResearch && (
            <Button
              onClick={onGenerateFullResearch}
              disabled={isGenerating || generatingPhase !== null}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 flex-shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isGenerating ? "Ricerca in corso..." : "Deep Research con AI"}
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("trasformazione")} className="w-full px-4 py-2.5 flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">1. Trasformazione</span>
            {(data.currentState.some(s => s.trim()) || data.idealState.some(s => s.trim())) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "trasformazione"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("trasformazione"); }}>
                {generatingPhase === "trasformazione" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("trasformazione") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("trasformazione") && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Stato Attuale (Problemi)</Label>
                {data.currentState.map((item, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Textarea placeholder="es. Perde clienti perché il menù è solo cartaceo..." value={item} onChange={(e) => { const updated = [...data.currentState]; updated[i] = e.target.value; updateResearchField("currentState", updated); }} rows={2} className="flex-1 resize-none text-sm" />
                    {data.currentState.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-0.5 text-muted-foreground hover:text-destructive" onClick={() => updateResearchField("currentState", data.currentState.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {data.currentState.length < 7 && (
                  <Button variant="ghost" size="sm" className="text-xs text-blue-500" onClick={() => updateResearchField("currentState", [...data.currentState, ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Stato Ideale (Risultati)</Label>
                {data.idealState.map((item, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Textarea placeholder="es. Riceve più ordini grazie al menù digitale..." value={item} onChange={(e) => { const updated = [...data.idealState]; updated[i] = e.target.value; updateResearchField("idealState", updated); }} rows={2} className="flex-1 resize-none text-sm" />
                    {data.idealState.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-0.5 text-muted-foreground hover:text-destructive" onClick={() => updateResearchField("idealState", data.idealState.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {data.idealState.length < 7 && (
                  <Button variant="ghost" size="sm" className="text-xs text-blue-500" onClick={() => updateResearchField("idealState", [...data.idealState, ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("avatar")} className="w-full px-4 py-2.5 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">2. Avatar del Cliente</span>
            {Object.values(data.avatar).some(v => v.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "avatar"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("avatar"); }}>
                {generatingPhase === "avatar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("avatar") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("avatar") && (
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
                <Textarea placeholder={placeholder} value={data.avatar[field]} onChange={(e) => updateAvatarField(field, e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("leve")} className="w-full px-4 py-2.5 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">3. Leve Motivazionali</span>
            {data.emotionalDrivers.length > 0 && (
              <Badge variant="outline" className="text-xs">{data.emotionalDrivers.length} selezionate</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "leve"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("leve"); }}>
                {generatingPhase === "leve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("leve") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("leve") && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">Seleziona le 2-3 forze emotive più potenti che guidano il tuo pubblico:</p>
            {EMOTIONAL_DRIVERS.map(({ key, label, desc }) => (
              <label key={key} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${data.emotionalDrivers.includes(key) ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "hover:bg-muted/50 border-transparent"}`}>
                <Checkbox checked={data.emotionalDrivers.includes(key)} onCheckedChange={(checked) => {
                  const drivers = checked ? [...data.emotionalDrivers, key] : data.emotionalDrivers.filter(d => d !== key);
                  updateResearchField("emotionalDrivers", drivers);
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

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("obiezioni")} className="w-full px-4 py-2.5 flex items-center justify-between bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">4. Obiezioni e Resistenze</span>
            {(data.existingSolutionProblems.some(s => s.trim()) || data.internalObjections.some(s => s.trim()) || data.externalObjections.some(s => s.trim())) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "obiezioni"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("obiezioni"); }}>
                {generatingPhase === "obiezioni" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("obiezioni") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("obiezioni") && (
          <div className="p-4 space-y-4">
            {[
              { field: "existingSolutionProblems" as const, label: "Problemi con soluzioni esistenti", desc: "Dove fallisce la concorrenza o il fai-da-te?", color: "text-orange-600 dark:text-orange-400" },
              { field: "internalObjections" as const, label: "Obiezioni interne (credenze limitanti)", desc: "Paure del cliente su sé stesso", color: "text-amber-600 dark:text-amber-400" },
              { field: "externalObjections" as const, label: "Obiezioni esterne", desc: "Dubbi su prodotto, prezzo, mercato", color: "text-yellow-600 dark:text-yellow-400" },
            ].map(({ field, label, desc, color }) => (
              <div key={field} className="space-y-2">
                <Label className={`text-xs font-semibold ${color} uppercase tracking-wide`}>{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {data[field].map((item: string, i: number) => (
                  <div key={i} className="flex gap-1.5">
                    <Input placeholder={`Obiezione ${i + 1}...`} value={item} onChange={(e) => { const updated = [...data[field]]; updated[i] = e.target.value; updateResearchField(field, updated); }} className="text-sm" />
                    {data[field].length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => updateResearchField(field, data[field].filter((_: string, idx: number) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                {data[field].length < 5 && (
                  <Button variant="ghost" size="sm" className="text-xs text-orange-500" onClick={() => updateResearchField(field, [...data[field], ""])}><span className="mr-1">+</span> Aggiungi</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("errore")} className="w-full px-4 py-2.5 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-medium">5. Errore Nascosto (Core Lie)</span>
            {data.coreLies.length > 0 && data.coreLies.some(c => c.name.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "errore"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("errore"); }}>
                {generatingPhase === "errore" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("errore") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("errore") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Falsa credenza che il mercato ha venduto al tuo cliente — il motivo nascosto per cui fallisce.</p>
            {data.coreLies.map((lie, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Input placeholder="Nome errore (es. 'Dipendenza dal contenuto gratuito')" value={lie.name} onChange={(e) => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], name: e.target.value }; updateResearchField("coreLies", updated); }} className="text-sm font-medium flex-1 mr-2" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => updateResearchField("coreLies", data.coreLies.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Textarea placeholder="Descrivi le conseguenze di questa credenza errata..." value={lie.problem} onChange={(e) => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], problem: e.target.value }; updateResearchField("coreLies", updated); }} rows={2} className="resize-none text-sm" />
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Button variant={lie.cureOrPrevent === 'C' ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs" onClick={() => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], cureOrPrevent: 'C' }; updateResearchField("coreLies", updated); }}>Cura</Button>
                    <Button variant={lie.cureOrPrevent === 'P' ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs" onClick={() => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], cureOrPrevent: 'P' }; updateResearchField("coreLies", updated); }}>Previene</Button>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={lie.isAware} onCheckedChange={(checked) => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], isAware: !!checked }; updateResearchField("coreLies", updated); }} />
                    <span className="text-muted-foreground">Consapevole</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Importanza:</span>
                    <Select value={lie.importance.toString()} onValueChange={(v) => { const updated = [...data.coreLies]; updated[i] = { ...updated[i], importance: parseInt(v) }; updateResearchField("coreLies", updated); }}>
                      <SelectTrigger className="h-6 w-14 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={n.toString()}>{n}/10</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            {data.coreLies.length < 5 && (
              <Button variant="ghost" size="sm" className="text-xs text-rose-500" onClick={() => updateResearchField("coreLies", [...data.coreLies, { name: "", problem: "", cureOrPrevent: 'C' as const, isAware: false, importance: 7 }])}><span className="mr-1">+</span> Aggiungi errore nascosto</Button>
            )}
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("meccanismo")} className="w-full px-4 py-2.5 flex items-center justify-between bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">6. Meccanismo Unico</span>
            {(data.uniqueMechanism.name.trim() || data.uniqueMechanism.description.trim()) && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "meccanismo"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("meccanismo"); }}>
                {generatingPhase === "meccanismo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("meccanismo") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("meccanismo") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">La tua metodologia proprietaria — il "COME" unico che ti differenzia. Non basta dire cosa fai, devi dire come lo fai in modo diverso.</p>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Nome del Meccanismo</Label>
              <Input placeholder='es. "Metodo 5D", "Protocollo 6X-Performance", "Sistema Crescita Rapida"' value={data.uniqueMechanism.name} onChange={(e) => updateMechanismField("name", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Descrizione</Label>
              <Textarea placeholder="Spiega brevemente il cuore del processo e perché funziona diversamente..." value={data.uniqueMechanism.description} onChange={(e) => updateMechanismField("description", e.target.value)} rows={3} className="resize-none text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div role="button" tabIndex={0} onClick={() => toggleResearchPhase("posizionamento")} className="w-full px-4 py-2.5 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">7. Posizionamento (UVP)</span>
            {data.uvp.trim() && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div className="flex items-center gap-1.5">
            {onGeneratePhase && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={generatingPhase === "posizionamento"} onClick={(e) => { e.stopPropagation(); handlePhaseButtonClick("posizionamento"); }}>
                {generatingPhase === "posizionamento" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              </Button>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedResearchPhases.has("posizionamento") ? "rotate-180" : ""}`} />
          </div>
        </div>
        {expandedResearchPhases.has("posizionamento") && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Formula: <span className="font-medium">Aiuto [CHI] a [FARE COSA — trasformazione] attraverso [COME — meccanismo unico]</span>
            </p>
            <Textarea placeholder='es. "Aiuto ristoratori a raddoppiare gli ordini in 90 giorni attraverso il Sistema Menu Digitale 360°"' value={data.uvp} onChange={(e) => updateResearchField("uvp", e.target.value)} rows={3} className="resize-none text-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
