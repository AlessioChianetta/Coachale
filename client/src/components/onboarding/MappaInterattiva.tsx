import { useState } from "react";
import { motion } from "framer-motion";
import {
  Home,
  Sparkles,
  Zap,
  Users,
  Calendar,
  ListTodo,
  Settings,
  MessageSquare,
  UserPlus,
  FileText,
  GraduationCap,
  ClipboardList,
  BookOpen,
  Database,
  Plug,
  Key,
  Mail,
  CalendarDays,
  Bot,
} from "lucide-react";

interface ZoneItem {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface Zone {
  id: string;
  name: string;
  icon: React.ElementType;
  items: ZoneItem[];
  gradient: string;
  borderColor: string;
  iconBg: string;
  gridClass: string;
}

interface MappaInterattivaProps {
  highlightedZones?: string[];
  onZoneClick?: (zoneId: string, itemId?: string) => void;
  selectedZone?: string | null;
}

const zones: Zone[] = [
  {
    id: "principale",
    name: "PRINCIPALE",
    icon: Home,
    items: [
      { id: "dashboard", name: "Dashboard", icon: Home },
      { id: "ai-assistant", name: "AI Assistant", icon: Sparkles },
      { id: "setup-iniziale", name: "Setup Iniziale", icon: Zap },
    ],
    gradient: "from-blue-500/20 to-indigo-500/20 dark:from-blue-500/10 dark:to-indigo-500/10",
    borderColor: "border-blue-400/50 dark:border-blue-500/30",
    iconBg: "bg-blue-500",
    gridClass: "col-span-2 row-span-1",
  },
  {
    id: "lavoro-quotidiano",
    name: "LAVORO QUOTIDIANO",
    icon: Users,
    items: [
      { id: "clienti", name: "Clienti", icon: Users },
      { id: "calendario", name: "Calendario", icon: Calendar },
      { id: "task", name: "Task", icon: ListTodo },
      { id: "email-journey", name: "Email Journey", icon: Sparkles },
    ],
    gradient: "from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10",
    borderColor: "border-purple-400/50 dark:border-purple-500/30",
    iconBg: "bg-purple-500",
    gridClass: "col-span-2 row-span-1",
  },
  {
    id: "comunicazione",
    name: "COMUNICAZIONE",
    icon: MessageSquare,
    items: [
      { id: "setup-agenti", name: "Setup Agenti", icon: Settings },
      { id: "whatsapp", name: "WhatsApp", icon: MessageSquare },
      { id: "lead", name: "Lead", icon: UserPlus },
      { id: "automazioni", name: "Automazioni", icon: Zap },
      { id: "template-comunicazione", name: "Template", icon: FileText },
    ],
    gradient: "from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10",
    borderColor: "border-emerald-400/50 dark:border-emerald-500/30",
    iconBg: "bg-emerald-500",
    gridClass: "col-span-2 row-span-2",
  },
  {
    id: "formazione",
    name: "FORMAZIONE",
    icon: GraduationCap,
    items: [
      { id: "universita", name: "Università", icon: GraduationCap },
      { id: "esercizi", name: "Esercizi", icon: ClipboardList },
      { id: "template-formazione", name: "Template", icon: BookOpen },
      { id: "corsi", name: "Corsi", icon: BookOpen },
    ],
    gradient: "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10",
    borderColor: "border-amber-400/50 dark:border-amber-500/30",
    iconBg: "bg-amber-500",
    gridClass: "col-span-2 row-span-1",
  },
  {
    id: "base-conoscenza",
    name: "BASE DI CONOSCENZA",
    icon: Database,
    items: [
      { id: "documenti", name: "Documenti", icon: FileText },
      { id: "api-esterne", name: "API Esterne", icon: Plug },
    ],
    gradient: "from-cyan-500/20 to-sky-500/20 dark:from-cyan-500/10 dark:to-sky-500/10",
    borderColor: "border-cyan-400/50 dark:border-cyan-500/30",
    iconBg: "bg-cyan-500",
    gridClass: "col-span-1 row-span-1",
  },
  {
    id: "impostazioni",
    name: "IMPOSTAZIONI",
    icon: Settings,
    items: [
      { id: "api-keys", name: "API Keys", icon: Key },
    ],
    gradient: "from-slate-500/20 to-gray-500/20 dark:from-slate-500/10 dark:to-gray-500/10",
    borderColor: "border-slate-400/50 dark:border-slate-500/30",
    iconBg: "bg-slate-500",
    gridClass: "col-span-1 row-span-1",
  },
  {
    id: "guide",
    name: "GUIDE",
    icon: BookOpen,
    items: [
      { id: "guide-whatsapp", name: "WhatsApp", icon: MessageSquare },
      { id: "guide-email", name: "Email", icon: Mail },
      { id: "guide-automazioni", name: "Automazioni", icon: Zap },
      { id: "guide-universita", name: "Università", icon: GraduationCap },
      { id: "guide-clienti", name: "Clienti", icon: Users },
      { id: "guide-calendar", name: "Calendar", icon: CalendarDays },
    ],
    gradient: "from-violet-500/20 to-fuchsia-500/20 dark:from-violet-500/10 dark:to-fuchsia-500/10",
    borderColor: "border-violet-400/50 dark:border-violet-500/30",
    iconBg: "bg-violet-500",
    gridClass: "col-span-2 row-span-1",
  },
  {
    id: "ai-avanzato",
    name: "AI AVANZATO",
    icon: Bot,
    items: [
      { id: "consulenze-ai", name: "Consulenze AI", icon: Sparkles },
    ],
    gradient: "from-rose-500/20 to-red-500/20 dark:from-rose-500/10 dark:to-red-500/10",
    borderColor: "border-rose-400/50 dark:border-rose-500/30",
    iconBg: "bg-rose-500",
    gridClass: "col-span-2 row-span-1",
  },
];

function ZoneCard({
  zone,
  isHighlighted,
  isSelected,
  onClick,
}: {
  zone: Zone;
  isHighlighted: boolean;
  isSelected: boolean;
  onClick: (zoneId: string, itemId?: string) => void;
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const Icon = zone.icon;

  return (
    <motion.div
      className={`${zone.gridClass} relative`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={`
          h-full rounded-2xl border-2 p-4 cursor-pointer overflow-hidden
          bg-gradient-to-br ${zone.gradient}
          ${zone.borderColor}
          ${isSelected ? "ring-2 ring-offset-2 ring-offset-background" : ""}
          ${isHighlighted ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/20" : ""}
          transition-all duration-300
        `}
        whileHover={{ 
          scale: 1.02,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.2)",
        }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick(zone.id)}
        animate={isHighlighted ? {
          boxShadow: [
            "0 0 0 0 rgba(250, 204, 21, 0)",
            "0 0 20px 5px rgba(250, 204, 21, 0.4)",
            "0 0 0 0 rgba(250, 204, 21, 0)",
          ],
        } : {}}
        transition={isHighlighted ? {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        } : {}}
      >
        <div className="flex items-center gap-3 mb-3">
          <motion.div 
            className={`${zone.iconBg} p-2 rounded-xl text-white shadow-lg`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
          <h3 className="font-bold text-sm tracking-wide text-foreground/90">
            {zone.name}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {zone.items.map((item) => {
            const ItemIcon = item.icon;
            const isItemHovered = hoveredItem === item.id;

            return (
              <motion.button
                key={item.id}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-white/60 dark:bg-black/30 backdrop-blur-sm
                  border border-white/40 dark:border-white/10
                  hover:bg-white/90 dark:hover:bg-black/50
                  transition-colors duration-200
                  ${isItemHovered ? "ring-1 ring-offset-1 ring-current" : ""}
                `}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(zone.id, item.id);
                }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <ItemIcon className="h-3.5 w-3.5" />
                <span>{item.name}</span>
              </motion.button>
            );
          })}
        </div>

        {isSelected && (
          <motion.div
            className="absolute inset-0 border-2 border-primary rounded-2xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            layoutId="selected-zone"
          />
        )}
      </motion.div>
    </motion.div>
  );
}

export default function MappaInterattiva({
  highlightedZones = [],
  onZoneClick,
  selectedZone,
}: MappaInterattivaProps) {
  const [internalSelectedZone, setInternalSelectedZone] = useState<string | null>(null);
  
  const currentSelectedZone = selectedZone !== undefined ? selectedZone : internalSelectedZone;

  const handleZoneClick = (zoneId: string, itemId?: string) => {
    setInternalSelectedZone(zoneId);
    onZoneClick?.(zoneId, itemId);
  };

  return (
    <div className="w-full">
      <motion.div 
        className="grid grid-cols-4 gap-4 auto-rows-min"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            isHighlighted={highlightedZones.includes(zone.id)}
            isSelected={currentSelectedZone === zone.id}
            onClick={handleZoneClick}
          />
        ))}
      </motion.div>

      <motion.div 
        className="mt-6 p-4 rounded-xl bg-muted/50 border"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-sm text-muted-foreground text-center">
          Clicca su una zona per esplorare le funzionalità della piattaforma.
          {highlightedZones.length > 0 && (
            <span className="block mt-1 font-medium text-yellow-600 dark:text-yellow-400">
              Le zone evidenziate richiedono la tua attenzione.
            </span>
          )}
        </p>
      </motion.div>
    </div>
  );
}
