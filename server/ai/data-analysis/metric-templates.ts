/**
 * Metric Templates with Placeholder Columns
 * These templates use {logical_column} placeholders that get resolved to physical columns
 * 
 * UNIVERSAL BI METRICS
 * All metrics use logical roles, NOT physical column names
 * document_id = universal document identifier (order, DDT, invoice, receipt)
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
  document_count: {
    name: "document_count",
    displayName: "Numero Documenti",
    description: "Conteggio documenti unici (DDT, fatture, ordini, scontrini)",
    sqlTemplate: 'COUNT(DISTINCT {document_id})',
    requiredLogicalColumns: ["document_id"],
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
    description: "Conteggio ordini/documenti unici (usa document_id)",
    sqlTemplate: 'COUNT(DISTINCT {document_id})',
    requiredLogicalColumns: ["document_id"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 2,
  },
  ticket_medio: {
    name: "ticket_medio",
    displayName: "Ticket Medio",
    description: "Valore medio per documento (fatturato / numero documenti)",
    sqlTemplate: 'SUM(CAST({revenue_amount} AS NUMERIC)) / NULLIF(COUNT(DISTINCT {document_id}), 0)',
    requiredLogicalColumns: ["revenue_amount", "document_id"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 2,
  },
  customer_count: {
    name: "customer_count",
    displayName: "Numero Clienti",
    description: "Conteggio clienti unici",
    sqlTemplate: 'COUNT(DISTINCT {customer_id})',
    requiredLogicalColumns: ["customer_id"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  product_count: {
    name: "product_count",
    displayName: "Numero Prodotti",
    description: "Conteggio prodotti unici",
    sqlTemplate: 'COUNT(DISTINCT {product_id})',
    requiredLogicalColumns: ["product_id"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  supplier_count: {
    name: "supplier_count",
    displayName: "Numero Fornitori",
    description: "Conteggio fornitori unici",
    sqlTemplate: 'COUNT(DISTINCT {supplier_id})',
    requiredLogicalColumns: ["supplier_id"],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: false,
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
      minValue: 0,
    },
    isPrimary: true,
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
  avg_items_per_document: {
    name: "avg_items_per_document",
    displayName: "Media Articoli per Documento",
    description: "Numero medio di articoli per documento/ordine",
    sqlTemplate: 'COUNT(*) / NULLIF(COUNT(DISTINCT {document_id}), 0)',
    requiredLogicalColumns: ["document_id"],
    unit: "number",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  avg_quantity_per_line: {
    name: "avg_quantity_per_line",
    displayName: "Media Quantità per Riga",
    description: "Quantità media per riga documento",
    sqlTemplate: 'AVG(CAST({quantity} AS NUMERIC))',
    requiredLogicalColumns: ["quantity"],
    unit: "number",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },

  // ============================================
  // DATA QUALITY METRICS (Sanity Checks)
  // ============================================
  lines_count: {
    name: "lines_count",
    displayName: "Conteggio Righe",
    description: "Numero totale di righe nel dataset",
    sqlTemplate: 'COUNT(*)',
    requiredLogicalColumns: [],
    unit: "count",
    validationRules: {
      mustBePositive: true,
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  missing_cost_lines: {
    name: "missing_cost_lines",
    displayName: "Righe Senza Costo",
    description: "Conteggio righe con costo mancante o zero (indicatore qualità dati)",
    sqlTemplate: 'SUM(CASE WHEN {cost} IS NULL OR CAST({cost} AS NUMERIC) <= 0 THEN 1 ELSE 0 END)',
    requiredLogicalColumns: ["cost"],
    unit: "count",
    validationRules: {
      mustBeInteger: true,
      minValue: 0,
      warningThreshold: 1,
      warningMessage: "Righe con costo mancante - i calcoli di margine potrebbero essere imprecisi",
    },
    isPrimary: false,
    version: 1,
  },
  missing_price_lines: {
    name: "missing_price_lines",
    displayName: "Righe Senza Prezzo",
    description: "Conteggio righe con prezzo mancante o zero (indicatore qualità dati)",
    sqlTemplate: 'SUM(CASE WHEN {price} IS NULL OR CAST({price} AS NUMERIC) <= 0 THEN 1 ELSE 0 END)',
    requiredLogicalColumns: ["price"],
    unit: "count",
    validationRules: {
      mustBeInteger: true,
      minValue: 0,
      warningThreshold: 1,
      warningMessage: "Righe con prezzo mancante - i calcoli di fatturato potrebbero essere imprecisi",
    },
    isPrimary: false,
    version: 1,
  },
  negative_revenue_lines: {
    name: "negative_revenue_lines",
    displayName: "Righe Fatturato Negativo",
    description: "Conteggio righe con fatturato negativo o zero (resi, errori, omaggi)",
    sqlTemplate: 'SUM(CASE WHEN {revenue_amount} IS NULL OR CAST({revenue_amount} AS NUMERIC) <= 0 THEN 1 ELSE 0 END)',
    requiredLogicalColumns: ["revenue_amount"],
    unit: "count",
    validationRules: {
      mustBeInteger: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },
  unmapped_category_lines: {
    name: "unmapped_category_lines",
    displayName: "Righe Senza Categoria",
    description: "Conteggio righe con categoria mancante o vuota (indicatore qualità dati)",
    sqlTemplate: "SUM(CASE WHEN {category} IS NULL OR TRIM({category}) = '' THEN 1 ELSE 0 END)",
    requiredLogicalColumns: ["category"],
    unit: "count",
    validationRules: {
      mustBeInteger: true,
      minValue: 0,
      warningThreshold: 1,
      warningMessage: "Righe senza categoria - le analisi per categoria saranno incomplete",
    },
    isPrimary: false,
    version: 1,
  },

  // ============================================
  // MENU ENGINEERING METRICS (Unit Margins)
  // ============================================
  gross_margin_per_item: {
    name: "gross_margin_per_item",
    displayName: "Margine per Unità",
    description: "Margine lordo medio per singola unità venduta (per menu engineering)",
    sqlTemplate: 'SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({quantity} AS NUMERIC)), 0)',
    requiredLogicalColumns: ["price", "cost", "quantity"],
    unit: "currency",
    validationRules: {},
    isPrimary: true,
    version: 1,
  },
  gross_margin_per_document: {
    name: "gross_margin_per_document",
    displayName: "Margine per Scontrino",
    description: "Margine lordo medio per documento/scontrino/ordine",
    sqlTemplate: 'SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC)) / NULLIF(COUNT(DISTINCT {document_id}), 0)',
    requiredLogicalColumns: ["price", "cost", "quantity", "document_id"],
    unit: "currency",
    validationRules: {},
    isPrimary: true, // Make primary for better visibility
    version: 1,
    aliases: ["margine_medio_scontrino", "margin_per_order", "margine_per_ordine"],
  },

  // ============================================
  // WEIGHTED AVERAGES (More accurate than simple AVG)
  // ============================================
  avg_unit_price_weighted: {
    name: "avg_unit_price_weighted",
    displayName: "Prezzo Medio Ponderato",
    description: "Prezzo medio ponderato per quantità venduta (più accurato di AVG semplice)",
    sqlTemplate: 'SUM(CAST({price} AS NUMERIC) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({quantity} AS NUMERIC)), 0)',
    requiredLogicalColumns: ["price", "quantity"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: true,
    version: 1,
  },
  avg_unit_cost_weighted: {
    name: "avg_unit_cost_weighted",
    displayName: "Costo Medio Ponderato",
    description: "Costo medio ponderato per quantità (più accurato di AVG semplice)",
    sqlTemplate: 'SUM(CAST({cost} AS NUMERIC) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(CAST({quantity} AS NUMERIC)), 0)',
    requiredLogicalColumns: ["cost", "quantity"],
    unit: "currency",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
    },
    isPrimary: false,
    version: 1,
  },

  // ============================================
  // MIX / INCIDENCE METRICS (for category analysis)
  // Use window functions for true share % calculations
  // Formula: category_value / total_value * 100
  // ============================================
  category_revenue_share: {
    name: "category_revenue_share",
    displayName: "Incidenza Fatturato %",
    description: "Percentuale del fatturato totale per categoria (usa window function per calcolo corretto)",
    sqlTemplate: 'SUM(CAST({revenue_amount} AS NUMERIC)) / NULLIF(SUM(SUM(CAST({revenue_amount} AS NUMERIC))) OVER (), 0) * 100',
    requiredLogicalColumns: ["revenue_amount", "category"],
    unit: "percentage",
    validationRules: {
      mustBePositive: true,
      minValue: 0,
      maxValue: 100,
    },
    isPrimary: false,
    version: 2,
  },
  category_margin_share: {
    name: "category_margin_share",
    displayName: "Incidenza Margine %",
    description: "Percentuale del margine totale per categoria (usa window function per calcolo corretto)",
    sqlTemplate: 'SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC)) / NULLIF(SUM(SUM((CAST({price} AS NUMERIC) - CAST({cost} AS NUMERIC)) * CAST({quantity} AS NUMERIC))) OVER (), 0) * 100',
    requiredLogicalColumns: ["price", "cost", "quantity", "category"],
    unit: "percentage",
    validationRules: {
      minValue: 0,
      maxValue: 100,
    },
    isPrimary: false,
    version: 2,
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

export function getMetricsForLogicalColumn(logicalColumn: string): string[] {
  return Object.entries(METRIC_TEMPLATES)
    .filter(([_, template]) => template.requiredLogicalColumns.includes(logicalColumn))
    .map(([name, _]) => name);
}
