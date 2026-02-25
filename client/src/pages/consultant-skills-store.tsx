import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Sparkles, Package } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { SkillCard } from "@/components/skills-store/SkillCard";
import { SkillDetailModal } from "@/components/skills-store/SkillDetailModal";
import { SkillCreateModal } from "@/components/skills-store/SkillCreateModal";
import { ImportButtons } from "@/components/skills-store/ImportButtons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Skill {
  id: string;
  skillId: string;
  name: string;
  displayTitle: string;
  description: string;
  source: string;
  category: string;
  content: string;
  isActive: boolean;
  metadata: any;
  createdAt: string;
}

export default function ConsultantSkillsStore() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);
  if (categoryFilter !== "all") queryParams.set("category", categoryFilter);
  if (statusFilter !== "all") queryParams.set("is_active", statusFilter);
  if (search) queryParams.set("search", search);

  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ["/api/skills-store", sourceFilter, categoryFilter, statusFilter, search],
    queryFn: async () => {
      const res = await fetch(`/api/skills-store?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/skills-store/categories"],
    queryFn: async () => {
      const res = await fetch("/api/skills-store/categories", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const importOfficialMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/skills-store/import/github-official"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store/categories"] });
      toast({
        title: "Import completato",
        description: `${data.imported} skill importate da Anthropic Official`,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Import Official fallito", variant: "destructive" });
    },
  });

  const importCommunityMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/skills-store/import/github-community"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store/categories"] });
      toast({
        title: "Import completato",
        description: `${data.imported} skill importate dalla community (${data.totalLinksFound} link trovati)`,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Import Community fallito", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/skills-store/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/skills-store/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store/categories"] });
      setDeletingId(null);
      toast({ title: "Skill eliminata", description: "La skill è stata rimossa." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; displayTitle: string; description: string; category: string; content: string }) =>
      apiRequest("POST", "/api/skills-store/custom", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store/categories"] });
      setShowCreate(false);
      toast({ title: "Skill creata", description: "La nuova skill è stata aggiunta." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Creazione fallita", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; displayTitle: string; description: string; category: string; content: string }) =>
      apiRequest("PUT", `/api/skills-store/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills-store/categories"] });
      setShowCreate(false);
      setEditingSkill(null);
      toast({ title: "Skill aggiornata", description: "Le modifiche sono state salvate." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Aggiornamento fallito", variant: "destructive" });
    },
  });

  const handleCreateSubmit = (data: { name: string; displayTitle: string; description: string; category: string; content: string }) => {
    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setShowCreate(true);
  };

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  const activeCount = skills.filter((s) => s.isActive).length;

  return (
    <PageLayout role="consultant">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Skill Store
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Marketplace di skill AI — importa, crea e gestisci le competenze dei tuoi assistenti
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Package className="h-3 w-3" />
              {skills.length} skill
            </Badge>
            <Badge variant="outline" className="gap-1 text-green-400 border-green-500/30">
              {activeCount} attive
            </Badge>
          </div>
        </div>

        <ImportButtons
          onImportOfficial={() => importOfficialMutation.mutate()}
          onImportCommunity={() => importCommunityMutation.mutate()}
          onCreateCustom={() => { setEditingSkill(null); setShowCreate(true); }}
          isImportingOfficial={importOfficialMutation.isPending}
          isImportingCommunity={importCommunityMutation.isPending}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca skill per nome o descrizione..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le fonti</SelectItem>
              <SelectItem value="github_official">Official</SelectItem>
              <SelectItem value="github_community">Community</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="true">Attive</SelectItem>
              <SelectItem value="false">Inattive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-lg" />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-medium">Nessuna skill trovata</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Importa skill dal repository Anthropic, dalla community, oppure crea le tue skill personalizzate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
                onDetail={(s) => { setDetailSkill(s); setShowDetail(true); }}
                onEdit={handleEdit}
                onDelete={(id) => setDeletingId(id)}
                isToggling={toggleMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <SkillDetailModal
        skill={detailSkill}
        open={showDetail}
        onOpenChange={setShowDetail}
        onToggle={handleToggle}
      />

      <SkillCreateModal
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setEditingSkill(null);
        }}
        onSubmit={handleCreateSubmit}
        editingSkill={editingSkill}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. La skill verrà rimossa dallo store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
