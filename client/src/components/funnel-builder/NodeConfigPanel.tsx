import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import {
  X, Link2, Unlink, Loader2, ExternalLink, Settings2,
  Image as ImageIcon, Mail, Phone, Calendar, CreditCard,
  Users, Bot, Target, Megaphone, Globe, Magnet,
  ChevronDown, ChevronRight, Clock, Zap,
  Palette, AlertTriangle, Flag, Plus, Trash2,
  GraduationCap, BookOpen,
} from "lucide-react";
import {
  type FunnelNodeData,
  type LinkedEntity,
  type EntityType,
  type NodeStatus,
  type AcademyLink,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  NODE_STATUS_CONFIG,
  getNodeTypeDefinition,
  getEntityTypeForNode,
  getEditLinkForEntity,
  getEntityLabel,
  getPlatformFilterForNode,
  getLinkedEntities,
  NODE_TYPE_ACADEMY_MAP,
} from "./funnel-node-types";

interface NodeConfigPanelProps {
  nodeId: string;
  data: FunnelNodeData;
  onUpdate: (nodeId: string, updates: Partial<FunnelNodeData>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
  className?: string;
}

interface EntityItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  platform?: string;
  status?: string;
  [key: string]: unknown;
}

const ACCENT_COLOR_MAP: Record<string, string> = {
  pink: "#ec4899",
  purple: "#a855f7",
  orange: "#f97316",
  emerald: "#10b981",
  indigo: "#6366f1",
  amber: "#f59e0b",
  teal: "#14b8a6",
  gray: "#6b7280",
};

const NODE_COLORS = [
  { value: "", label: "Default" },
  { value: "#3b82f6", label: "Blu" },
  { value: "#22c55e", label: "Verde" },
  { value: "#f97316", label: "Arancio" },
  { value: "#ef4444", label: "Rosso" },
  { value: "#a855f7", label: "Viola" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f59e0b", label: "Ambra" },
  { value: "#ec4899", label: "Rosa" },
];

const PRIORITY_CONFIG = {
  low: { label: "Bassa", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  medium: { label: "Media", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  high: { label: "Alta", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
};

function Section({ title, icon: Icon, defaultOpen = true, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors text-left"
      >
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex-1">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
      {open && <div className="p-3 space-y-3 overflow-hidden">{children}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {children}
    </label>
  );
}

export function NodeConfigPanel({
  nodeId,
  data,
  onUpdate,
  onDelete,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const [, navigate] = useLocation();
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [newTag, setNewTag] = useState("");
  const [academyLessons, setAcademyLessons] = useState<AcademyLink[]>([]);
  const [academyNodeTypeMap, setAcademyNodeTypeMap] = useState<Record<string, string[]>>({});
  const [loadingAcademy, setLoadingAcademy] = useState(false);
  const [showAcademyPicker, setShowAcademyPicker] = useState(false);
  const [academySearch, setAcademySearch] = useState("");

  const typeDef = getNodeTypeDefinition(data.type);
  const colors = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.custom;
  const entityType = getEntityTypeForNode(data.type);
  const defaultPlatformFilter = getPlatformFilterForNode(data.type);
  const entityUrlPath = entityType ? entityType.replace(/_/g, "-") : null;
  const currentStatus = (data.status && data.status in NODE_STATUS_CONFIG) ? data.status : "draft";
  const statusConfig = NODE_STATUS_CONFIG[currentStatus];

  const fetchEntities = useCallback(async () => {
    if (!entityUrlPath) return;
    setLoadingEntities(true);
    try {
      let url = `/api/funnels/entities/${entityUrlPath}`;
      const params = new URLSearchParams();
      if (entityType === "posts" && (platformFilter || defaultPlatformFilter)) {
        params.set("platform", platformFilter || defaultPlatformFilter || "");
      }
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const result = await res.json();
        setEntities(Array.isArray(result) ? result : result ? [result] : []);
      }
    } catch (err) {
      console.error("Error fetching entities:", err);
    } finally {
      setLoadingEntities(false);
    }
  }, [entityUrlPath, entityType, platformFilter, defaultPlatformFilter]);

  useEffect(() => {
    if (showEntityPicker && entityType) {
      fetchEntities();
    }
  }, [showEntityPicker, entityType, fetchEntities]);

  const currentLinkedAll = getLinkedEntities(data);
  const currentLinked = currentLinkedAll.filter(le => le.entityType !== "academy_lessons");
  const linkedIds = new Set(currentLinked.map((le) => le.entityId));

  const filteredEntities = entities.filter((e) =>
    !linkedIds.has(e.id) &&
    (!entitySearch.trim() ||
    (e.name || "").toLowerCase().includes(entitySearch.toLowerCase()))
  );

  const handleLinkEntity = (entity: EntityItem) => {
    if (!entityType) return;
    if (currentLinked.some((le) => le.entityId === entity.id)) return;
    const linked: LinkedEntity = {
      entityType,
      entityId: entity.id,
      name: entity.name || "—",
      imageUrl: entity.imageUrl,
      platform: entity.platform,
      status: entity.status || (entity.isActive ? "active" : entity.isActive === false ? "inactive" : undefined),
      extra: { ...entity },
    };
    const updated = [...currentLinked, linked];
    onUpdate(nodeId, { linkedEntities: updated, linkedEntity: updated[0] });
    setShowEntityPicker(false);
  };

  const handleUnlinkEntity = (entityId: string) => {
    const updated = currentLinked.filter((le) => le.entityId !== entityId);
    onUpdate(nodeId, { linkedEntities: updated, linkedEntity: updated[0] || null });
  };

  const handleUnlink = () => {
    onUpdate(nodeId, { linkedEntities: [], linkedEntity: null });
  };

  const handleEditSource = () => {
    if (!entityType) return;
    const link = getEditLinkForEntity(entityType);
    navigate(link);
  };

  const handleAddTag = () => {
    const t = newTag.trim();
    if (!t) return;
    const existing = data.tags || [];
    if (!existing.includes(t)) {
      onUpdate(nodeId, { tags: [...existing, t] });
    }
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate(nodeId, { tags: (data.tags || []).filter((t) => t !== tag) });
  };

  const fetchAcademyLessons = useCallback(async () => {
    setLoadingAcademy(true);
    try {
      const res = await fetch("/api/funnels/entities/academy-lessons", { headers: getAuthHeaders() });
      if (res.ok) {
        const result = await res.json();
        setAcademyLessons(Array.isArray(result.lessons) ? result.lessons : []);
        if (result.nodeTypeMap) setAcademyNodeTypeMap(result.nodeTypeMap);
      }
    } catch (err) {
      console.error("Error fetching academy lessons:", err);
    } finally {
      setLoadingAcademy(false);
    }
  }, []);

  useEffect(() => {
    if (showAcademyPicker) {
      fetchAcademyLessons();
    }
  }, [showAcademyPicker, fetchAcademyLessons]);

  const currentAcademyLessons = data.academyLessons || [];
  const linkedAcademyIds = new Set(currentAcademyLessons.map((al) => al.lessonId));
  const serverSuggestedIds = academyNodeTypeMap[data.type] || [];
  const suggestedLessonIds = serverSuggestedIds.length > 0 ? serverSuggestedIds : (NODE_TYPE_ACADEMY_MAP[data.type] || []);

  const filteredAcademyLessons = academyLessons.filter((al) =>
    !linkedAcademyIds.has(al.lessonId) &&
    (!academySearch.trim() ||
      al.title.toLowerCase().includes(academySearch.toLowerCase()) ||
      al.moduleTitle.toLowerCase().includes(academySearch.toLowerCase()))
  );

  const suggestedAcademyLessons = filteredAcademyLessons.filter((al) => suggestedLessonIds.includes(al.lessonId));
  const otherAcademyLessons = filteredAcademyLessons.filter((al) => !suggestedLessonIds.includes(al.lessonId));

  const handleLinkAcademy = (lesson: AcademyLink) => {
    if (currentAcademyLessons.some((al) => al.lessonId === lesson.lessonId)) return;
    const updated = [...currentAcademyLessons, lesson];
    onUpdate(nodeId, { academyLessons: updated });
    setShowAcademyPicker(false);
  };

  const handleUnlinkAcademy = (lessonId: string) => {
    const updated = currentAcademyLessons.filter((al) => al.lessonId !== lessonId);
    onUpdate(nodeId, { academyLessons: updated });
  };

  const Icon = typeDef?.icon;
  const isManualOnly = !entityType;

  return (
    <div
      className={cn(
        "w-80 h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden",
        className
      )}
    >
      <div
        className="px-3 py-3 border-b flex items-center justify-between shrink-0"
        style={{
          borderColor: `${colors.accent}30`,
          background: `linear-gradient(135deg, ${colors.accent}08, ${colors.accent}03)`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${colors.accent}15`,
                border: `1px solid ${colors.accent}30`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: colors.accent }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {data.label || typeDef?.label || "Nodo"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 font-medium"
                style={{ borderColor: `${colors.accent}50`, color: colors.accent }}
              >
                {CATEGORY_LABELS[data.category]}
              </Badge>
              <div className="flex items-center gap-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dotColor)} />
                <span className={cn("text-[9px] font-medium", statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-3 overflow-hidden">
          <Section title="Informazioni Base" icon={Settings2} defaultOpen={true}>
            <div className="space-y-1.5">
              <FieldLabel>Titolo</FieldLabel>
              <Input
                value={data.label}
                onChange={(e) => onUpdate(nodeId, { label: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Sottotitolo</FieldLabel>
              <Input
                value={data.subtitle || ""}
                onChange={(e) => onUpdate(nodeId, { subtitle: e.target.value })}
                placeholder="Descrizione breve..."
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Note</FieldLabel>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onUpdate(nodeId, { notes: e.target.value })}
                placeholder="Note interne sul nodo..."
                className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </Section>

          <Section title="Stato & Metriche" icon={Zap} defaultOpen={true}>
            <div className="space-y-1.5">
              <FieldLabel>Stato del Nodo</FieldLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(NODE_STATUS_CONFIG) as NodeStatus[]).map((s) => {
                  const cfg = NODE_STATUS_CONFIG[s];
                  const isSelected = currentStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => onUpdate(nodeId, { status: s })}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border",
                        isSelected
                          ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm"
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-500"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Tasso di Conversione (%)</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={data.conversionRate ?? ""}
                  onChange={(e) =>
                    onUpdate(nodeId, {
                      conversionRate: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="es. 25"
                  className="h-8 text-sm pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
              {data.conversionRate != null && data.conversionRate > 0 && (
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(data.conversionRate, 100)}%`,
                      backgroundColor: data.conversionRate >= 50 ? "#22c55e" : data.conversionRate >= 20 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Priorità</FieldLabel>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as const).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const isSelected = (data.priority || "medium") === p;
                  return (
                    <button
                      key={p}
                      onClick={() => onUpdate(nodeId, { priority: p })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all border",
                        isSelected
                          ? cn(cfg.bg, cfg.color, "border-current/20 shadow-sm")
                          : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      )}
                    >
                      <Flag className="w-3 h-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title="Automazione" icon={Clock} defaultOpen={false}>
            <div className="space-y-1.5">
              <FieldLabel>Ritardo (minuti)</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={data.delayMinutes ?? ""}
                  onChange={(e) =>
                    onUpdate(nodeId, {
                      delayMinutes: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="0"
                  className="h-8 text-sm flex-1"
                />
                <span className="text-[11px] text-gray-400 shrink-0">
                  {data.delayMinutes ? (
                    data.delayMinutes >= 60
                      ? `${Math.floor(data.delayMinutes / 60)}h ${data.delayMinutes % 60}m`
                      : `${data.delayMinutes}m`
                  ) : "Immediato"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Condizione</FieldLabel>
              <Input
                value={data.conditionLabel || ""}
                onChange={(e) => onUpdate(nodeId, { conditionLabel: e.target.value })}
                placeholder="es. Se il lead ha risposto..."
                className="h-8 text-sm"
              />
              {data.conditionLabel && (
                <div className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    Condizione attiva: questo nodo si attiverà solo quando la condizione è soddisfatta
                  </p>
                </div>
              )}
            </div>
          </Section>

          <Section title="Aspetto" icon={Palette} defaultOpen={false}>
            <div className="space-y-1.5">
              <FieldLabel>Colore Nodo</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {NODE_COLORS.map((c) => (
                  <button
                    key={c.value || "default"}
                    onClick={() => onUpdate(nodeId, { color: c.value || undefined })}
                    className={cn(
                      "w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center",
                      (data.color || "") === c.value
                        ? "border-gray-800 dark:border-white scale-110 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value || undefined }}
                    title={c.label}
                  >
                    {!c.value && (
                      <span className="w-4 h-4 rounded bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Tag</FieldLabel>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {(data.tags || []).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 gap-1 font-normal"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  placeholder="Aggiungi tag..."
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Collegamento Entità" icon={Link2} defaultOpen={true}>
            {isManualOnly ? (
              <div className="flex items-start gap-2 px-2.5 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                <Settings2 className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                    Configurazione Manuale
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Questo nodo non ha un'entità collegabile. Usa le note per descrivere la configurazione.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <FieldLabel>{getEntityLabel(entityType!)}</FieldLabel>
                    {currentLinked.length > 0 && (
                      <span className="text-[10px] text-gray-400">{currentLinked.length} collegat{currentLinked.length === 1 ? "o" : "i"}</span>
                    )}
                  </div>

                  {currentLinked.length > 0 && (
                    <div className="space-y-1.5 overflow-hidden">
                      {currentLinked.map((le) => (
                        <div key={le.entityId} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-full">
                          <LinkedEntityCard entity={le} />
                          <div className="flex gap-1 p-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 h-7 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={handleEditSource}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Modifica
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => handleUnlinkEntity(le.entityId)}
                            >
                              <Unlink className="w-3 h-3 mr-1" />
                              Scollega
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 text-xs gap-1.5 border-dashed hover:border-solid transition-all"
                    onClick={() => setShowEntityPicker(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {currentLinked.length > 0 ? "Aggiungi altro" : `Collega ${getEntityLabel(entityType!)}`}
                  </Button>
                </div>

                {showEntityPicker && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-w-full">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-1.5">
                      <Input
                        placeholder="Cerca..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        className="h-7 text-xs"
                      />
                      {entityType === "posts" && (
                        <select
                          value={platformFilter}
                          onChange={(e) => setPlatformFilter(e.target.value)}
                          className="w-full h-7 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value="">Tutte le piattaforme</option>
                          <option value="instagram">Instagram</option>
                          <option value="facebook">Facebook</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                          <option value="twitter">Twitter/X</option>
                        </select>
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
                      {loadingEntities ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      ) : filteredEntities.length === 0 ? (
                        <div className="text-center py-4 px-3">
                          <p className="text-xs text-gray-400">
                            Nessuna entità trovata
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-[11px] mt-1 h-auto p-0"
                            onClick={handleEditSource}
                          >
                            Crea nella sezione dedicata →
                          </Button>
                        </div>
                      ) : (
                        filteredEntities.map((entity) => (
                          <EntityPickerItem
                            key={entity.id}
                            entity={entity}
                            entityType={entityType!}
                            onClick={() => handleLinkEntity(entity)}
                          />
                        ))
                      )}
                    </div>

                    <div className="p-1.5 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-6 text-[10px]"
                        onClick={() => {
                          setShowEntityPicker(false);
                          setEntitySearch("");
                          setPlatformFilter("");
                        }}
                      >
                        Chiudi
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section title="Accademia" icon={GraduationCap} defaultOpen={currentAcademyLessons.length > 0}>
            <div className="space-y-1.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <FieldLabel>Lezioni Collegate</FieldLabel>
                {currentAcademyLessons.length > 0 && (
                  <span className="text-[10px] text-gray-400">{currentAcademyLessons.length} {currentAcademyLessons.length === 1 ? "lezione" : "lezioni"}</span>
                )}
              </div>

              {currentAcademyLessons.length > 0 && (
                <div className="space-y-1.5 overflow-hidden">
                  {currentAcademyLessons.map((al) => (
                    <div key={al.lessonId} className="rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                      <div className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{al.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-gray-500">{al.moduleEmoji} {al.moduleTitle}</span>
                              {al.videoCount > 0 && (
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">{al.videoCount} video</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 p-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-indigo-200 dark:border-indigo-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2"
                          onClick={() => navigate(`/consultant/academy?step=${al.lessonId}`)}
                        >
                          <BookOpen className="w-3 h-3 mr-1" />
                          Lezione
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-2"
                          onClick={() => navigate(al.configLink)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Config
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-2"
                          onClick={() => handleUnlinkAcademy(al.lessonId)}
                        >
                          <Unlink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs gap-1.5 border-dashed hover:border-solid transition-all border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                onClick={() => setShowAcademyPicker(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                {currentAcademyLessons.length > 0 ? "Aggiungi lezione" : "Collega lezione Accademia"}
              </Button>

              {showAcademyPicker && (
                <div className="border border-indigo-200 dark:border-indigo-700 rounded-lg overflow-hidden max-w-full">
                  <div className="p-2 border-b border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20">
                    <Input
                      placeholder="Cerca lezione..."
                      value={academySearch}
                      onChange={(e) => setAcademySearch(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto overflow-x-hidden">
                    {loadingAcademy ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      </div>
                    ) : filteredAcademyLessons.length === 0 ? (
                      <div className="text-center py-4 px-3">
                        <p className="text-xs text-gray-400">Nessuna lezione trovata</p>
                      </div>
                    ) : (
                      <>
                        {suggestedAcademyLessons.length > 0 && (
                          <>
                            <div className="px-2 py-1 bg-indigo-50/80 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-800">
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Suggerite per questo nodo</span>
                            </div>
                            {suggestedAcademyLessons.map((al) => (
                              <button
                                key={al.lessonId}
                                onClick={() => handleLinkAcademy(al)}
                                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                              >
                                <span className="text-sm shrink-0">{al.moduleEmoji}</span>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{al.title}</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] text-gray-400 truncate">{al.moduleTitle}</p>
                                    {al.videoCount > 0 && (
                                      <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">{al.videoCount} video</Badge>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        {otherAcademyLessons.length > 0 && (
                          <>
                            {suggestedAcademyLessons.length > 0 && (
                              <div className="px-2 py-1 bg-gray-50/80 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
                                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Altre lezioni</span>
                              </div>
                            )}
                            {otherAcademyLessons.map((al) => (
                              <button
                                key={al.lessonId}
                                onClick={() => handleLinkAcademy(al)}
                                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                              >
                                <span className="text-sm shrink-0">{al.moduleEmoji}</span>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{al.title}</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] text-gray-400 truncate">{al.moduleTitle}</p>
                                    {al.videoCount > 0 && (
                                      <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">{al.videoCount} video</Badge>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-1.5 border-t border-indigo-200 dark:border-indigo-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-[10px]"
                      onClick={() => {
                        setShowAcademyPicker(false);
                        setAcademySearch("");
                      }}
                    >
                      Chiudi
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </ScrollArea>

      <div className="shrink-0 p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-7 text-[10px] text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          Chiudi
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1 px-2"
          onClick={() => onDelete(nodeId)}
        >
          <Trash2 className="w-3 h-3" />
          Elimina
        </Button>
      </div>
    </div>
  );
}

function LinkedEntityCard({ entity }: { entity: LinkedEntity }) {
  const [expanded, setExpanded] = useState(false);
  const extra = entity.extra || {};

  const postBody = (extra.fullCopy as string) || (extra.body as string) || (extra.hook as string) || "";

  switch (entity.entityType) {
    case "posts":
      return (
        <div className="overflow-hidden" style={{ wordBreak: "break-word" }}>
          <div className="p-2.5">
            <div className="flex items-start gap-2" style={{ maxWidth: "100%" }}>
              {entity.imageUrl ? (
                <img src={entity.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div style={{ flex: "1 1 0%", minWidth: 0, overflow: "hidden" }}>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2" style={{ wordBreak: "break-word" }}>{entity.name}</p>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {entity.platform && <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">{entity.platform}</Badge>}
                  {extra.contentType && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{extra.contentType as string}</Badge>}
                  <StatusDot active={entity.status === "published" || entity.status === "active"} />
                </div>
              </div>
            </div>
          </div>
          {(postBody || entity.imageUrl) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 transition-colors py-1 border-t border-gray-100 dark:border-gray-800"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Chiudi" : "Espandi dettagli"}
            </button>
          )}
          {expanded && (
            <div className="border-t border-gray-100 dark:border-gray-800">
              {entity.imageUrl && (
                <img src={entity.imageUrl} alt="" className="w-full object-contain bg-gray-50 dark:bg-gray-800/50" style={{ maxHeight: 200 }} />
              )}
              {postBody && (
                <div className="p-2.5 text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-y-auto overflow-x-hidden" style={{ wordBreak: "break-word", maxHeight: 200 }}>
                  {postBody}
                </div>
              )}
            </div>
          )}
        </div>
      );

    case "referral_config":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{extra.headline as string || "Pagina Referral"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.isActive as boolean} />
                {extra.bonusText && <span className="text-[10px] text-gray-500 truncate">{extra.bonusText as string}</span>}
              </div>
            </div>
          </div>
        </div>
      );

    case "optin_config":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{extra.headline as string || "Pagina Optin"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.isActive as boolean} />
                {extra.ctaText && <Badge variant="outline" className="text-[9px] px-1 py-0">{extra.ctaText as string}</Badge>}
              </div>
            </div>
          </div>
        </div>
      );

    case "lead_magnet":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Magnet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Lead Magnet AI</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.hasLeadMagnet as boolean} />
                <span className="text-[10px] text-gray-500">
                  {extra.hasLeadMagnet ? "Attivo" : "Non configurato"}
                </span>
              </div>
            </div>
          </div>
        </div>
      );

    case "hunter_searches":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.location && <span className="text-[10px] text-gray-500">{extra.location as string}</span>}
                {extra.resultCount != null && <Badge variant="secondary" className="text-[9px] px-1 py-0">{String(extra.resultCount)} risultati</Badge>}
              </div>
            </div>
          </div>
        </div>
      );

    case "ai_employees":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
              style={{ backgroundColor: ACCENT_COLOR_MAP[extra.accentColor as string] || "#6b7280" }}
            >
              {(extra.roleName as string || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.isEnabled as boolean} />
                <span className="text-[10px] text-gray-500 truncate">{extra.shortDescription as string}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "agents":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.agentType && <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.agentType as string}</Badge>}
                <StatusDot active={extra.isActive as boolean} />
                {extra.phoneNumber && <span className="text-[10px] text-gray-500">{extra.phoneNumber as string}</span>}
              </div>
            </div>
          </div>
        </div>
      );

    case "email_accounts":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.provider && <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.provider as string}</Badge>}
                <StatusDot active={extra.isActive as boolean} />
              </div>
            </div>
          </div>
        </div>
      );

    case "voice_numbers":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name || extra.phoneNumber as string}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.aiMode && <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.aiMode as string}</Badge>}
                <StatusDot active={extra.isActive as boolean} />
              </div>
            </div>
          </div>
        </div>
      );

    case "booking":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Prenotazione</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.bookingPageEnabled as boolean} />
                {extra.bookingSlug && <span className="text-[10px] text-gray-500">/book/{extra.bookingSlug as string}</span>}
                {extra.appointmentDuration && <Badge variant="outline" className="text-[9px] px-1 py-0">{String(extra.appointmentDuration)} min</Badge>}
              </div>
            </div>
          </div>
        </div>
      );

    case "services":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.priceCents != null && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                    €{(Number(extra.priceCents) / 100).toFixed(2).replace(".", ",")}
                  </Badge>
                )}
                {extra.billingType && <Badge variant="outline" className="text-[9px] px-1 py-0">{extra.billingType as string}</Badge>}
                <StatusDot active={extra.isActive as boolean} />
              </div>
            </div>
          </div>
        </div>
      );

    case "campaigns":
      return (
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {extra.campaignType && <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.campaignType as string}</Badge>}
                {extra.conversionRate != null && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {Number(extra.conversionRate).toFixed(1)}% conv.
                  </Badge>
                )}
                <StatusDot active={extra.isActive as boolean} />
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="p-2.5">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
        </div>
      );
  }
}

function EntityPickerItem({ entity, entityType, onClick }: { entity: EntityItem; entityType: EntityType; onClick: () => void }) {
  const extra = entity as Record<string, unknown>;

  const renderContent = () => {
    switch (entityType) {
      case "posts":
        return (
          <>
            {entity.imageUrl ? (
              <img src={entity.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {entity.platform && <Badge variant="secondary" className="text-[9px] px-1 py-0">{entity.platform}</Badge>}
                {extra.contentType && <Badge variant="outline" className="text-[9px] px-1 py-0">{extra.contentType as string}</Badge>}
              </div>
            </div>
          </>
        );

      case "ai_employees":
        return (
          <>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
              style={{ backgroundColor: ACCENT_COLOR_MAP[extra.accentColor as string] || "#6b7280" }}
            >
              {(extra.roleName as string || "?")[0]}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.isEnabled as boolean} size="sm" />
                <span className="text-[10px] text-gray-500 truncate">{extra.shortDescription as string}</span>
              </div>
            </div>
          </>
        );

      case "agents":
        return (
          <>
            <Bot className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {extra.agentType && <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.agentType as string}</Badge>}
                <StatusDot active={extra.isActive as boolean} size="sm" />
              </div>
            </div>
          </>
        );

      case "email_accounts":
        return (
          <>
            <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              {extra.provider && <span className="text-[10px] text-gray-500">{extra.provider as string}</span>}
            </div>
          </>
        );

      case "voice_numbers":
        return (
          <>
            <Phone className="w-4 h-4 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name || extra.phoneNumber as string}</p>
              {extra.aiMode && <span className="text-[10px] text-gray-500">{extra.aiMode as string}</span>}
            </div>
          </>
        );

      case "services":
        return (
          <>
            <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              {extra.priceCents != null && (
                <span className="text-[10px] text-gray-500 font-mono">€{(Number(extra.priceCents) / 100).toFixed(2).replace(".", ",")}</span>
              )}
            </div>
          </>
        );

      case "booking":
        return (
          <>
            <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">Prenotazione</p>
              {extra.bookingSlug && <span className="text-[10px] text-gray-500">/book/{extra.bookingSlug as string}</span>}
            </div>
          </>
        );

      default:
        return (
          <>
            <div className="w-7 h-7 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <Link2 className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              {entity.status && (
                <div className="flex items-center gap-1 mt-0.5">
                  <StatusDot active={entity.status === "active" || (extra.isActive as boolean)} size="sm" />
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left overflow-hidden min-w-0"
    >
      {renderContent()}
    </button>
  );
}

function StatusDot({ active, size = "md" }: { active?: boolean; size?: "sm" | "md" }) {
  if (active === undefined || active === null) return null;
  const s = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  return (
    <span
      className={cn("rounded-full shrink-0", s, active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600")}
      title={active ? "Attivo" : "Non attivo"}
    />
  );
}
