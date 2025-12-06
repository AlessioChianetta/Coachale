import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Menu,
  Mic,
  Headphones,
  FileText,
  AlertTriangle,
  ThumbsUp,
  Play,
  Pause,
  Sparkles,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Video,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface AnalyticsResponse {
  meetingId: string;
  prospectName: string;
  scheduledAt: string | null;
  status: string;
  analytics: {
    id: string;
    meetingId: string;
    durationSeconds: number | null;
    talkRatio: number | null;
    scriptAdherence: number | null;
    avgSentimentScore: number | null;
    objectionsCount: number | null;
    objectionsHandled: number | null;
    aiSummary: string | null;
    actionItems: Array<{ text: string; completed: boolean }> | null;
    createdAt: string;
  } | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function ClientHumanSellerAnalytics() {
  const [, setLocation] = useLocation();
  const { meetingId } = useParams<{ meetingId: string }>();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ['meeting-analytics', meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/client/human-sellers/analytics/${meetingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!meetingId,
  });

  const analytics = analyticsData?.analytics;
  const duration = analytics?.durationSeconds || 0;
  const talkRatio = analytics?.talkRatio || 0;
  const scriptAdherence = analytics?.scriptAdherence || 0;
  const objectionsCount = analytics?.objectionsCount || 0;
  const objectionsHandled = analytics?.objectionsHandled || 0;
  const sentimentScore = analytics?.avgSentimentScore ? Math.round(analytics.avgSentimentScore * 100) : 0;

  const summaryPoints = analytics?.aiSummary 
    ? analytics.aiSummary.split('\n').filter(line => line.trim())
    : [];

  const statsCards = [
    {
      title: 'Talk/Listen Ratio',
      value: analytics ? `${Math.round(talkRatio * 100)}% / ${Math.round((1 - talkRatio) * 100)}%` : '--',
      icon: <div className="flex gap-1"><Mic className="h-4 w-4" /><Headphones className="h-4 w-4" /></div>,
      gradient: 'from-purple-500 to-indigo-600',
      description: 'Tempo parlato vs ascolto',
    },
    {
      title: 'Script Adherence',
      value: analytics ? `${Math.round(scriptAdherence * 100)}%` : '--',
      icon: <FileText className="h-5 w-5" />,
      gradient: 'from-violet-500 to-purple-600',
      description: 'Aderenza allo script',
    },
    {
      title: 'Obiezioni Gestite',
      value: analytics ? `${objectionsHandled} / ${objectionsCount}` : '--',
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: 'from-fuchsia-500 to-pink-600',
      description: 'Obiezioni risolte',
    },
    {
      title: 'Sentiment Score',
      value: analytics ? `${sentimentScore}/100` : '--',
      icon: <ThumbsUp className="h-5 w-5" />,
      gradient: 'from-purple-600 to-violet-700',
      description: 'Punteggio sentiment',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-gray-900 dark:via-purple-950/20 dark:to-black">
        <div className="flex h-screen">
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Caricamento analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-gray-900 dark:via-purple-950/20 dark:to-black">
        <div className="flex h-screen">
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Errore nel caricamento delle analytics</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation('/client/human-sellers/meetings')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna ai meetings
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-gray-900 dark:via-purple-950/20 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-purple-200 dark:border-purple-800">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-purple-100 dark:hover:bg-purple-900 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/human-sellers/meetings')}
                className="hover:bg-purple-100 dark:hover:bg-purple-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Video Meetings
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Video Analytics
              </h1>
              <Badge className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                {analyticsData.prospectName}
              </Badge>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            {!analytics && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
                  <CardContent className="py-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Analytics non ancora disponibili</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Le analytics saranno disponibili dopo che il meeting è stato completato e analizzato.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statsCards.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden border-0 shadow-lg">
                    <div className={`bg-gradient-to-r ${stat.gradient} p-4`}>
                      <div className="flex items-center justify-between">
                        <div className="text-white/80">{stat.icon}</div>
                        <span className="text-2xl font-bold text-white">{stat.value}</span>
                      </div>
                    </div>
                    <CardContent className="pt-3 pb-3">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{stat.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    Timeline Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Timeline sentiment in arrivo</p>
                    <p className="text-xs mt-1">Questa funzionalità sarà disponibile prossimamente</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-purple-200 dark:border-purple-800 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg">
                        <Video className="h-4 w-4 text-white" />
                      </div>
                      Video Replay
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/30 to-transparent" />
                      <div className="text-center z-10">
                        <div className="p-4 bg-white/10 rounded-full mb-4 inline-block backdrop-blur-sm">
                          <Video className="h-12 w-12 text-white/80" />
                        </div>
                        <p className="text-white/60 text-sm">Video Placeholder</p>
                        <p className="text-white/40 text-xs mt-1">Recording in arrivo</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-full border-purple-300 hover:bg-purple-100 dark:border-purple-700 dark:hover:bg-purple-900"
                          onClick={() => setIsPlaying(!isPlaying)}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Play className="h-4 w-4 text-purple-600 ml-0.5" />
                          )}
                        </Button>
                        <div className="text-sm">
                          <span className="font-mono text-purple-600 dark:text-purple-400">{formatTime(currentTime)}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="font-mono text-gray-500">{formatTime(duration)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          Durata: {duration > 0 ? `${Math.round(duration / 60)} min` : '--'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="border-purple-200 dark:border-purple-800 h-full">
                  <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                      <div className="border-b border-purple-100 dark:border-purple-900 px-4 pt-4">
                        <TabsList className="bg-purple-50 dark:bg-purple-950/50 w-full grid grid-cols-3">
                          <TabsTrigger 
                            value="summary" 
                            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white"
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Summary
                          </TabsTrigger>
                          <TabsTrigger 
                            value="transcript"
                            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Trascrizione
                          </TabsTrigger>
                          <TabsTrigger 
                            value="objections"
                            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white"
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Obiezioni
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="summary" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg">
                                <Sparkles className="h-4 w-4 text-white" />
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">AI Summary</h3>
                            </div>
                            {summaryPoints.length > 0 ? (
                              summaryPoints.map((point, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg"
                                >
                                  <div className="p-1 bg-purple-200 dark:bg-purple-800 rounded-full mt-0.5">
                                    <CheckCircle className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{point}</p>
                                </motion.div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Summary non ancora disponibile</p>
                              </div>
                            )}

                            {analytics?.actionItems && analytics.actionItems.length > 0 && (
                              <div className="mt-6 pt-4 border-t border-purple-100 dark:border-purple-900">
                                <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Action Items</h4>
                                {analytics.actionItems.map((item, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
                                    {item.completed ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                                    )}
                                    <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {item.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="transcript" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="p-4">
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">Trascrizione in arrivo</p>
                              <p className="text-xs mt-1">Questa funzionalità sarà disponibile prossimamente</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="objections" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-r from-fuchsia-500 to-pink-600 rounded-lg">
                                  <AlertTriangle className="h-4 w-4 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Obiezioni Rilevate</h3>
                              </div>
                              {analytics && (
                                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  {objectionsHandled}/{objectionsCount} gestite
                                </Badge>
                              )}
                            </div>
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">Dettagli obiezioni in arrivo</p>
                              <p className="text-xs mt-1">Questa funzionalità sarà disponibile prossimamente</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
