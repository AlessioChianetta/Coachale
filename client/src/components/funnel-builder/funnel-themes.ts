import type { NodeCategory } from "./funnel-node-types";

export type FunnelThemeId = "classico" | "minecraft" | "neon" | "corporate" | "natura" | "retro";

export interface FunnelTheme {
  id: FunnelThemeId;
  label: string;
  description: string;
  preview: string[];
  canvas: {
    bg: string;
    dotColor: string;
    dotSize: number;
    dotGap: number;
  };
  node: {
    borderRadius: string;
    borderWidth: string;
    shadow: string;
    selectedRing: string;
    textColor: string;
    subtitleColor: string;
    fontFamily?: string;
  };
  edge: {
    color: string;
    selectedColor: string;
    strokeWidth: number;
    animated: boolean;
    animationColor: string;
  };
  categoryColors: Record<NodeCategory, { bg: string; border: string; text: string; accent: string }>;
  handle: {
    bg: string;
    border: string;
  };
  badge: {
    bg: string;
    text: string;
    border: string;
  };
  entityPreview: {
    bg: string;
    border: string;
    text: string;
  };
}

export const FUNNEL_THEMES: Record<FunnelThemeId, FunnelTheme> = {
  classico: {
    id: "classico",
    label: "Classico",
    description: "Pulito e professionale",
    preview: ["#3b82f6", "#22c55e", "#8b5cf6", "#f97316"],
    canvas: { bg: "bg-gray-50 dark:bg-gray-950", dotColor: "#d1d5db", dotSize: 1, dotGap: 20 },
    node: {
      borderRadius: "rounded-lg",
      borderWidth: "border-2",
      shadow: "shadow-md",
      selectedRing: "ring-blue-500",
      textColor: "text-gray-900 dark:text-gray-100",
      subtitleColor: "text-gray-500 dark:text-gray-400",
    },
    edge: { color: "#94a3b8", selectedColor: "#6366f1", strokeWidth: 2, animated: true, animationColor: "#6366f1" },
    categoryColors: {
      sorgenti: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-400 dark:border-blue-500", text: "text-blue-700 dark:text-blue-300", accent: "#3b82f6" },
      cattura: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-400 dark:border-green-500", text: "text-green-700 dark:text-green-300", accent: "#22c55e" },
      gestione: { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-400 dark:border-violet-500", text: "text-violet-700 dark:text-violet-300", accent: "#8b5cf6" },
      comunicazione: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-400 dark:border-indigo-500", text: "text-indigo-700 dark:text-indigo-300", accent: "#6366f1" },
      conversione: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-400 dark:border-orange-500", text: "text-orange-700 dark:text-orange-300", accent: "#f97316" },
      delivery: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-400 dark:border-emerald-500", text: "text-emerald-700 dark:text-emerald-300", accent: "#10b981" },
      custom: { bg: "bg-gray-50 dark:bg-gray-800/40", border: "border-gray-400 dark:border-gray-500", text: "text-gray-700 dark:text-gray-300", accent: "#6b7280" },
    },
    handle: { bg: "!bg-gray-400 dark:!bg-gray-500", border: "!border-white dark:!border-gray-800" },
    badge: { bg: "bg-secondary", text: "text-secondary-foreground", border: "border-border" },
    entityPreview: { bg: "bg-white/60 dark:bg-gray-800/60", border: "border-gray-200 dark:border-gray-700", text: "text-gray-700 dark:text-gray-300" },
  },

  minecraft: {
    id: "minecraft",
    label: "Minecraft",
    description: "Pixel art e blocchi squadrati",
    preview: ["#5d8a3c", "#8b6914", "#4a6fa5", "#c44b3f"],
    canvas: { bg: "bg-[#8fbc6b] dark:bg-[#2d4a1e]", dotColor: "#6b9e4b", dotSize: 2, dotGap: 16 },
    node: {
      borderRadius: "rounded-none",
      borderWidth: "border-[3px]",
      shadow: "shadow-[4px_4px_0px_rgba(0,0,0,0.3)]",
      selectedRing: "ring-yellow-400",
      textColor: "text-[#3b2a1a] dark:text-[#e8d5b0]",
      subtitleColor: "text-[#6b5a4a] dark:text-[#b8a890]",
      fontFamily: "font-mono",
    },
    edge: { color: "#6b5a4a", selectedColor: "#c44b3f", strokeWidth: 3, animated: false, animationColor: "#c44b3f" },
    categoryColors: {
      sorgenti: { bg: "bg-[#6b9bd2]/20 dark:bg-[#4a6fa5]/30", border: "border-[#4a6fa5]", text: "text-[#4a6fa5] dark:text-[#8bb8e8]", accent: "#4a6fa5" },
      cattura: { bg: "bg-[#5d8a3c]/20 dark:bg-[#5d8a3c]/30", border: "border-[#5d8a3c]", text: "text-[#5d8a3c] dark:text-[#8fbc6b]", accent: "#5d8a3c" },
      gestione: { bg: "bg-[#8b6914]/20 dark:bg-[#8b6914]/30", border: "border-[#8b6914]", text: "text-[#8b6914] dark:text-[#d4a832]", accent: "#8b6914" },
      comunicazione: { bg: "bg-[#6a5acd]/20 dark:bg-[#6a5acd]/30", border: "border-[#6a5acd]", text: "text-[#6a5acd] dark:text-[#9d8fef]", accent: "#6a5acd" },
      conversione: { bg: "bg-[#c44b3f]/20 dark:bg-[#c44b3f]/30", border: "border-[#c44b3f]", text: "text-[#c44b3f] dark:text-[#e87870]", accent: "#c44b3f" },
      delivery: { bg: "bg-[#2e8b57]/20 dark:bg-[#2e8b57]/30", border: "border-[#2e8b57]", text: "text-[#2e8b57] dark:text-[#5cbf82]", accent: "#2e8b57" },
      custom: { bg: "bg-[#808080]/20 dark:bg-[#808080]/30", border: "border-[#808080]", text: "text-[#808080] dark:text-[#b0b0b0]", accent: "#808080" },
    },
    handle: { bg: "!bg-[#6b5a4a]", border: "!border-[#3b2a1a] dark:!border-[#1a1008]" },
    badge: { bg: "bg-[#8b6914]/20", text: "text-[#3b2a1a] dark:text-[#d4a832]", border: "border-[#8b6914]/40" },
    entityPreview: { bg: "bg-[#d4c4a0]/30 dark:bg-[#3b2a1a]/50", border: "border-[#8b6914]/40 dark:border-[#6b5a4a]", text: "text-[#3b2a1a] dark:text-[#d4a832]" },
  },

  neon: {
    id: "neon",
    label: "Neon",
    description: "Cyberpunk con bordi luminosi",
    preview: ["#00f0ff", "#ff00e5", "#39ff14", "#ff6b00"],
    canvas: { bg: "bg-[#0a0a1a] dark:bg-[#050510]", dotColor: "#1a1a3a", dotSize: 1, dotGap: 24 },
    node: {
      borderRadius: "rounded-xl",
      borderWidth: "border-2",
      shadow: "shadow-[0_0_15px_rgba(0,240,255,0.15)]",
      selectedRing: "ring-[#ff00e5]",
      textColor: "text-white",
      subtitleColor: "text-gray-400",
    },
    edge: { color: "#00f0ff60", selectedColor: "#ff00e5", strokeWidth: 2, animated: true, animationColor: "#00f0ff" },
    categoryColors: {
      sorgenti: { bg: "bg-[#00f0ff]/10", border: "border-[#00f0ff]/60", text: "text-[#00f0ff]", accent: "#00f0ff" },
      cattura: { bg: "bg-[#39ff14]/10", border: "border-[#39ff14]/60", text: "text-[#39ff14]", accent: "#39ff14" },
      gestione: { bg: "bg-[#bf5fff]/10", border: "border-[#bf5fff]/60", text: "text-[#bf5fff]", accent: "#bf5fff" },
      comunicazione: { bg: "bg-[#ff00e5]/10", border: "border-[#ff00e5]/60", text: "text-[#ff00e5]", accent: "#ff00e5" },
      conversione: { bg: "bg-[#ff6b00]/10", border: "border-[#ff6b00]/60", text: "text-[#ff6b00]", accent: "#ff6b00" },
      delivery: { bg: "bg-[#00ff88]/10", border: "border-[#00ff88]/60", text: "text-[#00ff88]", accent: "#00ff88" },
      custom: { bg: "bg-white/5", border: "border-white/30", text: "text-white/70", accent: "#ffffff80" },
    },
    handle: { bg: "!bg-[#00f0ff]", border: "!border-[#0a0a1a]" },
    badge: { bg: "bg-white/10", text: "text-[#00f0ff]", border: "border-[#00f0ff]/30" },
    entityPreview: { bg: "bg-white/5", border: "border-white/10", text: "text-white/80" },
  },

  corporate: {
    id: "corporate",
    label: "Corporate",
    description: "Minimalista e formale",
    preview: ["#1e3a5f", "#4a7fb5", "#6b7280", "#334155"],
    canvas: { bg: "bg-[#f8fafc] dark:bg-[#0f172a]", dotColor: "#e2e8f0", dotSize: 1, dotGap: 28 },
    node: {
      borderRadius: "rounded-md",
      borderWidth: "border",
      shadow: "shadow-sm",
      selectedRing: "ring-[#1e3a5f]",
      textColor: "text-[#1e293b] dark:text-[#e2e8f0]",
      subtitleColor: "text-[#64748b] dark:text-[#94a3b8]",
    },
    edge: { color: "#cbd5e1", selectedColor: "#1e3a5f", strokeWidth: 1.5, animated: false, animationColor: "#1e3a5f" },
    categoryColors: {
      sorgenti: { bg: "bg-[#1e3a5f]/8 dark:bg-[#1e3a5f]/20", border: "border-[#1e3a5f]/40", text: "text-[#1e3a5f] dark:text-[#93c5fd]", accent: "#1e3a5f" },
      cattura: { bg: "bg-[#166534]/8 dark:bg-[#166534]/20", border: "border-[#166534]/40", text: "text-[#166534] dark:text-[#86efac]", accent: "#166534" },
      gestione: { bg: "bg-[#4a5568]/8 dark:bg-[#4a5568]/20", border: "border-[#4a5568]/40", text: "text-[#4a5568] dark:text-[#a0aec0]", accent: "#4a5568" },
      comunicazione: { bg: "bg-[#4a7fb5]/8 dark:bg-[#4a7fb5]/20", border: "border-[#4a7fb5]/40", text: "text-[#4a7fb5] dark:text-[#93c5fd]", accent: "#4a7fb5" },
      conversione: { bg: "bg-[#92400e]/8 dark:bg-[#92400e]/20", border: "border-[#92400e]/40", text: "text-[#92400e] dark:text-[#fbbf24]", accent: "#92400e" },
      delivery: { bg: "bg-[#065f46]/8 dark:bg-[#065f46]/20", border: "border-[#065f46]/40", text: "text-[#065f46] dark:text-[#6ee7b7]", accent: "#065f46" },
      custom: { bg: "bg-[#475569]/8 dark:bg-[#475569]/20", border: "border-[#475569]/40", text: "text-[#475569] dark:text-[#94a3b8]", accent: "#475569" },
    },
    handle: { bg: "!bg-[#94a3b8]", border: "!border-[#f8fafc] dark:!border-[#0f172a]" },
    badge: { bg: "bg-[#f1f5f9]", text: "text-[#475569]", border: "border-[#e2e8f0]" },
    entityPreview: { bg: "bg-[#f1f5f9]/80 dark:bg-[#1e293b]/60", border: "border-[#e2e8f0] dark:border-[#334155]", text: "text-[#475569] dark:text-[#94a3b8]" },
  },

  natura: {
    id: "natura",
    label: "Natura",
    description: "Toni verdi e terra",
    preview: ["#2d6a4f", "#b7791f", "#6b4423", "#1b4332"],
    canvas: { bg: "bg-[#f0f7f0] dark:bg-[#0a1f0a]", dotColor: "#c1d9c1", dotSize: 1.5, dotGap: 22 },
    node: {
      borderRadius: "rounded-2xl",
      borderWidth: "border-2",
      shadow: "shadow-md shadow-green-900/5",
      selectedRing: "ring-[#2d6a4f]",
      textColor: "text-[#1b4332] dark:text-[#d8f3dc]",
      subtitleColor: "text-[#52796f] dark:text-[#95d5b2]",
    },
    edge: { color: "#74c69d80", selectedColor: "#2d6a4f", strokeWidth: 2, animated: true, animationColor: "#40916c" },
    categoryColors: {
      sorgenti: { bg: "bg-[#d8f3dc]/60 dark:bg-[#1b4332]/40", border: "border-[#52b788]", text: "text-[#2d6a4f] dark:text-[#95d5b2]", accent: "#40916c" },
      cattura: { bg: "bg-[#fef3c7]/60 dark:bg-[#78350f]/20", border: "border-[#b7791f]", text: "text-[#92400e] dark:text-[#fbbf24]", accent: "#b7791f" },
      gestione: { bg: "bg-[#d4a574]/20 dark:bg-[#6b4423]/30", border: "border-[#6b4423]", text: "text-[#6b4423] dark:text-[#d4a574]", accent: "#6b4423" },
      comunicazione: { bg: "bg-[#b7e4c7]/40 dark:bg-[#1b4332]/30", border: "border-[#2d6a4f]", text: "text-[#1b4332] dark:text-[#b7e4c7]", accent: "#2d6a4f" },
      conversione: { bg: "bg-[#fde68a]/30 dark:bg-[#78350f]/20", border: "border-[#d97706]", text: "text-[#92400e] dark:text-[#fbbf24]", accent: "#d97706" },
      delivery: { bg: "bg-[#a7f3d0]/30 dark:bg-[#064e3b]/30", border: "border-[#059669]", text: "text-[#065f46] dark:text-[#6ee7b7]", accent: "#059669" },
      custom: { bg: "bg-[#e5e7eb]/40 dark:bg-[#374151]/30", border: "border-[#6b7280]", text: "text-[#6b7280] dark:text-[#9ca3af]", accent: "#6b7280" },
    },
    handle: { bg: "!bg-[#40916c]", border: "!border-[#f0f7f0] dark:!border-[#0a1f0a]" },
    badge: { bg: "bg-[#d8f3dc]/60", text: "text-[#2d6a4f]", border: "border-[#95d5b2]/40" },
    entityPreview: { bg: "bg-[#d8f3dc]/30 dark:bg-[#1b4332]/30", border: "border-[#95d5b2]/40 dark:border-[#2d6a4f]/60", text: "text-[#2d6a4f] dark:text-[#95d5b2]" },
  },

  retro: {
    id: "retro",
    label: "Retro",
    description: "Colori pastello stile anni '80",
    preview: ["#ff6b9d", "#c084fc", "#67e8f9", "#fde047"],
    canvas: { bg: "bg-[#fdf4ff] dark:bg-[#1a0a2e]", dotColor: "#e9d5ff", dotSize: 1.5, dotGap: 18 },
    node: {
      borderRadius: "rounded-xl",
      borderWidth: "border-2",
      shadow: "shadow-[3px_3px_0px_rgba(168,85,247,0.2)]",
      selectedRing: "ring-[#c084fc]",
      textColor: "text-[#581c87] dark:text-[#e9d5ff]",
      subtitleColor: "text-[#7c3aed] dark:text-[#c084fc]",
    },
    edge: { color: "#c084fc60", selectedColor: "#ff6b9d", strokeWidth: 2.5, animated: true, animationColor: "#c084fc" },
    categoryColors: {
      sorgenti: { bg: "bg-[#67e8f9]/20 dark:bg-[#0e7490]/20", border: "border-[#22d3ee]", text: "text-[#0e7490] dark:text-[#67e8f9]", accent: "#22d3ee" },
      cattura: { bg: "bg-[#86efac]/20 dark:bg-[#166534]/20", border: "border-[#4ade80]", text: "text-[#166534] dark:text-[#86efac]", accent: "#4ade80" },
      gestione: { bg: "bg-[#c084fc]/20 dark:bg-[#7c3aed]/20", border: "border-[#a855f7]", text: "text-[#7c3aed] dark:text-[#c084fc]", accent: "#a855f7" },
      comunicazione: { bg: "bg-[#ff6b9d]/15 dark:bg-[#be185d]/20", border: "border-[#f472b6]", text: "text-[#be185d] dark:text-[#f9a8d4]", accent: "#f472b6" },
      conversione: { bg: "bg-[#fde047]/20 dark:bg-[#a16207]/20", border: "border-[#facc15]", text: "text-[#a16207] dark:text-[#fde047]", accent: "#facc15" },
      delivery: { bg: "bg-[#fb923c]/15 dark:bg-[#c2410c]/20", border: "border-[#fb923c]", text: "text-[#c2410c] dark:text-[#fdba74]", accent: "#fb923c" },
      custom: { bg: "bg-[#d8b4fe]/15 dark:bg-[#581c87]/20", border: "border-[#d8b4fe]", text: "text-[#581c87] dark:text-[#d8b4fe]", accent: "#d8b4fe" },
    },
    handle: { bg: "!bg-[#c084fc]", border: "!border-[#fdf4ff] dark:!border-[#1a0a2e]" },
    badge: { bg: "bg-[#e9d5ff]/40", text: "text-[#7c3aed]", border: "border-[#c084fc]/30" },
    entityPreview: { bg: "bg-[#fdf4ff]/60 dark:bg-[#2e1065]/30", border: "border-[#e9d5ff]/50 dark:border-[#7c3aed]/30", text: "text-[#581c87] dark:text-[#e9d5ff]" },
  },
};

export function getTheme(id: string): FunnelTheme {
  return FUNNEL_THEMES[id as FunnelThemeId] || FUNNEL_THEMES.classico;
}

export const THEME_LIST = Object.values(FUNNEL_THEMES);
