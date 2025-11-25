import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  Activity, 
  Clock, 
  MousePointer, 
  LogIn, 
  LogOut, 
  Play, 
  Eye,
  RefreshCw,
  Calendar,
  User,
  CheckCircle,
  Table as TableIcon
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

export default function ActivityDashboard() {
  const [refreshInterval, setRefreshInterval] = useState<number | null>(30000); // 30 seconds

  // Fetch active sessions
  const { data: activeSessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["/api/activity/sessions/active"],
    queryFn: async () => {
      const response = await fetch("/api/activity/sessions/active", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch active sessions");
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  // Fetch recent activity logs
  const { data: activityLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["/api/activity/clients"],
    queryFn: async () => {
      const response = await fetch("/api/activity/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    refetchInterval: refreshInterval,
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'fresh_login': 
      case 'login':
        return <LogIn size={16} className="text-green-500" />;
      case 'logout': 
      case 'explicit_logout':
        return <LogOut size={16} className="text-gray-500" />;
      case 'session_restore': 
        return <RefreshCw size={16} className="text-blue-500" />; 
      case 'exercise_start': 
        return <Play size={16} className="text-purple-500" />;
      case 'exercise_complete':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'exercise_view':
        return <Eye size={16} className="text-blue-400" />;
      case 'page_view':
        return <MousePointer size={16} className="text-gray-400" />;
      case 'heartbeat':
        return <Activity size={16} className="text-green-400" />;
      default: 
        return <Activity size={16} className="text-gray-400" />;
    }
  };

  const getActivityDescription = (log: any) => {
    const parseDetails = (details: string) => {
      if (!details || details.trim() === '') return {};
      try {
        return JSON.parse(details);
      } catch (error) {
        return {};
      }
    };

    const details = parseDetails(log.details);

    switch (log.activityType) {
      case 'fresh_login': 
      case 'login':
        return 'si è connesso';
      case 'logout':
      case 'explicit_logout': 
        return 'si è disconnesso';
      case 'session_restore': 
        return 'si è riconnesso';
      case 'exercise_start': 
        return details.exerciseTitle 
          ? `ha iniziato "${details.exerciseTitle}"`
          : 'ha iniziato un esercizio';
      case 'exercise_complete':
        return details.exerciseTitle 
          ? `ha completato "${details.exerciseTitle}"`
          : 'ha completato un esercizio';
      case 'exercise_view':
        return details.exerciseTitle 
          ? `sta lavorando su "${details.exerciseTitle}"`
          : 'sta visualizzando un esercizio';
      case 'page_view':
        const pageName = details.page?.replace('/client', 'Dashboard')
          .replace('/exercises', 'Esercizi')
          .replace('/profile', 'Profilo')
          .replace('/', 'Home') || 'una pagina';
        return `ha aperto ${pageName}`;
      case 'heartbeat':
        return 'è attivo';
      default: 
        return 'è online';
    }
  };

  // Calculate session duration for active sessions
  const getSessionDuration = (session: any) => {
    const startTime = new Date(session.startTime);
    const now = new Date();
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  };

  // Raggruppa attività per cliente
  const clientActivitySummary = useMemo(() => {
    const summary = new Map<string, any>();
    
    // Aggiungi info dalle sessioni attive
    activeSessions.forEach((session: any) => {
      if (session.user) {
        summary.set(session.user.id, {
          user: session.user,
          isOnline: true,
          lastActivity: new Date(session.startTime),
          totalSessions: 1,
          activityCount: 0,
          recentActivities: [],
        });
      }
    });

    // Aggiungi info dai log attività
    activityLogs.forEach((log: any) => {
      if (log.user) {
        const existing = summary.get(log.user.id);
        const logDate = new Date(log.timestamp);
        
        if (existing) {
          existing.activityCount++;
          existing.totalSessions = existing.totalSessions || 1;
          if (logDate > existing.lastActivity) {
            existing.lastActivity = logDate;
          }
          if (existing.recentActivities.length < 3) {
            existing.recentActivities.push(log);
          }
        } else {
          summary.set(log.user.id, {
            user: log.user,
            isOnline: false,
            lastActivity: logDate,
            totalSessions: 1,
            activityCount: 1,
            recentActivities: [log],
          });
        }
      }
    });

    // Converti in array e ordina per ultimo accesso
    return Array.from(summary.values()).sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }, [activeSessions, activityLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold">Monitoraggio Attività Clienti</h2>
          <p className="text-muted-foreground">
            Traccia accessi, sessioni e attività dei tuoi clienti in tempo reale
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              refetchSessions();
              refetchLogs();
            }}
          >
            <RefreshCw size={16} className="mr-2" />
            Aggiorna
          </Button>
          <Badge variant={refreshInterval ? "default" : "secondary"}>
            {refreshInterval ? "Auto-refresh: 30s" : "Auto-refresh: Off"}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <Users className="text-success" size={18} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clienti Online</p>
                <p className="text-xl font-bold">{activeSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="text-primary" size={18} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Medio</p>
                <p className="text-xl font-bold">
                  {activeSessions.length > 0 
                    ? formatDuration(Math.floor(activeSessions.reduce((acc, session) => acc + getSessionDuration(session), 0) / activeSessions.length))
                    : "0m"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Play className="text-secondary" size={18} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Esercizi Avviati</p>
                <p className="text-xl font-bold">
                  {activityLogs.filter((log: any) => log.activityType === 'exercise_start').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                <Activity className="text-accent" size={18} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attività Oggi</p>
                <p className="text-xl font-bold">
                  {activityLogs.filter((log: any) => {
                    const logDate = new Date(log.timestamp);
                    const today = new Date();
                    return logDate.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients" className="flex items-center space-x-2">
            <TableIcon size={16} />
            <span>Per Cliente</span>
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center space-x-2">
            <Users size={16} />
            <span>Online ({activeSessions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <Activity size={16} />
            <span>Log Attività</span>
          </TabsTrigger>
        </TabsList>

        {/* Per Cliente Tab - Tabella riepilogativa */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attività per Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {clientActivitySummary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nessuna attività registrata</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Ultimo Accesso</TableHead>
                        <TableHead className="text-center">Attività</TableHead>
                        <TableHead className="text-center">Sessioni</TableHead>
                        <TableHead>Ultime Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientActivitySummary.map((clientData: any) => {
                        const timeSinceLastActivity = Date.now() - clientData.lastActivity.getTime();
                        const minutesAgo = Math.floor(timeSinceLastActivity / 60000);
                        const hoursAgo = Math.floor(minutesAgo / 60);
                        const daysAgo = Math.floor(hoursAgo / 24);
                        
                        let lastActivityText = '';
                        if (daysAgo > 0) lastActivityText = `${daysAgo}g fa`;
                        else if (hoursAgo > 0) lastActivityText = `${hoursAgo}h fa`;
                        else if (minutesAgo > 0) lastActivityText = `${minutesAgo}m fa`;
                        else lastActivityText = 'Ora';

                        return (
                          <TableRow key={clientData.user.id}>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={clientData.user.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {clientData.user.firstName?.[0]}{clientData.user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {clientData.user.firstName} {clientData.user.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {clientData.user.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {clientData.isOnline ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                                  Online
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                                  Offline
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Clock size={14} />
                                <span>{lastActivityText}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {clientData.activityCount}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {clientData.totalSessions}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-1">
                                {clientData.recentActivities.slice(0, 2).map((activity: any, idx: number) => (
                                  <div key={idx} className="flex items-center space-x-1 text-muted-foreground">
                                    {getActivityIcon(activity.activityType)}
                                    <span className="truncate max-w-[200px]">
                                      {getActivityDescription(activity)}
                                    </span>
                                  </div>
                                ))}
                                {clientData.recentActivities.length === 0 && (
                                  <span className="text-muted-foreground">Nessuna attività recente</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Sessions */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clienti Online Ora</CardTitle>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nessun cliente online</p>
                  <p className="text-sm">Le sessioni attive appariranno qui</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSessions.map((session: any) => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={session.user?.avatar} />
                          <AvatarFallback>
                            {session.user?.firstName?.[0]}{session.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {session.user?.firstName} {session.user?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Online da: {formatDuration(getSessionDuration(session))}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                          <span className="text-sm text-success font-medium">Online</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.startTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registro Attività Recenti</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nessuna attività registrata</p>
                  <p className="text-sm">Le attività dei clienti appariranno qui</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activityLogs.slice(0, 100).map((log: any, index: number) => (
                    <div 
                      key={log.id} 
                      className="flex items-center space-x-3 p-3 border-l-2 border-l-muted hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {getActivityIcon(log.activityType)}
                      </div>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={log.user?.avatar} />
                        <AvatarFallback className="text-xs">
                          {log.user?.firstName?.[0]}{log.user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                          {' '}{getActivityDescription(log)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}