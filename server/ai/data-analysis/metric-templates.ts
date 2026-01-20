/**
 * Metric Templates with Placeholder Columns
 * These templates use {logical_column} placeholders that get resolved to physical columns
 */

export interface MetricTemplate {
  name: string;
  displayName: string;
  description: string;
  sqlTemplate: string;
  requiredLogicalColumns: string[];
  unit: "currency" | "percentage" | "number" | "count";
  validationRules: {
    minValue?: number;
    maxValue?: number;
    mustBePositive?: boolean;
    mustBeInteger?: boolean;
    warningThreshold?: number;
    warningMessage?: string;
  };
  isPrimary: boolean;
  version: number;
}

export const METRIC_TEMPLATES: Record<string, MetricTemplate> = {
  revenue_gross: {
    name: "revenue_gross",
    displayName: "Fatturato Lordo",
    description: "Fatturato lordo (prezzo unitario × quantità, prima degli sconti)",
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["price", "quantity"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  revenue_net: {
    name: "revenue_net",
    displayName: "Fatturato Netto",
    description: "Fatturato netto (dopo sconti)",
    sqlTemplate: 'SUM(CAST({total_net} AS NUMERIC))',
    requiredLogicalColumns: ["total_net"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  revenue: {
    name: "revenue",
    displayName: "Fatturato",
    description: "Fatturato reale (somma degli importi riga già calcolati, post-sconti). Usa revenue_amount, NON price*quantity.",
    sqlTemplate: 'SUM(CAST({revenue_amount} AS NUMERIC))',
    requiredLogicalColumns: ["revenue_amount"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 2,
  },
  revenue_calculated: {
    name: "revenue_calculated",
    displayName: "Fatturato Calcolato",
    description: "Fatturato calcolato come prezzo × quantità (SOLO se revenue_amount non disponibile)",
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["price", "quantity"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  food_cost: {
    name: "food_cost",
    displayName: "Food Cost",
    description: "Costo totale delle materie prime",
    sqlTemplate: 'SUM(CAST({cost} AS NUMERIC) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["cost", "quantity"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  food_cost_percent: {
    name: "food_cost_percent",
    displayName: "Food Cost %",
    description: "Percentuale food cost su fatturato LORDO (standard ristorazione)",
    sqlTemplate: '(SUM(CAST({cost} AS NUMERIC) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)), 0)) * 100',
    requiredLogicalColumns: ["cost", "price", "quantity"],
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
      warningThreshold: 35,
      warningMessage: "Food cost superiore al 35% - verificare margini",
    },
    isPrimary: true,
    version: 1,
  },
  ticket_medio: {
    name: "ticket_medio",
    displayName: "Ticket Medio",
    description: "Valore medio per ordine (fatturato / numero ordini)",
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)) / NULLIF(COUNT(DISTINCT {order_id}), 0)',
    requiredLogicalColumns: ["price", "quantity", "order_id"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  quantity_total: {
    name: "quantity_total",
    displayName: "Quantità Totale",
    description: "Numero totale di articoli venduti",
    sqlTemplate: 'SUM(CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["quantity"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  order_count: {
    name: "order_count",
    displayName: "Numero Ordini",
    description: "Conteggio ordini unici",
    sqlTemplate: 'COUNT(DISTINCT {order_id})',
    requiredLogicalColumns: ["order_id"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  avg_unit_price: {
    name: "avg_unit_price",
    displayName: "Prezzo Medio Unitario",
    description: "Prezzo medio per unità venduta",
    sqlTemplate: 'AVG(CAST({price} AS NUMERIC))',
    requiredLogicalColumns: ["price"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  gross_margin: {
    name: "gross_margin",
    displayName: "Margine Lordo",
    description: "Fatturato meno food cost: SUM((prezzo - costo) * quantità)",
    sqlTemplate: 'SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["price", "cost", "quantity"],
    unit: "currency",
    validationRules: {},
    isPrimary: true,
    version: 1,
  },
  gross_margin_percent: {
    name: "gross_margin_percent",
    displayName: "Margine Lordo %",
    description: "Percentuale margine lordo su fatturato",
    sqlTemplate: '(SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)), 0)) * 100',
    requiredLogicalColumns: ["price", "cost", "quantity"],
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
    },
    isPrimary: false,
    version: 1,
  },
  discount_total: {
    name: "discount_total",
    displayName: "Sconti Totali",
    description: "Somma degli sconti applicati sul fatturato lordo",
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC) * (CAST({discount_percent} AS NUMERIC) / 100))',
    requiredLogicalColumns: ["price", "quantity", "discount_percent"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  discount_percent_on_revenue: {
    name: "discount_percent_on_revenue",
    displayName: "Incidenza Sconti %",
    description: "Percentuale sconti sul fatturato lordo",
    sqlTemplate: '(SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC) * (CAST({discount_percent} AS NUMERIC) / 100)) / NULLIF(SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)), 0)) * 100',
    requiredLogicalColumns: ["price", "quantity", "discount_percent"],
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
    },
    isPrimary: false,
    version: 1,
  },
};

export function getMetricTemplate(name: string): MetricTemplate | null {
  return METRIC_TEMPLATES[name] || null;
}

export function getMetricTemplateNames(): string[] {
  return Object.keys(METRIC_TEMPLATES);
}

export function isValidMetricTemplate(name: string): boolean {
  return name in METRIC_TEMPLATES;
}

export function getMetricTemplateDescriptions(): string {
  return Object.entries(METRIC_TEMPLATES)
    .map(([name, def]) => `- ${name}: ${def.displayName} (${def.description})`)
    .join("\n");
}

export function getPrimaryMetricTemplates(): MetricTemplate[] {
  return Object.values(METRIC_TEMPLATES).filter((m) => m.isPrimary);
}
