import { useState, useEffect } from "react";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { Sparkles, Heart, Trophy, TrendingUp, Save, Check, Lightbulb, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyReflection } from "@shared/schema";

interface DailyReflectionFormProps {
  reflection?: DailyReflection;
  onSave: (data: {
    date: string;
    grateful: string[];
    makeGreat: string[];
    doBetter: string;
  }) => void;
  onDelete?: (reflectionId: string) => void;
  selectedDate?: Date;
}

export default function DailyReflectionForm({ reflection, onSave, onDelete, selectedDate = new Date() }: DailyReflectionFormProps) {
  const [grateful, setGrateful] = useState<string[]>(["", "", ""]);
  const [makeGreat, setMakeGreat] = useState<string[]>(["", "", ""]);
  const [doBetter, setDoBetter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Reset form when reflection or date changes
  useEffect(() => {
    if (reflection) {
      // Ensure we always have 3 elements, padding with empty strings if needed
      const gratefulArray = [...(reflection.grateful || []), "", "", ""].slice(0, 3);
      const makeGreatArray = [...(reflection.makeGreat || []), "", "", ""].slice(0, 3);
      
      setGrateful(gratefulArray);
      setMakeGreat(makeGreatArray);
      setDoBetter(reflection.doBetter || "");
    } else {
      setGrateful(["", "", ""]);
      setMakeGreat(["", "", ""]);
      setDoBetter("");
    }
    setSaved(false);
  }, [reflection, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const data = {
      date: format(selectedDate, "yyyy-MM-dd"),
      grateful: grateful.filter(item => item.trim() !== ""),
      makeGreat: makeGreat.filter(item => item.trim() !== ""),
      doBetter: doBetter.trim(),
    };

    await onSave(data);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isFormValid = () => {
    const hasGrateful = grateful.some(item => item.trim() !== "");
    const hasMakeGreat = makeGreat.some(item => item.trim() !== "");
    const hasDoBetter = doBetter.trim() !== "";
    return hasGrateful || hasMakeGreat || hasDoBetter;
  };

  return (
    <Card className="shadow-lg border-0 overflow-hidden" data-tour="reflections-form">
      <CardHeader className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950 dark:via-pink-950 dark:to-orange-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-md">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Riflessioni Giornaliere
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Grateful Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-pink-100 dark:bg-pink-900 rounded-lg">
                <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">3 Cose di cui sono grato</h3>
                <p className="text-sm text-muted-foreground">Riconosci le cose positive della tua vita</p>
              </div>
            </div>
            <div className="space-y-3 pl-1">
              {grateful.map((item, index) => (
                <div key={`grateful-${index}`} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white font-semibold text-sm shadow-sm flex-shrink-0">
                    {index + 1}
                  </div>
                  <Input
                    placeholder={`Es: ${index === 0 ? "La mia famiglia" : index === 1 ? "La mia salute" : "Le opportunità che ho"}`}
                    value={item}
                    onChange={(e) => {
                      const newGrateful = [...grateful];
                      newGrateful[index] = e.target.value;
                      setGrateful(newGrateful);
                    }}
                    className="flex-1 border-2 focus:border-pink-400 transition-colors h-11"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Make Great Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">3 Cose che renderebbero oggi grandioso</h3>
                <p className="text-sm text-muted-foreground">Definisci i tuoi obiettivi per oggi</p>
              </div>
            </div>
            <div className="space-y-3 pl-1">
              {makeGreat.map((item, index) => (
                <div key={`makeGreat-${index}`} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 text-white font-semibold text-sm shadow-sm flex-shrink-0">
                    {index + 1}
                  </div>
                  <Input
                    placeholder={`Es: ${index === 0 ? "Completare il progetto X" : index === 1 ? "Fare 30 minuti di esercizio" : "Passare tempo con la famiglia"}`}
                    value={item}
                    onChange={(e) => {
                      const newMakeGreat = [...makeGreat];
                      newMakeGreat[index] = e.target.value;
                      setMakeGreat(newMakeGreat);
                    }}
                    className="flex-1 border-2 focus:border-yellow-400 transition-colors h-11"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Do Better Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Cosa potrei fare meglio?</h3>
                <p className="text-sm text-muted-foreground">Rifletti su come migliorare</p>
              </div>
            </div>
            <div className="pl-1">
              <Textarea
                placeholder="Es: Gestire meglio il mio tempo, essere più presente nelle conversazioni, prendermi cura della mia salute..."
                value={doBetter}
                onChange={(e) => {
                  setDoBetter(e.target.value);
                }}
                rows={5}
                className="border-2 focus:border-blue-400 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Submit and Delete buttons */}
          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              disabled={!isFormValid() || isSaving}
              className="w-full h-12 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 text-base"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5 animate-spin" />
                  <span>Salvataggio...</span>
                </div>
              ) : saved ? (
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  <span>Salvato!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  <span>Salva Riflessioni</span>
                </div>
              )}
            </Button>

            {reflection && onDelete && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full h-11 border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 font-medium transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    <span>Elimina Riflessione</span>
                  </div>
                </Button>

                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questa azione eliminerà definitivamente la riflessione del {format(selectedDate, "d MMMM yyyy", { locale: it })}. 
                        Non sarà possibile recuperarla.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          setIsDeleting(true);
                          setShowDeleteDialog(false);
                          await onDelete(reflection.id);
                          setIsDeleting(false);
                        }}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isDeleting ? "Eliminazione..." : "Elimina"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Suggerimento</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Compilare le riflessioni giornaliere ti aiuta a mantenere il focus sui tuoi obiettivi e a sviluppare una mentalità positiva. Dedica 5 minuti ogni giorno per questa pratica.
                </p>
              </div>
            </div>
          </div>
        </form>

        {reflection && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Ultima modifica: {reflection.updatedAt ? format(new Date(reflection.updatedAt), "HH:mm", { locale: it }) : "N/A"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
