import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  BarChart3,
  Menu,
  TrendingUp,
  Target,
  ThumbsUp,
  FileText,
  Video,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  User,
  Calendar,
  PieChart,
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAuthHeaders } from '@/lib/auth';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';

interface SellerOverview {
  sellerId: string;
  sellerName: string;
  displayName: string;
  totalMeetings: number;
  avgBuySignals: number;
  avgScriptAdherence: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
}

interface OverviewData {
  totalMeetings: number;
  totalBuySignals: number;
  totalObjections: number;
  avgScriptAdherence: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
  sellers: SellerOverview[];
}

interface SellerDetail {
  seller: {
    id: string;
    sellerName: string;
    displayName: string;
  };
  summary: {
    totalMeetings: number;
    totalBuySignals: number;
    avgBuySignalsPerMeeting: number;
    totalObjections: number;
    objectionsHandled: number;
    objectionHandlingRate: number;
    avgScriptAdherence: number;
    wonDeals: number;
    lostDeals: number;
    followUps: number;
    conversionRate: number;
    archetypeBreakdown: Record<string, number>;
  };
  recentSessions: Array<{
    meetingId: string;
    prospectName: string;
    startedAt: string;
    durationSeconds: number;
    buySignals: number;
    objections: number;
    scriptAdherence: number;
    outcome: string;
    archetype: string;
  }>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getOutcomeBadge(outcome: string) {
  switch (outcome?.toLowerCase()) {
    case 'won':
    case 'vinto':
      return <Badge className="bg-green-500 hover:bg-green-600">Vinto</Badge>;
    case 'lost':
    case 'perso':
      return <Badge className="bg-red-500 hover:bg-red-600">Perso</Badge>;
    case 'follow_up':
    case 'follow-up':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Follow-up</Badge>;
    default:
      return <Badge variant="secondary">{outcome || 'In corso'}</Badge>;
  }
}

const OUTCOME_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#a855f7'];
const SELLER_COLORS = ['#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'];

export default function ClientHumanSellersAnalyticsDashboard() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  const { data: overviewData, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ['/api/client/human-sellers/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/api/client/human-sellers/analytics/overview', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
  });

  const { data: sellerDetail, isLoading: detailLoading } = useQuery<SellerDetail>({
    queryKey: ['/api/client/human-sellers/analytics/sellers', selectedSellerId],
    queryFn: async () => {
      const response = await fetch(`/api/client/human-sellers/analytics/sellers/${selectedSellerId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch seller detail');
      return response.json();
    },
    enabled: !!selectedSellerId,
  });

  const outcomeChartData = useMemo(() => {
    if (!overviewData) return [];
    return [
      { name: 'Vinti', value: overviewData.wonDeals, color: '#22c55e' },
      { name: 'Persi', value: overviewData.lostDeals, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [overviewData]);

  const sellerComparisonData = useMemo(() => {
    if (!overviewData?.sellers) return [];
    return overviewData.sellers.map(seller => ({
      name: seller.displayName || seller.sellerName,
      conversione: Math.round(seller.conversionRate),
      script: Math.round(seller.avgScriptAdherence),
      meetings: seller.totalMeetings,
    }));
  }, [overviewData]);

  const statsCards = [
    {
      title: 'Meeting Totali',
      value: overviewData?.totalMeetings ?? 0,
      icon: <Video className="h-5 w-5" />,
      gradient: 'from-purple-500 to-violet-600',
      description: 'Tutti i venditori',
    },
    {
      title: 'Tasso Conversione',
      value: `${(overviewData?.conversionRate ?? 0).toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      gradient: 'from-violet-500 to-purple-600',
      description: 'Media globale',
    },
    {
      title: 'Aderenza Script',
      value: `${(overviewData?.avgScriptAdherence ?? 0).toFixed(1)}%`,
      icon: <FileText className="h-5 w-5" />,
      gradient: 'from-fuchsia-500 to-pink-600',
      description: 'Media globale',
    },
    {
      title: 'Obiezioni Totali',
      value: overviewData?.totalObjections ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: 'from-amber-500 to-orange-600',
      description: 'Rilevate in tutti i meeting',
    },
    {
      title: 'Buy Signals',
      value: overviewData?.totalBuySignals ?? 0,
      icon: <ThumbsUp className="h-5 w-5" />,
      gradient: 'from-purple-600 to-violet-700',
      description: 'Segnali rilevati',
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
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Analytics Venditori
              </h1>
              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/client/human-sellers')}
                  className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Lista Venditori
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 bg-purple-100/50 dark:bg-purple-900/30">
                <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Panoramica
                </TabsTrigger>
                <TabsTrigger value="detail" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  <User className="h-4 w-4 mr-2" />
                  Dettaglio Venditore
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8">
                {overviewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-purple-600 animate-pulse" />
                      <p className="text-gray-600 dark:text-gray-400">Caricamento analytics...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                      {statsCards.map((stat, index) => (
                        <motion.div
                          key={stat.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                        >
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50 shadow-lg hover:shadow-xl transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {stat.title}
                                  </p>
                                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {stat.value}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    {stat.description}
                                  </p>
                                </div>
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white`}>
                                  {stat.icon}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    >
                      <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <PieChart className="h-5 w-5 text-purple-600" />
                            Distribuzione Esiti
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {outcomeChartData.length > 0 ? (
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                  <Pie
                                    data={outcomeChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                  >
                                    {outcomeChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend />
                                </RechartsPieChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-[250px] flex items-center justify-center">
                              <p className="text-gray-500 dark:text-gray-400">Nessun dato disponibile</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                            Confronto Venditori
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {sellerComparisonData.length > 0 ? (
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sellerComparisonData} layout="vertical">
                                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                  <Tooltip formatter={(value: number) => `${value}%`} />
                                  <Legend />
                                  <Bar dataKey="conversione" name="Conversione" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                  <Bar dataKey="script" name="Script" fill="#a855f7" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-[250px] flex items-center justify-center">
                              <p className="text-gray-500 dark:text-gray-400">Nessun venditore disponibile</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Deal Vinti
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-4xl font-bold text-green-600">{overviewData?.wonDeals ?? 0}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <XCircle className="h-5 w-5 text-red-500" />
                            Deal Persi
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-4xl font-bold text-red-500">{overviewData?.lostDeals ?? 0}</p>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50 shadow-xl">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Users className="h-6 w-6 text-purple-600" />
                            Performance Venditori
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {overviewData?.sellers && overviewData.sellers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {overviewData.sellers.map((seller, index) => (
                                <motion.div
                                  key={seller.sellerId}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.5 + index * 0.05 }}
                                >
                                  <Card
                                    className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                                    onClick={() => {
                                      setSelectedSellerId(seller.sellerId);
                                      setActiveTab('detail');
                                    }}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-semibold">
                                          {seller.displayName?.charAt(0) || seller.sellerName?.charAt(0) || 'V'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                                            {seller.displayName || seller.sellerName}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {seller.totalMeetings} meeting
                                          </p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-purple-400" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">Conversione</p>
                                          <p className="font-semibold text-purple-600">{seller.conversionRate.toFixed(0)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">Script</p>
                                          <p className="font-semibold text-purple-600">{seller.avgScriptAdherence.toFixed(0)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">Vinti</p>
                                          <p className="font-semibold text-green-600">{seller.wonDeals}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">Persi</p>
                                          <p className="font-semibold text-red-500">{seller.lostDeals}</p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                              <p className="text-gray-500 dark:text-gray-400">
                                Nessun venditore con dati analytics disponibili
                              </p>
                              <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => setLocation('/client/human-sellers')}
                              >
                                Gestisci Venditori
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="detail" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <User className="h-5 w-5 text-purple-600" />
                          Seleziona Venditore
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                        <SelectTrigger className="w-full md:w-80">
                          <SelectValue placeholder="Scegli un venditore..." />
                        </SelectTrigger>
                        <SelectContent>
                          {overviewData?.sellers?.map((seller) => (
                            <SelectItem key={seller.sellerId} value={seller.sellerId}>
                              {seller.displayName || seller.sellerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                </motion.div>

                {selectedSellerId && (
                  <>
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <User className="h-12 w-12 mx-auto mb-4 text-purple-600 animate-pulse" />
                          <p className="text-gray-600 dark:text-gray-400">Caricamento dettagli...</p>
                        </div>
                      </div>
                    ) : sellerDetail ? (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="grid grid-cols-2 md:grid-cols-4 gap-4"
                        >
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardContent className="p-4 text-center">
                              <Video className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                              <p className="text-2xl font-bold">{sellerDetail.summary.totalMeetings}</p>
                              <p className="text-xs text-gray-500">Meeting Totali</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardContent className="p-4 text-center">
                              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
                              <p className="text-2xl font-bold">{sellerDetail.summary.conversionRate.toFixed(1)}%</p>
                              <p className="text-xs text-gray-500">Conversione</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardContent className="p-4 text-center">
                              <FileText className="h-6 w-6 mx-auto mb-2 text-violet-600" />
                              <p className="text-2xl font-bold">{sellerDetail.summary.avgScriptAdherence.toFixed(1)}%</p>
                              <p className="text-xs text-gray-500">Aderenza Script</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardContent className="p-4 text-center">
                              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                              <p className="text-2xl font-bold">{sellerDetail.summary.objectionHandlingRate}%</p>
                              <p className="text-xs text-gray-500">Obiezioni Gestite</p>
                            </CardContent>
                          </Card>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                            <CardContent className="p-4 text-center">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                              <p className="text-3xl font-bold text-green-600">{sellerDetail.summary.wonDeals}</p>
                              <p className="text-sm text-green-700 dark:text-green-400">Deal Vinti</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800">
                            <CardContent className="p-4 text-center">
                              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                              <p className="text-3xl font-bold text-red-500">{sellerDetail.summary.lostDeals}</p>
                              <p className="text-sm text-red-700 dark:text-red-400">Deal Persi</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800">
                            <CardContent className="p-4 text-center">
                              <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                              <p className="text-3xl font-bold text-yellow-600">{sellerDetail.summary.followUps}</p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-400">Follow-up</p>
                            </CardContent>
                          </Card>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <ThumbsUp className="h-5 w-5 text-purple-600" />
                                Buy Signals
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400">Totali</p>
                                  <p className="text-2xl font-bold">{sellerDetail.summary.totalBuySignals}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400">Media per Meeting</p>
                                  <p className="text-2xl font-bold">{sellerDetail.summary.avgBuySignalsPerMeeting.toFixed(1)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        {Object.keys(sellerDetail.summary.archetypeBreakdown || {}).length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                          >
                            <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <Target className="h-5 w-5 text-purple-600" />
                                  Archetipi Prospect
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {Object.entries(sellerDetail.summary.archetypeBreakdown).map(([archetype, count]) => (
                                    <div key={archetype} className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                                      <p className="text-xl font-bold text-purple-600">{count}</p>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{archetype}</p>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-purple-600" />
                                Sessioni Recenti
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {sellerDetail.recentSessions && sellerDetail.recentSessions.length > 0 ? (
                                <ScrollArea className="h-[400px]">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Prospect</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Durata</TableHead>
                                        <TableHead>Buy Signals</TableHead>
                                        <TableHead>Script</TableHead>
                                        <TableHead>Esito</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sellerDetail.recentSessions.map((session) => (
                                        <TableRow
                                          key={session.meetingId}
                                          className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                          onClick={() => setLocation(`/client/human-sellers/${session.meetingId}/analytics`)}
                                        >
                                          <TableCell className="font-medium">{session.prospectName || 'N/A'}</TableCell>
                                          <TableCell>
                                            {session.startedAt
                                              ? format(new Date(session.startedAt), 'dd MMM yyyy HH:mm', { locale: it })
                                              : 'N/A'}
                                          </TableCell>
                                          <TableCell>{formatDuration(session.durationSeconds || 0)}</TableCell>
                                          <TableCell>{session.buySignals}</TableCell>
                                          <TableCell>{(session.scriptAdherence || 0).toFixed(0)}%</TableCell>
                                          <TableCell>{getOutcomeBadge(session.outcome)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                              ) : (
                                <div className="text-center py-8">
                                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                                  <p className="text-gray-500 dark:text-gray-400">
                                    Nessuna sessione recente disponibile
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Impossibile caricare i dettagli del venditore
                        </p>
                      </div>
                    )}
                  </>
                )}

                {!selectedSellerId && (
                  <div className="text-center py-12">
                    <User className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Seleziona un venditore per visualizzare i dettagli
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
