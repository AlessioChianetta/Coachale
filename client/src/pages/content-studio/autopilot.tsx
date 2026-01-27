import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  Instagram,
  Calendar,
  Zap,
  Settings,
  Twitter,
  Linkedin,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface PlatformConfig {
  enabled: boolean;
  postsPerDay: number;
}

interface PlatformConfigs {
  instagram: PlatformConfig;
  twitter: PlatformConfig;
  linkedin: PlatformConfig;
}

export default function ContentStudioAutopilot() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    completed: number;
    currentDate: string;
    currentPlatform: string;
    status: string;
  } | null>(null);
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    generated: number;
    errors: string[];
  } | null>(null);
  const [platforms, setPlatforms] = useState<PlatformConfigs>({
    instagram: { enabled: false, postsPerDay: 1 },
    twitter: { enabled: false, postsPerDay: 1 },
    linkedin: { enabled: false, postsPerDay: 1 },
  });

  const updatePlatform = (
    platform: keyof PlatformConfigs,
    field: keyof PlatformConfig,
    value: boolean | number
  ) => {
    setPlatforms((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  const calculation = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalDays: 0, totalPosts: 0, breakdown: [] };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const breakdown: { platform: string; posts: number; icon: React.ComponentType<any> }[] = [];
    let totalPosts = 0;

    if (platforms.instagram.enabled) {
      const posts = totalDays * platforms.instagram.postsPerDay;
      breakdown.push({ platform: "Instagram", posts, icon: Instagram });
      totalPosts += posts;
    }
    if (platforms.twitter.enabled) {
      const posts = totalDays * platforms.twitter.postsPerDay;
      breakdown.push({ platform: "X (Twitter)", posts, icon: Twitter });
      totalPosts += posts;
    }
    if (platforms.linkedin.enabled) {
      const posts = totalDays * platforms.linkedin.postsPerDay;
      breakdown.push({ platform: "LinkedIn", posts, icon: Linkedin });
      totalPosts += posts;
    }

    return { totalDays, totalPosts, breakdown };
  }, [startDate, endDate, platforms]);

  const hasAnyPlatformEnabled =
    platforms.instagram.enabled ||
    platforms.twitter.enabled ||
    platforms.linkedin.enabled;

  const canGenerate = startDate && endDate && hasAnyPlatformEnabled && calculation.totalPosts > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(null);
    setGenerationResult(null);
    
    let finalResult: { success: boolean; generated: number; errors: string[] } | null = null;
    
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/content/autopilot/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: startDate,
          endDate: endDate,
          platforms: {
            instagram: platforms.instagram,
            x: platforms.twitter,
            linkedin: platforms.linkedin,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to start generation");
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No response body");
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(line => line.startsWith("data: "));
        
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
          } catch (e) {
          }
        }
      }
      
      toast({
        title: "Generazione completata!",
        description: `${finalResult?.generated || 0} post generati e schedulati.`,
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

  const platformsList = [
    {
      key: "instagram" as const,
      label: "Instagram",
      icon: Instagram,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      key: "twitter" as const,
      label: "X (Twitter)",
      icon: Twitter,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      icon: Linkedin,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Autopilot</h1>
                <p className="text-muted-foreground">
                  Genera post in batch per un periodo di date
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configura Autopilot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate" className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data Inizio
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate" className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data Fine
                        </Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Frequenza per Piattaforma
                      </Label>

                      <div className="space-y-3">
                        {platformsList.map((platform) => (
                          <div
                            key={platform.key}
                            className={`flex items-center justify-between p-4 rounded-lg border ${
                              platforms[platform.key].enabled
                                ? "border-primary/50 bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={platform.key}
                                checked={platforms[platform.key].enabled}
                                onCheckedChange={(checked) =>
                                  updatePlatform(platform.key, "enabled", !!checked)
                                }
                              />
                              <div className={`p-2 rounded-lg ${platform.bgColor}`}>
                                <platform.icon className={`h-4 w-4 ${platform.color}`} />
                              </div>
                              <Label
                                htmlFor={platform.key}
                                className="font-medium cursor-pointer"
                              >
                                {platform.label}
                              </Label>
                            </div>

                            <Select
                              value={platforms[platform.key].postsPerDay.toString()}
                              onValueChange={(value) =>
                                updatePlatform(platform.key, "postsPerDay", parseInt(value))
                              }
                              disabled={!platforms[platform.key].enabled}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 post/giorno</SelectItem>
                                <SelectItem value="2">2 post/giorno</SelectItem>
                                <SelectItem value="3">3 post/giorno</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {calculation.totalDays > 0 && hasAnyPlatformEnabled && (
                      <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-5 w-5 text-violet-600" />
                          <span className="font-semibold">Preview Calcolo</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center p-3 bg-white/50 rounded-lg">
                            <p className="text-2xl font-bold text-violet-600">
                              {calculation.totalDays}
                            </p>
                            <p className="text-sm text-muted-foreground">Giorni</p>
                          </div>
                          <div className="text-center p-3 bg-white/50 rounded-lg">
                            <p className="text-2xl font-bold text-indigo-600">
                              {calculation.totalPosts}
                            </p>
                            <p className="text-sm text-muted-foreground">Post Totali</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {calculation.breakdown.map((item) => (
                            <div
                              key={item.platform}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span>{item.platform}</span>
                              </div>
                              <span className="font-medium">{item.posts} post</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                      {isGenerating ? "Generazione in corso..." : "Genera Post"}
                    </Button>

                    {isGenerating && progress && (
                      <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Generazione in corso...</span>
                          <span className="font-medium">{progress.completed}/{progress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {progress.currentPlatform} - {progress.currentDate}
                        </p>
                      </div>
                    )}

                    {generationResult && !isGenerating && (
                      <div className={`mt-6 p-4 rounded-lg ${generationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2">
                          {generationResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium">
                            {generationResult.success 
                              ? `${generationResult.generated} post generati e schedulati!`
                              : "Generazione completata con errori"
                            }
                          </span>
                        </div>
                        {generationResult.errors.length > 0 && (
                          <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                            {generationResult.errors.slice(0, 5).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Ultimi Batch Generati
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <Rocket className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Nessun batch generato ancora</p>
                      <p className="text-sm mt-1">
                        Configura e avvia il tuo primo batch
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
