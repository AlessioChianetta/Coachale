import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, BrainCircuit } from "lucide-react";
import { AIMode } from "./AIAssistant";

interface ModeSelectorProps {
  mode: AIMode;
  setMode: (mode: AIMode) => void;
  variant?: "floating" | "page";
}

export function ModeSelector({ mode, setMode, variant = "floating" }: ModeSelectorProps) {
  // Stili per floating (chat panel che appare ovunque)
  const floatingStyles = {
    tabsList: "grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg",
    assistenzaTrigger: "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-gray-600 dark:text-gray-400 data-[state=active]:shadow-sm transition-all",
    consulenteTrigger: "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400 text-gray-600 dark:text-gray-400 data-[state=active]:shadow-sm transition-all"
  };

  // Stili per pagina dedicata (client-ai-assistant)
  const pageStyles = {
    tabsList: "grid w-full grid-cols-2 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 p-1 h-auto rounded-lg",
    assistenzaTrigger: "data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-700 dark:text-gray-300 transition-all duration-200 py-2.5 rounded-md",
    consulenteTrigger: "data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-700 dark:text-gray-300 transition-all duration-200 py-2.5 rounded-md"
  };

  const styles = variant === "floating" ? floatingStyles : pageStyles;

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as AIMode)} className="w-full">
      <TabsList className={styles.tabsList}>
        <TabsTrigger
          value="assistenza"
          className={styles.assistenzaTrigger}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          <span className="font-medium text-sm">Assistenza</span>
        </TabsTrigger>
        <TabsTrigger
          value="consulente"
          className={styles.consulenteTrigger}
        >
          <BrainCircuit className="h-4 w-4 mr-2" />
          <span className="font-medium text-sm">Consulente</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
