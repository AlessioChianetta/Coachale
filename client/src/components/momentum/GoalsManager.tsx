import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import {
  Target,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Play,
  Pause,
  CheckCircle2,
  Calendar,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import { Slider } from '@/components/ui/slider';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  progress: number;
  category: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface GoalsManagerProps {
  onClose?: () => void;
}

export default function GoalsManager({ onClose }: GoalsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: '',
    progress: 0,
  });

  // Fetch goals
  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['/api/momentum/goals'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/goals', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/momentum/goals', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/goals'] });
      toast({ title: 'Obiettivo creato!', description: 'Il tuo nuovo obiettivo è stato aggiunto.' });
      handleCloseCreateModal();
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile creare l\'obiettivo', variant: 'destructive' });
    },
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/momentum/goals/${id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/goals'] });
      toast({ title: 'Obiettivo aggiornato!', description: 'Le modifiche sono state salvate.' });
      setEditingGoal(null);
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiornare l\'obiettivo', variant: 'destructive' });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/momentum/goals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/goals'] });
      toast({ title: 'Obiettivo eliminato', description: 'L\'obiettivo è stato rimosso.' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile eliminare l\'obiettivo', variant: 'destructive' });
    },
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const response = await fetch(`/api/momentum/goals/${id}/progress`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress }),
      });
      if (!response.ok) throw new Error('Failed to update progress');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/goals'] });
      toast({ title: 'Progresso aggiornato!' });
    },
  });

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewGoal({
      title: '',
      description: '',
      targetDate: '',
      category: '',
      progress: 0,
    });
  };

  const handleCreateGoal = () => {
    if (!newGoal.title.trim()) {
      toast({ title: 'Errore', description: 'Il titolo è obbligatorio', variant: 'destructive' });
      return;
    }

    createGoalMutation.mutate({
      title: newGoal.title.trim(),
      description: newGoal.description.trim() || null,
      targetDate: newGoal.targetDate || null,
      category: newGoal.category.trim() || null,
      progress: newGoal.progress,
    });
  };

  const handleUpdateGoal = () => {
    if (!editingGoal) return;

    updateGoalMutation.mutate({
      id: editingGoal.id,
      data: {
        title: editingGoal.title,
        description: editingGoal.description,
        targetDate: editingGoal.targetDate,
        category: editingGoal.category,
        progress: editingGoal.progress,
        status: editingGoal.status,
      },
    });
  };

  const handleChangeStatus = (goal: Goal, newStatus: 'active' | 'completed' | 'paused') => {
    updateGoalMutation.mutate({
      id: goal.id,
      data: { status: newStatus },
    });
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const isOverdue = goal.targetDate && new Date(goal.targetDate) < new Date() && goal.status !== 'completed';

    return (
      <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                {goal.title}
              </h3>
              {goal.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {goal.description}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {goal.category && (
                  <Badge variant="secondary" className="text-xs">
                    {goal.category}
                  </Badge>
                )}
                {goal.targetDate && (
                  <Badge
                    variant={isOverdue ? 'destructive' : 'outline'}
                    className="text-xs flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    {format(new Date(goal.targetDate), 'dd MMM yyyy', { locale: it })}
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    In ritardo
                  </Badge>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingGoal(goal)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </DropdownMenuItem>
                {goal.status === 'active' && (
                  <>
                    <DropdownMenuItem onClick={() => handleChangeStatus(goal, 'paused')}>
                      <Pause className="h-4 w-4 mr-2" />
                      Metti in pausa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChangeStatus(goal, 'completed')}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Segna come completato
                    </DropdownMenuItem>
                  </>
                )}
                {goal.status === 'paused' && (
                  <DropdownMenuItem onClick={() => handleChangeStatus(goal, 'active')}>
                    <Play className="h-4 w-4 mr-2" />
                    Riprendi
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => deleteGoalMutation.mutate(goal.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progresso
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {goal.progress}%
              </span>
            </div>
            <Progress
              value={goal.progress}
              className={`h-3 ${
                goal.progress === 100
                  ? '[&>div]:bg-green-500'
                  : goal.progress >= 75
                  ? '[&>div]:bg-blue-500'
                  : goal.progress >= 50
                  ? '[&>div]:bg-purple-500'
                  : '[&>div]:bg-orange-500'
              }`}
            />
            {goal.status === 'active' && (
              <Input
                type="number"
                min="0"
                max="100"
                value={goal.progress}
                onChange={(e) => {
                  const newProgress = parseInt(e.target.value) || 0;
                  updateProgressMutation.mutate({ id: goal.id, progress: Math.min(100, Math.max(0, newProgress)) });
                }}
                className="mt-2 h-8 text-sm"
                placeholder="Aggiorna progresso..."
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Plus className="h-4 w-4" />
          Nuovo Obiettivo
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="active">
            Attivi ({activeGoals.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completati ({completedGoals.length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            In Pausa ({pausedGoals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-6">
          {activeGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed">
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Nessun obiettivo attivo
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  Crea il tuo primo obiettivo
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {completedGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nessun obiettivo completato ancora
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paused" className="space-y-4 mt-6">
          {pausedGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pausedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed">
              <CardContent className="text-center py-12">
                <Pause className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nessun obiettivo in pausa
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Goal Modal */}
      <Dialog open={isCreateModalOpen || !!editingGoal} onOpenChange={() => {
        setIsCreateModalOpen(false);
        setEditingGoal(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={editingGoal ? editingGoal.title : newGoal.title}
                onChange={(e) =>
                  editingGoal
                    ? setEditingGoal({ ...editingGoal, title: e.target.value })
                    : setNewGoal({ ...newGoal, title: e.target.value })
                }
                placeholder="Es: Completare il corso di programmazione"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={editingGoal ? (editingGoal.description || '') : newGoal.description}
                onChange={(e) =>
                  editingGoal
                    ? setEditingGoal({ ...editingGoal, description: e.target.value })
                    : setNewGoal({ ...newGoal, description: e.target.value })
                }
                placeholder="Descrivi il tuo obiettivo..."
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={editingGoal ? (editingGoal.category || '') : newGoal.category}
                onChange={(e) =>
                  editingGoal
                    ? setEditingGoal({ ...editingGoal, category: e.target.value })
                    : setNewGoal({ ...newGoal, category: e.target.value })
                }
                placeholder="Es: Carriera, Salute, Finanza..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">Data Obiettivo</Label>
              <Input
                id="targetDate"
                type="date"
                value={editingGoal ? (editingGoal.targetDate || '') : newGoal.targetDate}
                onChange={(e) =>
                  editingGoal
                    ? setEditingGoal({ ...editingGoal, targetDate: e.target.value })
                    : setNewGoal({ ...newGoal, targetDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Progresso Iniziale: {editingGoal ? editingGoal.progress : newGoal.progress}%</Label>
              <Slider
                value={[editingGoal ? editingGoal.progress : newGoal.progress]}
                onValueChange={([value]) =>
                  editingGoal
                    ? setEditingGoal({ ...editingGoal, progress: value })
                    : setNewGoal({ ...newGoal, progress: value })
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingGoal(null);
              }}
            >
              Annulla
            </Button>
            <Button
              onClick={editingGoal ? handleUpdateGoal : handleCreateGoal}
              disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              {editingGoal ? 'Salva Modifiche' : 'Crea Obiettivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
