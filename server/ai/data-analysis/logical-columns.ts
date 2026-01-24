/**
 * Logical Columns Definition
 * Standard semantic column names that metrics can reference
 * 
 * UNIVERSAL BI SEMANTIC LAYER
 * Supports: POS, DDT, Invoices, E-commerce, ERP, any CSV
 */

export interface LogicalColumnDefinition {
  name: string;
  displayName: string;
  displayNameIt: string;
  dataType: "NUMERIC" | "TEXT" | "DATE" | "INTEGER";
  description: string;
  requiredForMetrics: string[];
  aliases?: string[];
}

export const LOGICAL_COLUMNS: Record<string, LogicalColumnDefinition> = {
  document_id: {
    name: "document_id",
    displayName: "Document ID",
    displayNameIt: "ID Documento",
    dataType: "TEXT",
    description: "Unique document/order/invoice identifier (universal: works for DDT, orders, invoices, receipts)",
    requiredForMetrics: ["document_count", "order_count", "ticket_medio"],
    aliases: ["order_id"],
  },
  order_id: {
    name: "order_id",
    displayName: "Order ID",
    displayNameIt: "ID Ordine",
    dataType: "TEXT",
    description: "Unique order/receipt identifier (alias for document_id in POS context)",
    requiredForMetrics: [],
    aliases: ["document_id"],
  },
  line_id: {
    name: "line_id",
    displayName: "Line ID",
    displayNameIt: "ID Riga",
    dataType: "TEXT",
    description: "Unique line/detail row identifier",
    requiredForMetrics: [],
  },
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
    requiredForMetrics: ["revenue_net"],
  },
  discount_percent: {
    name: "discount_percent",
    displayName: "Discount %",
    displayNameIt: "Sconto %",
    dataType: "NUMERIC",
    description: "Discount percentage applied",
    requiredForMetrics: ["discount_total"],
  },
  discount_amount: {
    name: "discount_amount",
    displayName: "Discount Amount",
    displayNameIt: "Importo Sconto",
    dataType: "NUMERIC",
    description: "Absolute discount amount",
    requiredForMetrics: [],
  },
  product_id: {
    name: "product_id",
    displayName: "Product ID",
    displayNameIt: "ID Prodotto",
    dataType: "TEXT",
    description: "Unique product/SKU identifier",
    requiredForMetrics: ["product_count"],
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
  customer_id: {
    name: "customer_id",
    displayName: "Customer ID",
    displayNameIt: "ID Cliente",
    dataType: "TEXT",
    description: "Unique customer identifier",
    requiredForMetrics: ["customer_count"],
  },
  customer_name: {
    name: "customer_name",
    displayName: "Customer Name",
    displayNameIt: "Nome Cliente",
    dataType: "TEXT",
    description: "Customer name or company name",
    requiredForMetrics: [],
  },
  tax_amount: {
    name: "tax_amount",
    displayName: "Tax Amount",
    displayNameIt: "Importo IVA",
    dataType: "NUMERIC",
    description: "Tax/VAT amount",
    requiredForMetrics: [],
  },
  tax_rate: {
    name: "tax_rate",
    displayName: "Tax Rate",
    displayNameIt: "Aliquota IVA",
    dataType: "NUMERIC",
    description: "Tax/VAT rate percentage",
    requiredForMetrics: [],
  },
  payment_method: {
    name: "payment_method",
    displayName: "Payment Method",
    displayNameIt: "Metodo Pagamento",
    dataType: "TEXT",
    description: "Payment method used",
    requiredForMetrics: [],
  },
  status: {
    name: "status",
    displayName: "Status",
    displayNameIt: "Stato",
    dataType: "TEXT",
    description: "Document/order status",
    requiredForMetrics: [],
  },
  supplier_id: {
    name: "supplier_id",
    displayName: "Supplier ID",
    displayNameIt: "ID Fornitore",
    dataType: "TEXT",
    description: "Unique supplier/vendor identifier",
    requiredForMetrics: ["supplier_count"],
  },
  supplier_name: {
    name: "supplier_name",
    displayName: "Supplier Name",
    displayNameIt: "Nome Fornitore",
    dataType: "TEXT",
    description: "Supplier/vendor name",
    requiredForMetrics: [],
  },
  warehouse: {
    name: "warehouse",
    displayName: "Warehouse",
    displayNameIt: "Magazzino",
    dataType: "TEXT",
    description: "Warehouse or storage location",
    requiredForMetrics: [],
  },
  // === LINE CLASSIFICATION (for POS data quality) ===
  line_type: {
    name: "line_type",
    displayName: "Line Type",
    displayNameIt: "Tipo Riga",
    dataType: "TEXT",
    description: "Classification of line: product (sellable item), modifier (extra/additions), note (kitchen notes)",
    requiredForMetrics: [],
  },
  is_sellable: {
    name: "is_sellable",
    displayName: "Is Sellable Item",
    displayNameIt: "È Prodotto Vendibile",
    dataType: "INTEGER", // 0/1 boolean
    description: "Whether this line represents a real sellable product (1) or a modifier/note (0). Used for automatic filtering in analytics.",
    requiredForMetrics: [],
  },
  // === NEW ROLES FOR RESTAURANT/POS ANALYTICS ===
  document_type: {
    name: "document_type",
    displayName: "Document Type",
    displayNameIt: "Tipo Documento",
    dataType: "TEXT",
    description: "Transaction classification: sale (normal sale), refund (return), void (cancelled), staff_meal (staff consumption). Default: sale if not present.",
    requiredForMetrics: ["revenue", "gross_margin"],
    aliases: ["transaction_type", "tipo_transazione"],
  },
  time_slot: {
    name: "time_slot",
    displayName: "Time Slot",
    displayNameIt: "Fascia Oraria",
    dataType: "TEXT",
    description: "Service time classification: breakfast (06:00-11:00), lunch (11:00-15:00), dinner (18:00-23:00), late (23:00-04:00). Can be calculated from order_date if not present.",
    requiredForMetrics: [],
    aliases: ["fascia_oraria", "turno", "shift"],
  },
  sales_channel: {
    name: "sales_channel",
    displayName: "Sales Channel",
    displayNameIt: "Canale Vendita",
    dataType: "TEXT",
    description: "Service modality: dine_in (in-restaurant), takeaway (pickup), delivery (home delivery). Default: dine_in if not present.",
    requiredForMetrics: [],
    aliases: ["canale", "channel", "modalita_servizio"],
  },
};

export const COLUMN_AUTO_DETECT_PATTERNS: Record<string, RegExp[]> = {
  document_id: [
    /^idddt/i,
    /^id_?ddt/i,
    /^doc_?id/i,
    /^document_?id/i,
    /^id_?documento/i,
    /^numero_?doc/i,
    /^invoice_?id/i,
    /^fattura_?id/i,
    /^id_?fattura/i,
    /^receipt_?id/i,
    /^scontrino/i,
    /^order_?id/i,
    /^id_?ordine/i,
    /^transaction_?id/i,
    /^numero_?ordine/i,
  ],
  line_id: [
    /^id_?riga/i,
    /^line_?id/i,
    /^detail_?id/i,
    /^idriga/i,
    /^riga_?id/i,
    /^row_?id/i,
  ],
  revenue_amount: [
    /^prezzo_?finale/i,
    /^prezzofinale/i,
    /^importo_?riga/i,
    /^line_?total/i,
    /^totale_?riga/i,
    /^importo_?fatturato/i,
    /^net_?amount/i,
    /^final_?price/i,
    /^importo2/i,
    /^total_?line/i,
    /^row_?total/i,
    /^amount/i,
  ],
  price: [
    /^prezzo$/i,
    /^price$/i,
    /^unit_?price/i,
    /^prezzo_?unitario/i,
    /^selling_?price/i,
    /^importo_?vendita/i,
    /^pvp$/i,
    /^listino/i,
  ],
  cost: [
    /^costo$/i,
    /^cost$/i,
    /^cost_?amount/i,
    /^costo_?amount/i,
    /^unit_?cost/i,
    /^costo_?unitario/i,
    /^food_?cost/i,
    /^costo_?acquisto/i,
    /^costo_?produzione/i,
    /^costoproduzione/i,
    /^prezzo_?acquisto/i,
    /^purchase_?price/i,
    /^buy_?price/i,
    /^costo_?materia/i,
    /^raw_?cost/i,
  ],
  quantity: [
    /^quantita/i,
    /^quantity/i,
    /^qty/i,
    /^qta/i,
    /^numero_?pezzi/i,
    /^pieces/i,
    /^units/i,
    /^pezzi/i,
  ],
  total_net: [
    /^total_?net/i,
    /^totale_?netto/i,
    /^net_?total/i,
    /^importo_?totale/i,
    /^importo$/i,
  ],
  discount_percent: [
    /^sconto_?percent/i,
    /^discount_?percent/i,
    /^sconto_?perc/i,
    /^discount_?pct/i,
    /^perc_?sconto/i,
  ],
  discount_amount: [
    /^sconto$/i,
    /^discount$/i,
    /^sconto_?importo/i,
    /^discount_?amount/i,
    /^importo_?sconto/i,
  ],
  product_id: [
    /^idprodotto/i,
    /^id_?prodotto/i,
    /^product_?id/i,
    /^sku/i,
    /^codice_?articolo/i,
    /^item_?id/i,
    /^cod_?art/i,
    /^codart/i,
    /^article_?id/i,
    /^art_?id/i,
  ],
  product_name: [
    /^descrprod/i,
    /^descr_?prod/i,
    /^product_?name/i,
    /^nome_?prodotto/i,
    /^descrizione/i,
    /^description/i,
    /^articolo/i,
    /^item_?name/i,
    /^prodotto/i,
  ],
  category: [
    /^categoria/i,
    /^category/i,
    /^cat$/i,
    /^product_?category/i,
    /^tipologia/i,
    /^tipo$/i,
    /^type$/i,
    /^famiglia/i,
    /^group/i,
    /^gruppo/i,
  ],
  order_date: [
    /^data$/i,
    /^date$/i,
    /^data_?doc/i,
    /^data_?ordine/i,
    /^order_?date/i,
    /^invoice_?date/i,
    /^data_?fattura/i,
    /^timestamp/i,
    /^created_?at/i,
    /^transaction_?date/i,
    /^data_?documento/i,
  ],
  customer_id: [
    /^idcliente/i,
    /^id_?cliente/i,
    /^customer_?id/i,
    /^client_?id/i,
    /^cod_?cliente/i,
    /^codcliente/i,
    /^buyer_?id/i,
  ],
  customer_name: [
    /^ragione_?sociale/i,
    /^customer_?name/i,
    /^cliente/i,
    /^nominativo/i,
    /^client_?name/i,
    /^buyer_?name/i,
    /^intestatario/i,
  ],
  tax_amount: [
    /^iva$/i,
    /^tax$/i,
    /^vat$/i,
    /^imposta/i,
    /^importo_?iva/i,
    /^tax_?amount/i,
    /^vat_?amount/i,
  ],
  tax_rate: [
    /^aliquota/i,
    /^tax_?rate/i,
    /^vat_?rate/i,
    /^iva_?perc/i,
    /^perc_?iva/i,
  ],
  payment_method: [
    /^pagamento/i,
    /^payment/i,
    /^payment_?method/i,
    /^tipo_?pagamento/i,
    /^modalita_?pagamento/i,
    /^metodo_?pagamento/i,
  ],
  status: [
    /^stato$/i,
    /^status$/i,
    /^state$/i,
    /^order_?status/i,
    /^doc_?status/i,
  ],
  supplier_id: [
    /^id_?fornitore/i,
    /^idfornitore/i,
    /^supplier_?id/i,
    /^vendor_?id/i,
    /^cod_?fornitore/i,
    /^codfornitore/i,
  ],
  supplier_name: [
    /^fornitore/i,
    /^supplier/i,
    /^supplier_?name/i,
    /^vendor/i,
    /^vendor_?name/i,
    /^ragione_?sociale_?fornitore/i,
  ],
  warehouse: [
    /^magazzino/i,
    /^warehouse/i,
    /^deposito/i,
    /^storage/i,
    /^location/i,
  ],
  line_type: [
    /^tipo_?riga/i,
    /^tiporiga/i,
    /^line_?type/i,
    /^row_?type/i,
    /^tipo_?linea/i,
  ],
  is_sellable: [
    /^vendibile/i,
    /^is_?sellable/i,
    /^sellable/i,
    /^is_?product/i,
    /^is_?item/i,
  ],
  // === NEW ROLES FOR RESTAURANT/POS ANALYTICS ===
  document_type: [
    /^tipo_?doc/i,
    /^tipodoc/i,
    /^document_?type/i,
    /^doc_?type/i,
    /^transaction_?type/i,
    /^tipo_?transazione/i,
    /^tipotransazione/i,
    /^tipo_?movimento/i,
    /^movement_?type/i,
  ],
  time_slot: [
    /^fascia_?oraria/i,
    /^fasciaoraria/i,
    /^time_?slot/i,
    /^timeslot/i,
    /^turno/i,
    /^shift/i,
    /^servizio/i,
    /^service_?period/i,
    /^meal_?period/i,
  ],
  sales_channel: [
    /^canale/i,
    /^channel/i,
    /^sales_?channel/i,
    /^modalita_?servizio/i,
    /^service_?mode/i,
    /^order_?type/i,
    /^tipo_?ordine/i,
    /^delivery_?type/i,
    /^dine_?in/i,
    /^takeaway/i,
    /^asporto/i,
  ],
};

export const LOGICAL_COLUMN_ALIASES: Record<string, string[]> = {
  document_id: ["order_id"],
  order_id: ["document_id"],
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

export function getAliasesForColumn(logicalColumn: string): string[] {
  return LOGICAL_COLUMN_ALIASES[logicalColumn] || [];
}

export function autoDetectLogicalColumn(physicalColumnName: string): { logicalColumn: string; confidence: number } | null {
  const nameLower = physicalColumnName.toLowerCase().trim();
  
  for (const [logical, patterns] of Object.entries(COLUMN_AUTO_DETECT_PATTERNS)) {
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      if (pattern.test(nameLower)) {
        const isFirstPattern = i === 0;
        return {
          logicalColumn: logical,
          confidence: isFirstPattern ? 0.95 : 0.80,
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

export function resolveWithAliases(
  logicalColumn: string, 
  availableMappings: Record<string, string>
): string | null {
  if (availableMappings[logicalColumn]) {
    return availableMappings[logicalColumn];
  }
  
  const aliases = getAliasesForColumn(logicalColumn);
  for (const alias of aliases) {
    if (availableMappings[alias]) {
      console.log(`[SEMANTIC-ALIAS] Resolved ${logicalColumn} via alias ${alias} → ${availableMappings[alias]}`);
      return availableMappings[alias];
    }
  }
  
  return null;
}
