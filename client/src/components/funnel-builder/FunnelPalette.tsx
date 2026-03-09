import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  NODE_TYPES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type NodeCategory,
  type FunnelNodeType,
} from "./funnel-node-types";

interface FunnelPaletteProps {
  className?: string;
}

const ALL_CATEGORIES: NodeCategory[] = [
  "sorgenti",
  "cattura",
  "gestione",
  "comunicazione",
  "conversione",
  "delivery",
  "custom",
];

export function FunnelPalette({ className }: FunnelPaletteProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return NODE_TYPES;
    const q = search.toLowerCase();
    return NODE_TYPES.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q)
    );
  }, [search]);

  const groupedTypes = useMemo(() => {
    const groups: Record<string, FunnelNodeType[]> = {};
    for (const cat of ALL_CATEGORIES) {
      const items = filteredTypes.filter((n) => n.category === cat);
      if (items.length > 0) {
        groups[cat] = items;
      }
    }
    return groups;
  }, [filteredTypes]);

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: FunnelNodeType
  ) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({
        type: nodeType.type,
        label: nodeType.label,
        category: nodeType.category,
      })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={cn(
        "w-60 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Componenti
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2 space-y-1">
          {ALL_CATEGORIES.map((cat) => {
            const items = groupedTypes[cat];
            if (!items) return null;
            const colors = CATEGORY_COLORS[cat];
            const isCollapsed = collapsed[cat];

            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors.accent }}
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-400">
                    {items.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {items.map((nodeType) => {
                      const NodeIcon = nodeType.icon;
                      return (
                        <div
                          key={nodeType.type}
                          draggable
                          onDragStart={(e) => onDragStart(e, nodeType)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing",
                            "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                            "border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                          )}
                        >
                          <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                          <div
                            className={cn(
                              "w-6 h-6 rounded flex items-center justify-center shrink-0",
                              colors.text
                            )}
                            style={{ backgroundColor: `${colors.accent}15` }}
                          >
                            <NodeIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                              {nodeType.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(groupedTypes).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              Nessun risultato
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
