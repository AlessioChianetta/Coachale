import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronDown,
  ChevronRight,
  Users,
  HardDrive,
  Mail,
  Phone,
  Calendar,
  GitBranch,
  Briefcase,
  User,
  GraduationCap,
} from "lucide-react";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Client {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  enrolledAt: string | null;
  phoneNumber: string | null;
  level: string | null;
}

interface Consultant {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  phoneNumber: string | null;
  clientCount: number;
  clients: Client[];
  googleDriveConnected: boolean;
  googleDriveEmail: string | null;
}

export default function AdminHierarchy() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(new Set());

  const { data: hierarchyData, isLoading } = useQuery({
    queryKey: ["/api/admin/hierarchy"],
    queryFn: async () => {
      const response = await fetch("/api/admin/hierarchy", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch hierarchy");
      return response.json();
    },
  });

  const hierarchy: Consultant[] = hierarchyData?.hierarchy || [];

  const toggleConsultant = (consultantId: string) => {
    setExpandedConsultants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(consultantId)) {
        newSet.delete(consultantId);
      } else {
        newSet.add(consultantId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedConsultants(new Set(hierarchy.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedConsultants(new Set());
  };

  const getLevelColor = (level: string | null) => {
    switch (level) {
      case "master":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "mentor":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "esperto":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl">
                      <GitBranch className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Gerarchia Sistema</h1>
                      <p className="text-purple-100 text-sm md:text-base hidden sm:block">
                        Vista strutturale Consultant → Clienti
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={expandAll}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    Espandi Tutti
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={collapseAll}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    Chiudi Tutti
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-500">Caricamento gerarchia...</p>
                </CardContent>
              </Card>
            ) : hierarchy.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessun Consultant</h3>
                  <p className="text-gray-500">Non sono ancora stati creati consultant nel sistema.</p>
                </CardContent>
              </Card>
            ) : (
              hierarchy.map((consultant) => {
                const isExpanded = expandedConsultants.has(consultant.id);
                return (
                  <Card key={consultant.id} className="border-0 shadow-lg overflow-hidden">
                    <div
                      className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      onClick={() => toggleConsultant(consultant.id)}
                    >
                      <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </Button>

                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                            {consultant.firstName?.[0]}{consultant.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {consultant.firstName} {consultant.lastName}
                            </h3>
                            <Badge variant={consultant.isActive ? "default" : "secondary"}>
                              {consultant.isActive ? "Attivo" : "Inattivo"}
                            </Badge>
                            {consultant.googleDriveConnected ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <HardDrive className="w-3 h-3 mr-1" />
                                Drive Connesso
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                <HardDrive className="w-3 h-3 mr-1" />
                                No Drive
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {consultant.email}
                            </span>
                            {consultant.phoneNumber && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {consultant.phoneNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-2 justify-end">
                            <Briefcase className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-xl text-gray-900 dark:text-white">
                              {consultant.clientCount}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">clienti</p>
                        </div>
                      </div>
                    </div>

                    {isExpanded && consultant.clients.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="p-4 md:p-6 space-y-3">
                          {consultant.clients.map((client) => (
                            <div
                              key={client.id}
                              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm"
                            >
                              <div className="w-8 h-8 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                              </div>

                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white text-sm">
                                  {client.firstName?.[0]}{client.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {client.firstName} {client.lastName}
                                  </span>
                                  <Badge
                                    variant={client.isActive ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {client.isActive ? "Attivo" : "Inattivo"}
                                  </Badge>
                                  {client.level && (
                                    <Badge className={`text-xs ${getLevelColor(client.level)}`}>
                                      <GraduationCap className="w-3 h-3 mr-1" />
                                      {client.level}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {client.email}
                                  </span>
                                  {client.enrolledAt && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Iscritto: {format(new Date(client.enrolledAt), "d MMM yyyy", { locale: it })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isExpanded && consultant.clients.length === 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-8 text-center">
                        <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">Nessun cliente assegnato</p>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
