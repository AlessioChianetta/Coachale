import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  type FunnelNodeData,
  type EntityType,
  CATEGORY_COLORS,
  getNodeTypeDefinition,
} from "./funnel-node-types";

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
  const typeDef = getNodeTypeDefinition(nodeData.type);
  const colors = CATEGORY_COLORS[nodeData.category] || CATEGORY_COLORS.custom;
  const Icon = typeDef?.icon;

  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[220px] rounded-lg border-2 shadow-md transition-all duration-200",
        colors.bg,
        colors.border,
        selected && "ring-2 ring-offset-2 ring-blue-500 shadow-lg scale-105"
      )}
      style={{ borderLeftWidth: "4px", borderLeftColor: colors.accent }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {Icon && (
            <div
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                colors.text
              )}
              style={{ backgroundColor: `${colors.accent}20` }}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
              {nodeData.label}
            </p>
            {nodeData.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {nodeData.subtitle}
              </p>
            )}
          </div>
        </div>

        {nodeData.conversionRate !== undefined && nodeData.conversionRate > 0 && (
          <div className="mt-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {nodeData.conversionRate}% conv.
            </Badge>
          </div>
        )}

        {nodeData.linkedEntity && (
          <EntityPreview
            entityType={nodeData.linkedEntity.entityType}
            name={nodeData.linkedEntity.name}
            imageUrl={nodeData.linkedEntity.imageUrl}
            platform={nodeData.linkedEntity.platform}
            extra={nodeData.linkedEntity.extra || {}}
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800"
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
  switch (entityType) {
    case "posts":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <span className="text-[9px] text-gray-400">POST</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
              {platform && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5">{platform}</Badge>
              )}
            </div>
          </div>
        </div>
      );

    case "ai_employees":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold"
              style={{ backgroundColor: ACCENT_COLOR_MAP[extra.accentColor] || "#6b7280" }}
            >
              {(extra.roleName || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{extra.roleName || name}</p>
              <StatusDotInline active={extra.isEnabled} />
            </div>
          </div>
        </div>
      );

    case "agents":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-emerald-600">WA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
              {extra.phoneNumber && <p className="text-[9px] text-gray-400 truncate">{extra.phoneNumber}</p>}
            </div>
          </div>
        </div>
      );

    case "booking":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-cyan-600">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">
                {extra.bookingSlug ? `/book/${extra.bookingSlug}` : "Prenotazione"}
              </p>
              <StatusDotInline active={extra.bookingPageEnabled} />
            </div>
          </div>
        </div>
      );

    case "services":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
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
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-indigo-600">@</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
              <StatusDotInline active={extra.isActive} />
            </div>
          </div>
        </div>
      );

    case "voice_numbers":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-orange-600">📞</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name || extra.phoneNumber}</p>
              <StatusDotInline active={extra.isActive} />
            </div>
          </div>
        </div>
      );

    case "hunter_searches":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
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
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <StatusDotInline active={extra.isActive || extra.hasLeadMagnet} />
            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">
              {extra.headline || name}
            </p>
          </div>
        </div>
      );

    case "campaigns":
      return (
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
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
        <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
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
