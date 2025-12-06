import { useState } from 'react';
import { useLocation } from 'wouter';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const mockAnalytics = {
  meetingId: '123',
  duration: 1800,
  talkRatio: 0.4,
  scriptAdherence: 85,
  objectionsCount: 4,
  objectionsHandled: 3,
  sentimentScore: 78,
  sentimentTimeline: [
    { start: 0, end: 300, sentiment: 'positive' as const },
    { start: 300, end: 600, sentiment: 'neutral' as const },
    { start: 600, end: 900, sentiment: 'negative' as const },
    { start: 900, end: 1200, sentiment: 'neutral' as const },
    { start: 1200, end: 1800, sentiment: 'positive' as const },
  ],
  summary: [
    'Il prospect è interessato al piano Enterprise',
    'Principale obiezione: budget limitato Q1',
    'Richiesta demo tecnica con team IT',
    'Follow-up programmato per venerdì',
  ],
  transcript: [
    { speaker: 'Venditore', text: 'Buongiorno, grazie per aver accettato questa chiamata. Come sta oggi?', time: 0 },
    { speaker: 'Prospect', text: 'Grazie a voi, sono curioso di saperne di più sulla vostra soluzione.', time: 15 },
    { speaker: 'Venditore', text: 'Perfetto! Prima di iniziare, mi può raccontare quali sono le principali sfide che affronta attualmente?', time: 35 },
    { speaker: 'Prospect', text: 'Il nostro team sta crescendo rapidamente e abbiamo bisogno di strumenti più scalabili.', time: 60 },
    { speaker: 'Venditore', text: 'Capisco perfettamente. Molti dei nostri clienti enterprise hanno avuto la stessa esigenza.', time: 90 },
    { speaker: 'Prospect', text: 'Il budget è un po\' limitato per questo trimestre, però...', time: 320 },
    { speaker: 'Venditore', text: 'Comprendo. Possiamo esplorare opzioni di pagamento flessibili che si adattino al vostro budget.', time: 350 },
    { speaker: 'Prospect', text: 'Interessante, mi piacerebbe vedere una demo con il team IT.', time: 920 },
    { speaker: 'Venditore', text: 'Assolutamente! Possiamo programmare una sessione tecnica per venerdì.', time: 950 },
  ],
  objections: [
    { id: '1', text: 'Budget limitato per Q1', handled: true, handledAt: 350 },
    { id: '2', text: 'Preoccupazione sulla scalabilità', handled: true, handledAt: 120 },
    { id: '3', text: 'Necessità di approvazione IT', handled: true, handledAt: 950 },
    { id: '4', text: 'Tempi di implementazione troppo lunghi', handled: false, handledAt: null },
  ],
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getSentimentColor(sentiment: 'positive' | 'neutral' | 'negative'): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-500';
    case 'neutral':
      return 'bg-yellow-500';
    case 'negative':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getSentimentHoverColor(sentiment: 'positive' | 'neutral' | 'negative'): string {
  switch (sentiment) {
    case 'positive':
      return 'hover:bg-green-400';
    case 'neutral':
      return 'hover:bg-yellow-400';
    case 'negative':
      return 'hover:bg-red-400';
    default:
      return 'hover:bg-gray-400';
  }
}

export default function ClientHumanSellerAnalytics() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  const handleTimelineClick = (start: number) => {
    console.log(`[Video Seek] Jumping to time: ${formatTime(start)} (${start}s)`);
    setCurrentTime(start);
  };

  const statsCards = [
    {
      title: 'Talk/Listen Ratio',
      value: `${Math.round(mockAnalytics.talkRatio * 100)}% / ${Math.round((1 - mockAnalytics.talkRatio) * 100)}%`,
      icon: <div className="flex gap-1"><Mic className="h-4 w-4" /><Headphones className="h-4 w-4" /></div>,
      gradient: 'from-purple-500 to-indigo-600',
      description: 'Tempo parlato vs ascolto',
    },
    {
      title: 'Script Adherence',
      value: `${mockAnalytics.scriptAdherence}%`,
      icon: <FileText className="h-5 w-5" />,
      gradient: 'from-violet-500 to-purple-600',
      description: 'Aderenza allo script',
    },
    {
      title: 'Obiezioni Gestite',
      value: `${mockAnalytics.objectionsHandled} / ${mockAnalytics.objectionsCount}`,
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: 'from-fuchsia-500 to-pink-600',
      description: 'Obiezioni risolte',
    },
    {
      title: 'Sentiment Score',
      value: `${mockAnalytics.sentimentScore}/100`,
      icon: <ThumbsUp className="h-5 w-5" />,
      gradient: 'from-purple-600 to-violet-700',
      description: 'Punteggio sentiment',
    },
  ];

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
                Meeting #{mockAnalytics.meetingId}
              </Badge>
            </div>
          </div>

          <div className="p-4 sm:p-8">
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
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>00:00</span>
                      <div className="flex-1" />
                      <span>{formatTime(mockAnalytics.duration)}</span>
                    </div>
                    <div className="relative h-10 rounded-lg overflow-hidden flex shadow-inner bg-gray-100 dark:bg-gray-800">
                      {mockAnalytics.sentimentTimeline.map((segment, index) => {
                        const widthPercent = ((segment.end - segment.start) / mockAnalytics.duration) * 100;
                        return (
                          <button
                            key={index}
                            onClick={() => handleTimelineClick(segment.start)}
                            className={`h-full transition-all cursor-pointer ${getSentimentColor(segment.sentiment)} ${getSentimentHoverColor(segment.sentiment)} relative group`}
                            style={{ width: `${widthPercent}%` }}
                            title={`${segment.sentiment} (${formatTime(segment.start)} - ${formatTime(segment.end)})`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-medium drop-shadow-lg">
                                {formatTime(segment.start)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all"
                        style={{ left: `${(currentTime / mockAnalytics.duration) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-gray-600 dark:text-gray-400">Positivo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-gray-600 dark:text-gray-400">Neutro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-600 dark:text-gray-400">Negativo</span>
                      </div>
                    </div>
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
                        <p className="text-white/40 text-xs mt-1">Recording non disponibile in demo</p>
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
                          <span className="font-mono text-gray-500">{formatTime(mockAnalytics.duration)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">Durata: 30 min</span>
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
                            {mockAnalytics.summary.map((point, index) => (
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
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="transcript" className="m-0">
                        <ScrollArea className="h-[350px]">
                          <div className="p-4 space-y-3">
                            {mockAnalytics.transcript.map((msg, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`flex gap-3 ${msg.speaker === 'Venditore' ? '' : 'flex-row-reverse'}`}
                              >
                                <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center ${
                                  msg.speaker === 'Venditore' 
                                    ? 'bg-gradient-to-r from-purple-500 to-violet-600' 
                                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                }`}>
                                  <User className="h-4 w-4 text-white" />
                                </div>
                                <div className={`flex-1 ${msg.speaker === 'Venditore' ? 'pr-8' : 'pl-8'}`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                      {msg.speaker}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatTime(msg.time)}</span>
                                  </div>
                                  <div className={`p-3 rounded-xl text-sm ${
                                    msg.speaker === 'Venditore'
                                      ? 'bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 text-gray-800 dark:text-gray-200'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {msg.text}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
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
                              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                {mockAnalytics.objectionsHandled}/{mockAnalytics.objectionsCount} gestite
                              </Badge>
                            </div>
                            {mockAnalytics.objections.map((objection, index) => (
                              <motion.div
                                key={objection.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`p-4 rounded-xl border-2 ${
                                  objection.handled
                                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    {objection.handled ? (
                                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {objection.text}
                                      </p>
                                      {objection.handledAt && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Gestita a {formatTime(objection.handledAt)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <Badge 
                                    variant={objection.handled ? 'default' : 'destructive'}
                                    className={objection.handled 
                                      ? 'bg-green-500 hover:bg-green-600' 
                                      : 'bg-red-500 hover:bg-red-600'
                                    }
                                  >
                                    {objection.handled ? 'Gestita' : 'Non gestita'}
                                  </Badge>
                                </div>
                              </motion.div>
                            ))}
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
