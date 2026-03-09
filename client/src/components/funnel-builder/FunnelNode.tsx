import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  type FunnelNodeData,
  CATEGORY_COLORS,
  getNodeTypeDefinition,
} from "./funnel-node-types";

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
          <div className="mt-2 p-1.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              {nodeData.linkedEntity.imageUrl && (
                <img
                  src={nodeData.linkedEntity.imageUrl}
                  alt=""
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">
                  {nodeData.linkedEntity.name}
                </p>
                {nodeData.linkedEntity.platform && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">
                    {nodeData.linkedEntity.platform}
                  </Badge>
                )}
              </div>
            </div>
          </div>
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

export const FunnelNode = memo(FunnelNodeComponent);
