import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Briefcase,
  User,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface UserData {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "consultant" | "client" | "super_admin";
  isActive: boolean;
  createdAt: string;
  phoneNumber: string | null;
  consultantId: string | null;
  level: string | null;
}

interface ExistingUserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function AdminUsers() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [existingUserInfo, setExistingUserInfo] = useState<ExistingUserInfo | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "client" as "consultant" | "client" | "super_admin",
    phoneNumber: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["/api/admin/users", showInactive],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?includeInactive=${showInactive}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const users: UserData[] = usersData?.users || [];

  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes("@")) {
      setExistingUserInfo(null);
      return;
    }
    setIsCheckingEmail(true);
    try {
      const response = await fetch("/api/admin/users/check-email", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.exists && data.existingUser) {
        setExistingUserInfo(data.existingUser);
        setNewUser(prev => ({
          ...prev,
          firstName: data.existingUser.firstName || prev.firstName,
          lastName: data.existingUser.lastName || prev.lastName,
        }));
      } else {
        setExistingUserInfo(null);
      }
    } catch (error) {
      setExistingUserInfo(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle user status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato dell'utente è stato modificato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile modificare lo stato dell'utente.",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser & { updateExistingRole?: boolean }) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      setShowCreateDialog(false);
      setExistingUserInfo(null);
      setNewUser({
        username: "",
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "client",
        phoneNumber: "",
      });
      toast({
        title: data.existed ? "Ruolo aggiornato" : "Utente creato",
        description: data.existed 
          ? data.message || "Il ruolo dell'utente è stato aggiornato."
          : "Il nuovo utente è stato creato con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare l'utente.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <Shield className="w-3 h-3 mr-1" />
            Super Admin
          </Badge>
        );
      case "consultant":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Briefcase className="w-3 h-3 mr-1" />
            Consultant
          </Badge>
        );
      default:
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <User className="w-3 h-3 mr-1" />
            Client
          </Badge>
        );
    }
  };

  const handleCreateUser = () => {
    const requiresPassword = !existingUserInfo || existingUserInfo.role === newUser.role;
    
    if (!newUser.email || !newUser.firstName || !newUser.lastName) {
      toast({
        title: "Campi obbligatori",
        description: "Compila tutti i campi obbligatori.",
        variant: "destructive",
      });
      return;
    }
    
    if (requiresPassword && !newUser.password) {
      toast({
        title: "Password richiesta",
        description: "La password è obbligatoria per i nuovi utenti.",
        variant: "destructive",
      });
      return;
    }

    const isRoleUpdate = existingUserInfo && existingUserInfo.role !== newUser.role;
    createUserMutation.mutate({
      ...newUser,
      updateExistingRole: isRoleUpdate ? true : undefined,
    });
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setExistingUserInfo(null);
    setNewUser({
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "client",
      phoneNumber: "",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl">
                      <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Gestione Utenti</h1>
                      <p className="text-green-100 text-sm md:text-base hidden sm:block">
                        Gestisci tutti gli utenti della piattaforma
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-bold">{users.length}</div>
                    <div className="text-sm text-green-100">Utenti Totali</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Card className="border-0 shadow-lg mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full md:w-auto items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Cerca utenti..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filtra per ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i ruoli</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Switch
                      id="show-inactive"
                      checked={showInactive}
                      onCheckedChange={setShowInactive}
                    />
                    <Label htmlFor="show-inactive" className="text-sm cursor-pointer flex items-center gap-1">
                      {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      <span className="hidden sm:inline">Mostra inattivi</span>
                    </Label>
                  </div>
                </div>

                <Dialog open={showCreateDialog} onOpenChange={(open) => {
                  if (!open) resetCreateDialog();
                  else setShowCreateDialog(true);
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Nuovo Utente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Utente</DialogTitle>
                      <DialogDescription>
                        Inserisci i dati per creare un nuovo utente nel sistema.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Nome *</Label>
                          <Input
                            id="firstName"
                            value={newUser.firstName}
                            onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Cognome *</Label>
                          <Input
                            id="lastName"
                            value={newUser.lastName}
                            onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          onBlur={() => checkEmailExists(newUser.email)}
                        />
                      </div>
                      {existingUserInfo && existingUserInfo.role !== newUser.role && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-sm">
                            Questo utente esiste già come <strong>{existingUserInfo.role === 'consultant' ? 'Consulente' : existingUserInfo.role === 'client' ? 'Cliente' : 'Super Admin'}</strong>. 
                            Verrà aggiunto un nuovo profilo come <strong>{newUser.role === 'consultant' ? 'Consulente' : newUser.role === 'client' ? 'Cliente' : 'Super Admin'}</strong>.
                            L'utente potrà scegliere il profilo al login.
                          </AlertDescription>
                        </Alert>
                      )}
                      {!(existingUserInfo && existingUserInfo.role !== newUser.role) && (
                        <div className="space-y-2">
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Telefono</Label>
                        <Input
                          id="phoneNumber"
                          value={newUser.phoneNumber}
                          onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Ruolo *</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value: "consultant" | "client" | "super_admin") =>
                            setNewUser({ ...newUser, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="consultant">Consultant</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={resetCreateDialog}>
                        Annulla
                      </Button>
                      <Button
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending}
                        className="bg-gradient-to-r from-green-500 to-emerald-500"
                      >
                        {createUserMutation.isPending 
                          ? "Elaborazione..." 
                          : existingUserInfo && existingUserInfo.role !== newUser.role 
                            ? "Aggiungi Profilo" 
                            : "Crea Utente"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-500">Caricamento utenti...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessun utente trovato</h3>
                  <p className="text-gray-500">Prova a modificare i filtri di ricerca.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utente</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Ruolo</TableHead>
                        <TableHead>Registrazione</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const superAdmins = filteredUsers.filter(u => u.role === 'super_admin');
                        const consultants = filteredUsers.filter(u => u.role === 'consultant');
                        const clients = filteredUsers.filter(u => u.role === 'client');
                        
                        const renderUserRow = (user: UserData) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center font-semibold text-gray-600 dark:text-gray-300">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {user.firstName} {user.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500">@{user.username}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Mail className="w-4 h-4" />
                                {user.email}
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(user.createdAt), "d MMM yyyy", { locale: it })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? "default" : "secondary"}>
                                {user.isActive ? "Attivo" : "Inattivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Switch
                                  checked={user.isActive}
                                  onCheckedChange={() => toggleActiveMutation.mutate(user.id)}
                                  disabled={toggleActiveMutation.isPending}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                        
                        const renderSectionHeader = (title: string, icon: React.ReactNode, count: number, bgColor: string) => (
                          <TableRow key={`header-${title}`} className={bgColor}>
                            <TableCell colSpan={6} className="py-3">
                              <div className="flex items-center gap-2 font-semibold">
                                {icon}
                                {title} ({count})
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                        
                        return (
                          <>
                            {superAdmins.length > 0 && (
                              <>
                                {renderSectionHeader(
                                  "Super Admin",
                                  <Shield className="w-4 h-4 text-red-600" />,
                                  superAdmins.length,
                                  "bg-red-50 dark:bg-red-900/20"
                                )}
                                {superAdmins.map(renderUserRow)}
                              </>
                            )}
                            {consultants.length > 0 && (
                              <>
                                {renderSectionHeader(
                                  "Consulenti",
                                  <Briefcase className="w-4 h-4 text-blue-600" />,
                                  consultants.length,
                                  "bg-blue-50 dark:bg-blue-900/20"
                                )}
                                {consultants.map(renderUserRow)}
                              </>
                            )}
                            {clients.length > 0 && (
                              <>
                                {renderSectionHeader(
                                  "Clienti",
                                  <User className="w-4 h-4 text-green-600" />,
                                  clients.length,
                                  "bg-green-50 dark:bg-green-900/20"
                                )}
                                {clients.map(renderUserRow)}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
