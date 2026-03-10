import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import {
  X, Link2, Unlink, Loader2, ExternalLink, Settings2,
  Image as ImageIcon, Mail, Phone, Calendar, CreditCard,
  Users, Bot, Target, Megaphone, Globe, Magnet,
} from "lucide-react";
import {
  type FunnelNodeData,
  type LinkedEntity,
  type EntityType,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getNodeTypeDefinition,
  getEntityTypeForNode,
  getEditLinkForEntity,
  getEntityLabel,
  getPlatformFilterForNode,
} from "./funnel-node-types";

interface NodeConfigPanelProps {
  nodeId: string;
  data: FunnelNodeData;
  onUpdate: (nodeId: string, updates: Partial<FunnelNodeData>) => void;
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

export function NodeConfigPanel({
  nodeId,
  data,
  onUpdate,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const [, navigate] = useLocation();
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("");

  const typeDef = getNodeTypeDefinition(data.type);
  const colors = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.custom;
  const entityType = getEntityTypeForNode(data.type);
  const defaultPlatformFilter = getPlatformFilterForNode(data.type);

  const entityUrlPath = entityType ? entityType.replace(/_/g, "-") : null;

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

  const filteredEntities = entities.filter((e) =>
    !entitySearch.trim() ||
    (e.name || "").toLowerCase().includes(entitySearch.toLowerCase())
  );

  const handleLinkEntity = (entity: EntityItem) => {
    if (!entityType) return;
    const linked: LinkedEntity = {
      entityType,
      entityId: entity.id,
      name: entity.name || "—",
      imageUrl: entity.imageUrl,
      platform: entity.platform,
      status: entity.status || (entity.isActive ? "active" : entity.isActive === false ? "inactive" : undefined),
      extra: { ...entity },
    };
    onUpdate(nodeId, { linkedEntity: linked });
    setShowEntityPicker(false);
  };

  const handleUnlink = () => {
    onUpdate(nodeId, { linkedEntity: null });
  };

  const handleEditSource = () => {
    if (!entityType) return;
    const link = getEditLinkForEntity(entityType);
    navigate(link);
  };

  const Icon = typeDef?.icon;
  const isManualOnly = !entityType;

  return (
    <div
      className={cn(
        "w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col",
        className
      )}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div
              className={cn("w-6 h-6 rounded flex items-center justify-center", colors.text)}
              style={{ backgroundColor: `${colors.accent}20` }}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Configura Nodo
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div>
            <Badge
              variant="outline"
              className="text-[10px] mb-2"
              style={{ borderColor: colors.accent, color: colors.accent }}
            >
              {CATEGORY_LABELS[data.category]}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Titolo
            </label>
            <Input
              value={data.label}
              onChange={(e) => onUpdate(nodeId, { label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Sottotitolo
            </label>
            <Input
              value={data.subtitle || ""}
              onChange={(e) => onUpdate(nodeId, { subtitle: e.target.value })}
              placeholder="Descrizione breve..."
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Note
            </label>
            <textarea
              value={data.notes || ""}
              onChange={(e) => onUpdate(nodeId, { notes: e.target.value })}
              placeholder="Note aggiuntive..."
              className="w-full h-16 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Tasso di Conversione (%)
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              value={data.conversionRate || ""}
              onChange={(e) =>
                onUpdate(nodeId, {
                  conversionRate: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="es. 25"
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {isManualOnly ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-gray-400" />
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Configurazione Manuale
                </label>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Questo tipo di nodo non ha un'entità collegabile. Usa le note per descrivere la configurazione.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {getEntityLabel(entityType!)}
              </label>

              {data.linkedEntity ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <LinkedEntityCard entity={data.linkedEntity} />
                  <div className="flex gap-1 p-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-7 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={handleEditSource}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Modifica Fonte
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={handleUnlink}
                    >
                      <Unlink className="w-3 h-3 mr-1" />
                      Scollega
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setShowEntityPicker(true)}
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  Collega {getEntityLabel(entityType!)}
                </Button>
              )}

              {showEntityPicker && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
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

                  <div className="max-h-56 overflow-y-auto">
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
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LinkedEntityCard({ entity }: { entity: LinkedEntity }) {
  const extra = entity.extra || {};

  switch (entity.entityType) {
    case "posts":
      return (
        <div className="p-2.5">
          <div className="flex items-start gap-2">
            {entity.imageUrl ? (
              <img src={entity.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{entity.name}</p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {entity.platform && <Badge variant="secondary" className="text-[9px] px-1 py-0">{entity.platform}</Badge>}
                {extra.contentType && <Badge variant="outline" className="text-[9px] px-1 py-0">{extra.contentType as string}</Badge>}
                <StatusDot active={entity.status === "published" || entity.status === "active"} />
              </div>
              {extra.hook && <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{extra.hook as string}</p>}
            </div>
          </div>
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
            <div className="flex-1 min-w-0">
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
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{entity.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <StatusDot active={extra.isEnabled as boolean} size="sm" />
                <span className="text-[10px] text-gray-500 truncate">{extra.shortDescription as string}</span>
              </div>
            </div>
          </>
        );

      case "services":
        return (
          <>
            <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
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
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Prenotazione</p>
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
            <div className="flex-1 min-w-0">
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
      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
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
