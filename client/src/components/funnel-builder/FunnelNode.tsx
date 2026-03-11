import React, { memo, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap } from "lucide-react";
import {
  type FunnelNodeData,
  type EntityType,
  NODE_STATUS_CONFIG,
  getNodeTypeDefinition,
  getLinkedEntities,
} from "./funnel-node-types";
import { ThemeContext } from "./FunnelBuilderTab";

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

function FunnelNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FunnelNodeData;
  const theme = useContext(ThemeContext);
  const typeDef = getNodeTypeDefinition(nodeData.type);
  const colors = theme.categoryColors[nodeData.category] || theme.categoryColors.custom;
  const Icon = typeDef?.icon;
  const status = (nodeData.status && nodeData.status in NODE_STATUS_CONFIG) ? nodeData.status : "draft";
  const statusCfg = NODE_STATUS_CONFIG[status];
  const accentColor = nodeData.color || colors.accent;

  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[220px] transition-all duration-200",
        theme.node.borderRadius,
        theme.node.borderWidth,
        theme.node.shadow,
        theme.node.fontFamily,
        colors.bg,
        selected && `ring-2 ring-offset-2 ${theme.node.selectedRing} scale-105`
      )}
      style={{
        borderColor: `${accentColor}40`,
        borderLeftWidth: "4px",
        borderLeftColor: accentColor,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn("!w-3 !h-3 !border-2", theme.handle.bg, theme.handle.border)}
      />

      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        <span
          className={cn("w-2 h-2 rounded-full", statusCfg.dotColor)}
          title={statusCfg.label}
        />
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {Icon && (
            <div
              className={cn("w-7 h-7 flex items-center justify-center shrink-0", theme.node.borderRadius === "rounded-none" ? "rounded-none" : "rounded-md")}
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-semibold truncate", theme.node.textColor)}>
              {nodeData.label}
            </p>
            {nodeData.subtitle && (
              <p className={cn("text-xs truncate", theme.node.subtitleColor)}>
                {nodeData.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-1">
          {nodeData.conversionRate !== undefined && nodeData.conversionRate > 0 && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", theme.badge.bg, theme.badge.text)}>
              {nodeData.conversionRate}% conv.
            </Badge>
          )}
          {nodeData.delayMinutes != null && nodeData.delayMinutes > 0 && (
            <Badge variant="outline" className={cn("text-[10px] px-1 py-0 gap-0.5", theme.badge.border)}>
              <Clock className="w-2.5 h-2.5" />
              {nodeData.delayMinutes >= 60
                ? `${Math.floor(nodeData.delayMinutes / 60)}h${nodeData.delayMinutes % 60 ? ` ${nodeData.delayMinutes % 60}m` : ""}`
                : `${nodeData.delayMinutes}m`}
            </Badge>
          )}
          {nodeData.conditionLabel && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 border-amber-300 text-amber-600 dark:text-amber-400">
              <Zap className="w-2.5 h-2.5" />
              Cond.
            </Badge>
          )}
        </div>

        {(nodeData.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {nodeData.tags!.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[8px] px-1 py-0 rounded bg-gray-200/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
            {nodeData.tags!.length > 3 && (
              <span className="text-[8px] text-gray-400">+{nodeData.tags!.length - 3}</span>
            )}
          </div>
        )}

        {getLinkedEntities(nodeData).map((le, idx) => (
          <EntityPreview
            key={le.entityId || idx}
            entityType={le.entityType}
            name={le.name}
            imageUrl={le.imageUrl}
            platform={le.platform}
            extra={le.extra || {}}
          />
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={cn("!w-3 !h-3 !border-2", theme.handle.bg, theme.handle.border)}
      />
    </div>
  );
}

function EntityPreview({
  entityType,
  name,
  imageUrl,
  platform,
  extra,
}: {
  entityType: EntityType;
  name: string;
  imageUrl?: string | null;
  platform?: string;
  extra: Record<string, any>;
}) {
  const theme = useContext(ThemeContext);
  const epBg = theme.entityPreview.bg;
  const epBorder = theme.entityPreview.border;
  const epText = theme.entityPreview.text;

  switch (entityType) {
    case "posts":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <span className="text-[9px] text-gray-400">POST</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
              {platform && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5">{platform}</Badge>
              )}
            </div>
          </div>
        </div>
      );

    case "ai_employees":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold"
              style={{ backgroundColor: ACCENT_COLOR_MAP[extra.accentColor] || "#6b7280" }}
            >
              {(extra.roleName || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{extra.roleName || name}</p>
              <StatusDotInline active={extra.isEnabled} />
            </div>
          </div>
        </div>
      );

    case "agents":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-emerald-600">WA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
              {extra.phoneNumber && <p className="text-[9px] text-gray-400 truncate">{extra.phoneNumber}</p>}
            </div>
          </div>
        </div>
      );

    case "booking":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-cyan-600">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>
                {extra.bookingSlug ? `/book/${extra.bookingSlug}` : "Prenotazione"}
              </p>
              <StatusDotInline active={extra.bookingPageEnabled} />
            </div>
          </div>
        </div>
      );

    case "services":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
            </div>
            {extra.priceCents != null && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono shrink-0">
                €{(Number(extra.priceCents) / 100).toFixed(2).replace(".", ",")}
              </Badge>
            )}
          </div>
        </div>
      );

    case "email_accounts":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-indigo-600">@</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
              <StatusDotInline active={extra.isActive} />
            </div>
          </div>
        </div>
      );

    case "voice_numbers":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-orange-600">📞</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name || extra.phoneNumber}</p>
              <StatusDotInline active={extra.isActive} />
            </div>
          </div>
        </div>
      );

    case "hunter_searches":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
              {extra.resultCount != null && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5">{String(extra.resultCount)} risultati</Badge>
              )}
            </div>
          </div>
        </div>
      );

    case "referral_config":
    case "optin_config":
    case "lead_magnet":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <StatusDotInline active={extra.isActive || extra.hasLeadMagnet} />
            <p className={cn("text-[10px] font-medium truncate", epText)}>
              {extra.headline || name}
            </p>
          </div>
        </div>
      );

    case "campaigns":
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
            </div>
            {extra.conversionRate != null && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                {Number(extra.conversionRate).toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      );

    default:
      return (
        <div className={cn("mt-2 p-1.5 rounded-md border", epBg, epBorder)}>
          <p className={cn("text-[10px] font-medium truncate", epText)}>{name}</p>
        </div>
      );
  }
}

function StatusDotInline({ active }: { active?: boolean }) {
  if (active === undefined || active === null) return null;
  return (
    <span
      className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0 inline-block",
        active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
      )}
    />
  );
}

export const FunnelNode = memo(FunnelNodeComponent);
