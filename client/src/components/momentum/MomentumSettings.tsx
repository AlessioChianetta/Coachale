import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { Settings, Bell, Moon, Tag, Save, X, Plus } from 'lucide-react';

interface MomentumSettings {
  userId: string;
  checkinIntervalMinutes: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationsEnabled: boolean;
  defaultProductiveCategories: string[];
  defaultBreakCategories: string[];
}

export default function MomentumSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localSettings, setLocalSettings] = useState<MomentumSettings | null>(null);
  const [newProductiveCategory, setNewProductiveCategory] = useState('');
  const [newBreakCategory, setNewBreakCategory] = useState('');

  // Fetch settings
  const { data: settings, isLoading } = useQuery<MomentumSettings>({
    queryKey: ['/api/momentum/settings'],
    queryFn: async () => {
      const response = await fetch('/api/momentum/settings', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<MomentumSettings>) => {
      const response = await fetch('/api/momentum/settings', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/momentum/settings'] });
      toast({
        title: 'Impostazioni salvate!',
        description: 'Le tue preferenze sono state aggiornate.',
      });
    },
    onError: () => {
      toast({
        title: 'Errore',
        description: 'Impossibile salvare le impostazioni',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!localSettings) return;

    updateSettingsMutation.mutate({
      checkinIntervalMinutes: localSettings.checkinIntervalMinutes,
      quietHoursEnabled: localSettings.quietHoursEnabled,
      quietHoursStart: localSettings.quietHoursStart,
      quietHoursEnd: localSettings.quietHoursEnd,
      notificationsEnabled: localSettings.notificationsEnabled,
      defaultProductiveCategories: localSettings.defaultProductiveCategories,
      defaultBreakCategories: localSettings.defaultBreakCategories,
    });
  };

  const handleAddProductiveCategory = () => {
    if (!newProductiveCategory.trim() || !localSettings) return;

    if (localSettings.defaultProductiveCategories.includes(newProductiveCategory.trim())) {
      toast({
        title: 'Categoria già presente',
        description: 'Questa categoria è già nella lista',
        variant: 'destructive',
      });
      return;
    }

    setLocalSettings({
      ...localSettings,
      defaultProductiveCategories: [
        ...localSettings.defaultProductiveCategories,
        newProductiveCategory.trim(),
      ],
    });
    setNewProductiveCategory('');
  };

  const handleRemoveProductiveCategory = (category: string) => {
    if (!localSettings) return;
    setLocalSettings({
      ...localSettings,
      defaultProductiveCategories: localSettings.defaultProductiveCategories.filter(
        (c) => c !== category
      ),
    });
  };

  const handleAddBreakCategory = () => {
    if (!newBreakCategory.trim() || !localSettings) return;

    if (localSettings.defaultBreakCategories.includes(newBreakCategory.trim())) {
      toast({
        title: 'Categoria già presente',
        description: 'Questa categoria è già nella lista',
        variant: 'destructive',
      });
      return;
    }

    setLocalSettings({
      ...localSettings,
      defaultBreakCategories: [
        ...localSettings.defaultBreakCategories,
        newBreakCategory.trim(),
      ],
    });
    setNewBreakCategory('');
  };

  const handleRemoveBreakCategory = (category: string) => {
    if (!localSettings) return;
    setLocalSettings({
      ...localSettings,
      defaultBreakCategories: localSettings.defaultBreakCategories.filter(
        (c) => c !== category
      ),
    });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {/* Notifiche Check-in */}
      <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Notifiche Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div>
                <Label className="text-base font-semibold">Abilita Notifiche</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ricevi promemoria automatici per registrare le tue attività
                </p>
              </div>
              <Switch
                checked={localSettings.notificationsEnabled}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, notificationsEnabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">Intervallo tra Check-in</Label>
              <Select
                value={localSettings.checkinIntervalMinutes.toString()}
                onValueChange={(value) =>
                  setLocalSettings({
                    ...localSettings,
                    checkinIntervalMinutes: parseInt(value),
                  })
                }
              >
                <SelectTrigger id="interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minuti</SelectItem>
                  <SelectItem value="60">1 ora</SelectItem>
                  <SelectItem value="90">1.5 ore</SelectItem>
                  <SelectItem value="120">2 ore</SelectItem>
                  <SelectItem value="180">3 ore</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Riceverai un promemoria ogni {localSettings.checkinIntervalMinutes} minuti
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-purple-600" />
              Ore Silenziose
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div>
                <Label className="text-base font-semibold">Abilita Ore Silenziose</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Non ricevere notifiche durante orari specifici
                </p>
              </div>
              <Switch
                checked={localSettings.quietHoursEnabled}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, quietHoursEnabled: checked })
                }
              />
            </div>

            {localSettings.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quietStart">Inizio</Label>
                  <Input
                    id="quietStart"
                    type="time"
                    value={localSettings.quietHoursStart}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        quietHoursStart: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quietEnd">Fine</Label>
                  <Input
                    id="quietEnd"
                    type="time"
                    value={localSettings.quietHoursEnd}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        quietHoursEnd: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categorie Personalizzate */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-green-600" />
              Categorie Personalizzate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Categorie Produttive */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Categorie Produttive</Label>
              <div className="flex flex-wrap gap-2">
                {localSettings.defaultProductiveCategories.map((category) => (
                  <Badge
                    key={category}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer transition-colors"
                    onClick={() => handleRemoveProductiveCategory(category)}
                  >
                    {category}
                    <X className="h-3 w-3 ml-1.5" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Aggiungi categoria produttiva..."
                  value={newProductiveCategory}
                  onChange={(e) => setNewProductiveCategory(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddProductiveCategory();
                    }
                  }}
                />
                <Button
                  onClick={handleAddProductiveCategory}
                  variant="outline"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Categorie Pause */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Categorie Pause</Label>
              <div className="flex flex-wrap gap-2">
                {localSettings.defaultBreakCategories.map((category) => (
                  <Badge
                    key={category}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer transition-colors"
                    onClick={() => handleRemoveBreakCategory(category)}
                  >
                    {category}
                    <X className="h-3 w-3 ml-1.5" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Aggiungi categoria pausa..."
                  value={newBreakCategory}
                  onChange={(e) => setNewBreakCategory(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBreakCategory();
                    }
                  }}
                />
                <Button onClick={handleAddBreakCategory} variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Save className="h-4 w-4" />
          {updateSettingsMutation.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
        </Button>
      </div>
    </>
  );
}
