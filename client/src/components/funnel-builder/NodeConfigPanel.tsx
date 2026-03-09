import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth";
import { X, Link2, Unlink, Loader2, Image as ImageIcon } from "lucide-react";
import {
  type FunnelNodeData,
  type LinkedEntity,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getNodeTypeDefinition,
  getEntityTypeForNode,
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

export function NodeConfigPanel({
  nodeId,
  data,
  onUpdate,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");

  const typeDef = getNodeTypeDefinition(data.type);
  const colors = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.custom;
  const entityType = getEntityTypeForNode(data.type);

  const fetchEntities = useCallback(async () => {
    if (!entityType) return;
    setLoadingEntities(true);
    try {
      const res = await fetch(`/api/funnels/entities/${entityType}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const result = await res.json();
        setEntities(result || []);
      }
    } catch (err) {
      console.error("Error fetching entities:", err);
    } finally {
      setLoadingEntities(false);
    }
  }, [entityType]);

  useEffect(() => {
    if (showEntityPicker && entityType) {
      fetchEntities();
    }
  }, [showEntityPicker, entityType, fetchEntities]);

  const filteredEntities = entities.filter((e) =>
    !entitySearch.trim() ||
    e.name?.toLowerCase().includes(entitySearch.toLowerCase())
  );

  const handleLinkEntity = (entity: EntityItem) => {
    const linked: LinkedEntity = {
      entityType: entityType === "ads" ? "ad" :
        entityType === "posts" ? "post" :
        entityType === "campaigns" ? "campaign" :
        entityType === "agents" ? "agent" :
        entityType === "voice-numbers" ? "voice" :
        "service",
      entityId: entity.id,
      name: entity.name,
      imageUrl: entity.imageUrl,
      platform: entity.platform,
      status: entity.status,
    };
    onUpdate(nodeId, { linkedEntity: linked });
    setShowEntityPicker(false);
  };

  const handleUnlink = () => {
    onUpdate(nodeId, { linkedEntity: null });
  };

  const Icon = typeDef?.icon;

  return (
    <div
      className={cn(
        "w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col",
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

          {entityType && (
            <>
              <Separator />

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Entità Collegata
                </label>

                {data.linkedEntity ? (
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-start gap-2">
                      {data.linkedEntity.imageUrl ? (
                        <img
                          src={data.linkedEntity.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {data.linkedEntity.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {data.linkedEntity.platform && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              {data.linkedEntity.platform}
                            </Badge>
                          )}
                          {data.linkedEntity.status && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {data.linkedEntity.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={handleUnlink}
                    >
                      <Unlink className="w-3 h-3 mr-1" />
                      Scollega
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => setShowEntityPicker(true)}
                  >
                    <Link2 className="w-3.5 h-3.5 mr-1.5" />
                    Collega Entità
                  </Button>
                )}

                {showEntityPicker && (
                  <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <Input
                        placeholder="Cerca..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      {loadingEntities ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      ) : filteredEntities.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Nessuna entità trovata
                        </p>
                      ) : (
                        filteredEntities.map((entity) => (
                          <button
                            key={entity.id}
                            onClick={() => handleLinkEntity(entity)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                          >
                            {entity.imageUrl ? (
                              <img
                                src={entity.imageUrl}
                                alt=""
                                className="w-8 h-8 rounded object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                {entity.name}
                              </p>
                              {entity.platform && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                                  {entity.platform}
                                </Badge>
                              )}
                            </div>
                          </button>
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
                        }}
                      >
                        Chiudi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
