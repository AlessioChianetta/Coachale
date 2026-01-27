import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  Calendar,
  Clock,
  CheckCircle,
  Settings,
  Instagram,
  Twitter,
  Linkedin,
  Loader2,
  AlertCircle,
  CalendarOff,
  Zap,
  Sparkles,
  BookOpen,
  Megaphone,
  Camera,
  Users,
  Play,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

const ITALIAN_HOLIDAYS = [
  "2024-01-01", "2024-01-06", "2024-03-31", "2024-04-01", "2024-04-25", "2024-05-01", "2024-06-02", "2024-08-15", "2024-11-01", "2024-12-08", "2024-12-25", "2024-12-26",
  "2025-01-01", "2025-01-06", "2025-04-20", "2025-04-21", "2025-04-25", "2025-05-01", "2025-06-02", "2025-08-15", "2025-11-01", "2025-12-08", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-01-06", "2026-04-05", "2026-04-06", "2026-04-25", "2026-05-01", "2026-06-02", "2026-08-15", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26",
];

const OPTIMAL_TIMES = {
  instagram: ["11:00", "14:00", "19:00"],
  x: ["09:00", "12:00", "17:00"],
  linkedin: ["08:00", "12:00", "17:30"],
};

const CONTENT_TYPES = [
  { id: "educativo", label: "Educativo", icon: BookOpen, description: "Contenuti formativi e informativi" },
  { id: "promozionale", label: "Promozionale", icon: Megaphone, description: "Offerte e promozioni" },
  { id: "storytelling", label: "Storytelling", icon: Camera, description: "Storie e narrazioni" },
  { id: "behind-the-scenes", label: "Behind the Scenes", icon: Users, description: "Dietro le quinte" },
];

const PLATFORM_CONFIG = {
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  x: { label: "X (Twitter)", icon: Twitter, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-600", bgColor: "bg-blue-600/10" },
};

interface AutopilotPanelProps {
  targetPlatform: "instagram" | "x" | "linkedin";
  postCategory: "ads" | "valore" | "altri";
  postSchema: string;
  writingStyle: string;
  customInstructions?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
}

interface GenerationProgress {
  total: number;
  completed: number;
  currentDate: string;
  currentPlatform: string;
  status: string;
}

interface GenerationResult {
  success: boolean;
  generated: number;
  errors: string[];
}

function AutopilotPanel({
  targetPlatform,
  postCategory,
  postSchema,
  writingStyle,
  customInstructions,
}: AutopilotPanelProps) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [mode, setMode] = useState<"automatica" | "controllata">("automatica");
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(["educativo"]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["autopilot-templates"],
    queryFn: async () => {
      const response = await fetch("/api/content/autopilot/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const json = await response.json();
      return json.data || [];
    },
  });

  const toggleContentType = (typeId: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
  };

  const calculation = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalDays: 0, totalPosts: 0, excludedDays: [], validDays: 0 };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const excludedDays: { date: string; reason: string }[] = [];
    let validDays = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = ITALIAN_HOLIDAYS.includes(dateStr);

      let excluded = false;
      let reasons: string[] = [];

      if (excludeWeekends && isWeekend) {
        excluded = true;
        reasons.push(dayOfWeek === 0 ? "Domenica" : "Sabato");
      }
      if (excludeHolidays && isHoliday) {
        excluded = true;
        reasons.push("Festività");
      }

      if (excluded) {
        excludedDays.push({ date: dateStr, reason: reasons.join(", ") });
      } else {
        validDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    const totalPosts = validDays * postsPerDay;

    return { totalDays, totalPosts, excludedDays, validDays };
  }, [startDate, endDate, excludeWeekends, excludeHolidays, postsPerDay]);

  const canGenerate =
    startDate &&
    endDate &&
    calculation.totalPosts > 0 &&
    selectedContentTypes.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setProgress(null);
    setGenerationResult(null);

    let finalResult: GenerationResult | null = null;

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/content/autopilot/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate,
          endDate,
          targetPlatform,
          postCategory,
          postSchema,
          writingStyle,
          customInstructions,
          templateId: selectedTemplate !== "none" ? selectedTemplate : undefined,
          excludeWeekends,
          excludeHolidays,
          postsPerDay,
          mode,
          contentTypes: selectedContentTypes,
          optimalTimes: OPTIMAL_TIMES[targetPlatform],
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nell'avvio della generazione");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Risposta non valida");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace("data: ", ""));

            if (data.type === "complete") {
              finalResult = {
                success: data.success,
                generated: data.generated,
                errors: data.errors || [],
              };
              setGenerationResult(finalResult);
            } else if (data.type === "error") {
              throw new Error(data.error);
            } else {
              setProgress(data);
            }
          } catch (e) {}
        }
      }

      toast({
        title: "Generazione completata!",
        description: `${finalResult?.generated || 0} post generati con successo.`,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const platformConfig = PLATFORM_CONFIG[targetPlatform];
  const PlatformIcon = platformConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 border-dashed border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                Autopilot
                <Badge variant="secondary" className="text-xs">
                  <PlatformIcon className={`h-3 w-3 mr-1 ${platformConfig.color}`} />
                  {platformConfig.label}
                </Badge>
              </CardTitle>
              <CardDescription>
                Genera contenuti in batch per il periodo selezionato
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="autopilot-start" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data Inizio
              </Label>
              <Input
                id="autopilot-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="autopilot-end" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data Fine
              </Label>
              <Input
                id="autopilot-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Template Preset
            </Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un template (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun template</SelectItem>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4" />
              Esclusioni
            </Label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="exclude-weekends"
                  checked={excludeWeekends}
                  onCheckedChange={setExcludeWeekends}
                />
                <Label htmlFor="exclude-weekends" className="text-sm cursor-pointer">
                  Escludi weekend
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="exclude-holidays"
                  checked={excludeHolidays}
                  onCheckedChange={setExcludeHolidays}
                />
                <Label htmlFor="exclude-holidays" className="text-sm cursor-pointer">
                  Escludi festività italiane
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Frequenza Post/Giorno
            </Label>
            <Select
              value={postsPerDay.toString()}
              onValueChange={(v) => setPostsPerDay(parseInt(v))}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} post/giorno
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Modalità Generazione
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "automatica" | "controllata")}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatica">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Automatica (genera e pubblica)
                  </div>
                </SelectItem>
                <SelectItem value="controllata">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Controllata (genera come bozze)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Tipi Contenuto da Ruotare
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map((type) => {
                const TypeIcon = type.icon;
                const isSelected = selectedContentTypes.includes(type.id);
                return (
                  <motion.div
                    key={type.id}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleContentType(type.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleContentType(type.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TypeIcon className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-violet-600" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium truncate">{type.label}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {calculation.totalDays > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-violet-600" />
                  <span className="font-semibold">Preview Calcolo</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xl font-bold text-violet-600">{calculation.totalDays}</p>
                    <p className="text-xs text-muted-foreground">Giorni Totali</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{calculation.validDays}</p>
                    <p className="text-xs text-muted-foreground">Giorni Validi</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xl font-bold text-indigo-600">{calculation.totalPosts}</p>
                    <p className="text-xs text-muted-foreground">Post Totali</p>
                  </div>
                </div>

                {calculation.excludedDays.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Giorni esclusi ({calculation.excludedDays.length}):
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {calculation.excludedDays.slice(0, 10).map((day) => (
                        <Badge key={day.date} variant="outline" className="text-xs">
                          {new Date(day.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                          <span className="text-muted-foreground ml-1">({day.reason})</span>
                        </Badge>
                      ))}
                      {calculation.excludedDays.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{calculation.excludedDays.length - 10} altri
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Orari ottimali:</span>{" "}
                  {OPTIMAL_TIMES[targetPlatform].join(", ")}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white"
            size="lg"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5 mr-2" />
            )}
            {isGenerating ? "Generazione in corso..." : "Genera Autopilot"}
          </Button>

          <AnimatePresence>
            {isGenerating && progress && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-muted rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Generazione in corso...</span>
                  <span className="text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <Progress
                  value={(progress.completed / progress.total) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {progress.currentPlatform} - {progress.currentDate}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {generationResult && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-lg ${
                  generationResult.success
                    ? "bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {generationResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {generationResult.success
                      ? `${generationResult.generated} post generati con successo!`
                      : "Generazione completata con errori"}
                  </span>
                </div>
                {generationResult.errors.length > 0 && (
                  <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                    {generationResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AutopilotPanel;
