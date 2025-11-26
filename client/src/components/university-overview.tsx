import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  GraduationCap, 
  Trophy, 
  Award,
  TrendingUp,
  TrendingDown,
  ArrowUpDown
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useState, useMemo } from "react";

type SortField = 'name' | 'completionRate' | 'averageGrade' | 'certificatesCount';
type SortOrder = 'asc' | 'desc';

export default function UniversityOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('completionRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["/api/university/stats/overview"],
    queryFn: async () => {
      const response = await fetch("/api/university/stats/overview?activeOnly=false", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const filteredAndSortedStats = useMemo(() => {
    let filtered = stats.filter((client: any) => {
      const fullName = `${client.clientName} ${client.clientEmail}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });

    filtered.sort((a: any, b: any) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'name':
          aVal = a.clientName.toLowerCase();
          bVal = b.clientName.toLowerCase();
          break;
        case 'completionRate':
          aVal = a.completionRate || 0;
          bVal = b.completionRate || 0;
          break;
        case 'averageGrade':
          aVal = a.averageGrade || 0;
          bVal = b.averageGrade || 0;
          break;
        case 'certificatesCount':
          aVal = a.certificatesCount || 0;
          bVal = b.certificatesCount || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [stats, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown 
      className={`ml-1 h-4 w-4 inline ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} 
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento statistiche università...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Studenti Attivi</p>
                <p className="text-2xl font-bold">{stats.length}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completamento Medio</p>
                <p className="text-2xl font-bold">
                  {stats.length > 0 
                    ? Math.round(stats.reduce((acc: number, s: any) => acc + (s.completionRate || 0), 0) / stats.length) 
                    : 0}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Media Voti</p>
                <p className="text-2xl font-bold">
                  {stats.length > 0 
                    ? (stats.reduce((acc: number, s: any) => acc + (s.averageGrade || 0), 0) / stats.filter((s: any) => s.averageGrade > 0).length || 0).toFixed(1)
                    : 0}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attestati Emessi</p>
                <p className="text-2xl font-bold">
                  {stats.reduce((acc: number, s: any) => acc + (s.certificatesCount || 0), 0)}
                </p>
              </div>
              <Award className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Panoramica Studenti Università</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca studente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nessuno studente trovato</p>
              <p className="text-sm">Gli studenti iscritti all'università appariranno qui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('name')}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Studente
                        <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('completionRate')}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Completamento
                        <SortIcon field="completionRate" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('averageGrade')}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Media Voti
                        <SortIcon field="averageGrade" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('certificatesCount')}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Attestati
                        <SortIcon field="certificatesCount" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Dettagli</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAndSortedStats.map((client: any) => {
                    const initials = client.clientName
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase();
                    
                    const completionRate = client.completionRate || 0;
                    const averageGrade = client.averageGrade || 0;
                    const certificatesCount = client.certificatesCount || 0;

                    return (
                      <tr key={client.clientId} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{client.clientName}</p>
                              <p className="text-sm text-muted-foreground">{client.clientEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-muted rounded-full h-2 w-20">
                              <div 
                                className={`h-2 rounded-full ${
                                  completionRate >= 75 ? 'bg-success' :
                                  completionRate >= 50 ? 'bg-primary' :
                                  completionRate >= 25 ? 'bg-accent' : 'bg-muted-foreground'
                                }`}
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{Math.round(completionRate)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {averageGrade > 0 ? (
                              <>
                                <Badge 
                                  variant={
                                    averageGrade >= 90 ? "default" :
                                    averageGrade >= 75 ? "secondary" :
                                    "outline"
                                  }
                                >
                                  {averageGrade.toFixed(1)}
                                </Badge>
                                {averageGrade >= 90 && <Trophy className="h-4 w-4 text-accent" />}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Award className="h-4 w-4 text-primary" />
                            <span className="font-medium">{certificatesCount}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm space-y-1">
                            <p className="text-muted-foreground">
                              {client.totalLessons || 0} lezioni • {client.completedLessons || 0} completate
                            </p>
                            <p className="text-muted-foreground">
                              {client.totalYears || 0} anni assegnati
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `/consultant/university?clientId=${client.clientId}`}
                          >
                            Visualizza
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
