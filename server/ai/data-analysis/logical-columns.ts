/**
 * Logical Columns Definition
 * Standard semantic column names that metrics can reference
 */

export interface LogicalColumnDefinition {
  name: string;
  displayName: string;
  displayNameIt: string;
  dataType: "NUMERIC" | "TEXT" | "DATE" | "INTEGER";
  description: string;
  requiredForMetrics: string[];
}

export const LOGICAL_COLUMNS: Record<string, LogicalColumnDefinition> = {
  revenue_amount: {
    name: "revenue_amount",
    displayName: "Revenue Amount (Line Total)",
    displayNameIt: "Importo Fatturato (Totale Riga)",
    dataType: "NUMERIC",
    description: "Final revenue amount per line (post-discount, ready to sum). Use this instead of price*quantity when available.",
    requiredForMetrics: ["revenue"],
  },
  price: {
    name: "price",
    displayName: "Selling Price",
    displayNameIt: "Prezzo di Vendita",
    dataType: "NUMERIC",
    description: "Unit selling price before discounts (use revenue_amount for final values)",
    requiredForMetrics: ["revenue_gross", "revenue_calculated", "food_cost_percent", "avg_unit_price"],
  },
  cost: {
    name: "cost",
    displayName: "Unit Cost",
    displayNameIt: "Costo Unitario",
    dataType: "NUMERIC",
    description: "Unit cost/purchase price",
    requiredForMetrics: ["food_cost", "food_cost_percent", "gross_margin", "gross_margin_percent"],
  },
  quantity: {
    name: "quantity",
    displayName: "Quantity",
    displayNameIt: "Quantità",
    dataType: "NUMERIC",
    description: "Number of units sold",
    requiredForMetrics: ["revenue_gross", "revenue", "food_cost", "food_cost_percent", "quantity_total", "gross_margin"],
  },
  total_net: {
    name: "total_net",
    displayName: "Net Total",
    displayNameIt: "Totale Netto",
    dataType: "NUMERIC",
    description: "Net total after discounts",
    requiredForMetrics: ["revenue_net", "ticket_medio", "gross_margin", "gross_margin_percent"],
  },
  discount_percent: {
    name: "discount_percent",
    displayName: "Discount %",
    displayNameIt: "Sconto %",
    dataType: "NUMERIC",
    description: "Discount percentage applied",
    requiredForMetrics: ["discount_total"],
  },
  order_id: {
    name: "order_id",
    displayName: "Order ID",
    displayNameIt: "ID Ordine",
    dataType: "TEXT",
    description: "Unique order/receipt identifier",
    requiredForMetrics: ["order_count"],
  },
  product_name: {
    name: "product_name",
    displayName: "Product Name",
    displayNameIt: "Nome Prodotto",
    dataType: "TEXT",
    description: "Name of the product/item",
    requiredForMetrics: [],
  },
  category: {
    name: "category",
    displayName: "Category",
    displayNameIt: "Categoria",
    dataType: "TEXT",
    description: "Product category",
    requiredForMetrics: [],
  },
  order_date: {
    name: "order_date",
    displayName: "Order Date",
    displayNameIt: "Data Ordine",
    dataType: "DATE",
    description: "Date of the order/transaction",
    requiredForMetrics: [],
  },
};

export const COLUMN_AUTO_DETECT_PATTERNS: Record<string, RegExp[]> = {
  revenue_amount: [
    /^prezzo_?finale$/i,
    /^prezzofinale$/i,
    /^importo_?riga$/i,
    /^line_?total$/i,
    /^totale_?riga$/i,
    /^importo_?fatturato$/i,
    /^net_?amount$/i,
    /^final_?price$/i,
    /^importo2$/i,
  ],
  price: [
    /^(unit_)?price$/i,
    /^prezzo(_unitario)?$/i,
    /^selling_price$/i,
    /^importo_vendita$/i,
    /^pvp$/i,
    /^listino$/i,
  ],
  cost: [
    /^(unit_)?cost$/i,
    /^costo(_unitario)?$/i,
    /^food_cost$/i,
    /^costo_acquisto$/i,
    /^purchase_price$/i,
    /^costo$/i,
  ],
  quantity: [
    /^(qty|quantity|quantita|qta)$/i,
    /^numero_pezzi$/i,
    /^pieces$/i,
    /^units$/i,
  ],
  total_net: [
    /^total_net$/i,
    /^totale_netto$/i,
    /^net_total$/i,
    /^importo_totale$/i,
    /^importo$/i,
    /^amount$/i,
  ],
  discount_percent: [
    /^discount(_percent)?$/i,
    /^sconto(_percentuale)?$/i,
    /^discount_pct$/i,
  ],
  order_id: [
    /^order_id$/i,
    /^id_ordine$/i,
    /^scontrino$/i,
    /^receipt_id$/i,
    /^transaction_id$/i,
    /^numero_ordine$/i,
  ],
  product_name: [
    /^(product_)?name$/i,
    /^nome(_prodotto)?$/i,
    /^item(_name)?$/i,
    /^descrizione$/i,
    /^description$/i,
    /^articolo$/i,
  ],
  category: [
    /^category$/i,
    /^categoria$/i,
    /^cat$/i,
    /^product_category$/i,
    /^tipo$/i,
    /^type$/i,
  ],
  order_date: [
    /^(order_)?date$/i,
    /^data(_ordine)?$/i,
    /^timestamp$/i,
    /^created_at$/i,
    /^transaction_date$/i,
    /^data$/i,
  ],
};

export function getLogicalColumnDisplayName(logicalColumn: string, locale: "en" | "it" = "it"): string {
  const col = LOGICAL_COLUMNS[logicalColumn];
  if (!col) return logicalColumn;
  return locale === "it" ? col.displayNameIt : col.displayName;
}

export function getLogicalColumnNames(): string[] {
  return Object.keys(LOGICAL_COLUMNS);
}

export function getMetricsRequiringColumn(logicalColumn: string): string[] {
  const col = LOGICAL_COLUMNS[logicalColumn];
  return col?.requiredForMetrics || [];
}

export function autoDetectLogicalColumn(physicalColumnName: string): { logicalColumn: string; confidence: number } | null {
  const nameLower = physicalColumnName.toLowerCase().trim();
  
  for (const [logical, patterns] of Object.entries(COLUMN_AUTO_DETECT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(nameLower)) {
        const isExactMatch = patterns[0].test(nameLower);
        return {
          logicalColumn: logical,
          confidence: isExactMatch ? 0.95 : 0.80,
        };
      }
    }
  }
  
  return null;
}

export function autoDetectAllColumns(physicalColumns: string[]): Map<string, { logicalColumn: string; confidence: number }> {
  const mappings = new Map<string, { logicalColumn: string; confidence: number }>();
  const usedLogical = new Set<string>();
  
  const detections: Array<{ physical: string; logical: string; confidence: number }> = [];
  
  for (const physical of physicalColumns) {
    const detected = autoDetectLogicalColumn(physical);
    if (detected) {
      detections.push({ 
        physical, 
        logical: detected.logicalColumn, 
        confidence: detected.confidence 
      });
    }
  }
  
  detections.sort((a, b) => b.confidence - a.confidence);
  
  for (const detection of detections) {
    if (!usedLogical.has(detection.logical)) {
      mappings.set(detection.physical, {
        logicalColumn: detection.logical,
        confidence: detection.confidence,
      });
      usedLogical.add(detection.logical);
    }
  }
  
  return mappings;
}
