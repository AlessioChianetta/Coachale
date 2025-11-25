import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Trash2, Edit, Play, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CustomPrompt {
  id: string;
  clientId: string;
  name: string;
  promptText: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomPromptEditorProps {
  onBack: () => void;
  onStartSession: (customPromptText: string) => void;
}

export function CustomPromptEditor({ onBack, onStartSession }: CustomPromptEditorProps) {
  const { toast } = useToast();
  
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/live-prompts', {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) throw new Error('Failed to load prompts');
      
      const data = await response.json();
      setPrompts(data);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile caricare i prompt salvati',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!promptName.trim() || !promptText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Nome e testo del prompt sono obbligatori',
      });
      throw new Error('Validation failed');
    }

    if (promptName.length > 100) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Il nome deve essere massimo 100 caratteri',
      });
      throw new Error('Validation failed');
    }

    if (promptText.length > 10000) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Il testo del prompt deve essere massimo 10000 caratteri',
      });
      throw new Error('Validation failed');
    }

    try {
      setIsSaving(true);

      if (isEditing && selectedPromptId) {
        // Update existing prompt
        const response = await fetch(`/api/live-prompts/${selectedPromptId}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: promptName, promptText }),
        });

        if (!response.ok) throw new Error('Failed to update prompt');

        toast({
          title: '✅ Salvato',
          description: 'Prompt aggiornato con successo',
        });
      } else {
        // Create new prompt
        const response = await fetch('/api/live-prompts', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: promptName, promptText }),
        });

        if (!response.ok) throw new Error('Failed to create prompt');

        toast({
          title: '✅ Salvato',
          description: 'Nuovo prompt creato con successo',
        });
      }

      // Reload prompts
      await loadPrompts();

      // Reset form
      setPromptName('');
      setPromptText('');
      setIsEditing(false);
      setSelectedPromptId(null);
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile salvare il prompt',
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (prompt: CustomPrompt) => {
    setSelectedPromptId(prompt.id);
    setPromptName(prompt.name);
    setPromptText(prompt.promptText);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/live-prompts/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete prompt');

      toast({
        title: '🗑️ Eliminato',
        description: 'Prompt eliminato con successo',
      });

      // Reload prompts
      await loadPrompts();

      // If we were editing this prompt, clear the form
      if (selectedPromptId === id) {
        setPromptName('');
        setPromptText('');
        setIsEditing(false);
        setSelectedPromptId(null);
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile eliminare il prompt',
      });
    } finally {
      setDeletingPromptId(null);
    }
  };

  const handleStartWithPrompt = async () => {
    if (!promptText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Inserisci un prompt prima di avviare la sessione',
      });
      return;
    }

    if (promptText.length > 10000) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Il prompt è troppo lungo (massimo 10000 caratteri)',
      });
      return;
    }

    // If we have unsaved changes, save them first
    if (promptName.trim() && (isEditing || !selectedPromptId)) {
      try {
        await handleSave();
        // Use the saved prompt text
        onStartSession(promptText);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile salvare il prompt. Riprova.',
        });
      }
    } else {
      // No unsaved changes, start directly
      onStartSession(promptText);
    }
  };

  const handleNewPrompt = () => {
    setPromptName('');
    setPromptText('');
    setIsEditing(false);
    setSelectedPromptId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center p-4 sm:p-8">
      <Button
        variant="ghost"
        onClick={onBack}
        className="absolute top-6 left-6 text-white/70 hover:text-white hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Indietro
      </Button>

      <div className="max-w-6xl w-full mt-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            ✏️ Custom Live Prompt
          </h1>
          <p className="text-xl text-white/70">
            Personalizza il comportamento dell'AI durante la sessione vocale
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">
                  {isEditing ? 'Modifica Prompt' : 'Nuovo Prompt'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-white/70 mb-2 block">
                    Nome Prompt
                  </label>
                  <Input
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    placeholder="es. Consulenza Aggressiva"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    maxLength={100}
                  />
                  <span className="text-xs text-white/50 mt-1">
                    {promptName.length}/100 caratteri
                  </span>
                </div>

                <div>
                  <label className="text-sm text-white/70 mb-2 block">
                    Testo del Prompt
                  </label>
                  <Textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Sei un consulente esperto in...&#10;&#10;Il tuo ruolo è:&#10;- Guidare la conversazione&#10;- Fare domande specifiche&#10;- ..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[300px] font-mono text-sm"
                    maxLength={10000}
                  />
                  <span className="text-xs text-white/50 mt-1">
                    {promptText.length}/10000 caratteri
                  </span>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !promptName.trim() || !promptText.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvataggio...' : 'Salva'}
                  </Button>

                  {isEditing && (
                    <Button
                      onClick={handleNewPrompt}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Nuovo
                    </Button>
                  )}
                </div>

                <Button
                  onClick={handleStartWithPrompt}
                  disabled={!promptText.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia Sessione con questo Prompt
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Saved Prompts Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 border-white/10 h-full">
              <CardHeader>
                <CardTitle className="text-white">Prompt Salvati</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center text-white/50 py-8">
                    Caricamento...
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="text-center text-white/50 py-8">
                    Nessun prompt salvato ancora.
                    <br />
                    Crea il tuo primo prompt personalizzato!
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {prompts.map((prompt) => (
                        <div
                          key={prompt.id}
                          className={`p-4 rounded-lg border transition-all ${
                            selectedPromptId === prompt.id
                              ? 'bg-white/15 border-white/30'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-white">{prompt.name}</h4>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(prompt)}
                                className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-white/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingPromptId(prompt.id)}
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-white/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-white/60 line-clamp-3">
                            {prompt.promptText}
                          </p>
                          <div className="text-xs text-white/40 mt-2">
                            Creato: {new Date(prompt.createdAt).toLocaleDateString('it-IT')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPromptId} onOpenChange={() => setDeletingPromptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo prompt? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPromptId && handleDelete(deletingPromptId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
