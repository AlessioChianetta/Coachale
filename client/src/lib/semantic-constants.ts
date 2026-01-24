/**
 * Semantic Layer Constants
 * Costanti condivise per il mapping automatico delle colonne
 * 
 * Fonte di verità per:
 * - ROLE_DESCRIPTIONS: 20 colonne logiche core per ristoranti
 * - SYSTEM_RULES: 62 pattern di riconoscimento automatico
 */

export interface RoleDescription {
  description: string;
  type: "TEXT" | "NUMERIC" | "DATE" | "INTEGER";
  example?: string;
}

export interface SystemRule {
  pattern: string;
  matchType: "contains" | "exact" | "startswith" | "endswith";
  matchTypeLabel: string;
  role: string;
  description: string;
}

/**
 * 20 Colonne Logiche Core per Ristoranti
 * Allineate con server/ai/data-analysis/logical-columns.ts
 */
export const ROLE_DESCRIPTIONS: Record<string, RoleDescription> = {
  document_id: { description: "ID documento/scontrino/ordine", type: "TEXT", example: "ORD-2024-001" },
  order_date: { description: "Data e ora della transazione", type: "DATE", example: "2024-01-15 12:30:00" },
  product_id: { description: "Codice univoco prodotto/SKU", type: "TEXT", example: "PROD-001" },
  product_name: { description: "Nome del prodotto o articolo", type: "TEXT", example: "Pizza Margherita" },
  category: { description: "Categoria merceologica", type: "TEXT", example: "Pizze" },
  quantity: { description: "Quantità venduta", type: "NUMERIC", example: "2" },
  price: { description: "Prezzo unitario di vendita (pre-sconto)", type: "NUMERIC", example: "8.50" },
  cost: { description: "Costo unitario di acquisto/produzione", type: "NUMERIC", example: "2.80" },
  revenue_amount: { description: "Totale riga già scontato (pronto per SUM)", type: "NUMERIC", example: "15.30" },
  discount_amount: { description: "Importo sconto applicato in euro", type: "NUMERIC", example: "1.70" },
  discount_percent: { description: "Percentuale di sconto applicata", type: "NUMERIC", example: "10" },
  customer_id: { description: "Identificatore univoco cliente", type: "TEXT", example: "CLI-001" },
  customer_name: { description: "Nome o ragione sociale cliente", type: "TEXT", example: "Mario Rossi" },
  payment_method: { description: "Metodo di pagamento utilizzato", type: "TEXT", example: "carta" },
  tax_rate: { description: "Aliquota IVA in percentuale", type: "NUMERIC", example: "22" },
  document_type: { description: "Tipo transazione: sale | refund | void | staff_meal", type: "TEXT", example: "sale" },
  time_slot: { description: "Fascia oraria: breakfast | lunch | dinner | late", type: "TEXT", example: "lunch" },
  sales_channel: { description: "Canale vendita: dine_in | takeaway | delivery", type: "TEXT", example: "dine_in" },
  is_sellable: { description: "1 = prodotto vendibile, 0 = modificatore/nota", type: "INTEGER", example: "1" },
  line_id: { description: "ID univoco della riga dettaglio", type: "TEXT", example: "LINE-001" },
};

/**
 * Lista dei ruoli logici (chiavi di ROLE_DESCRIPTIONS)
 */
export const LOGICAL_ROLES = Object.keys(ROLE_DESCRIPTIONS);

/**
 * Opzioni per Select UI (derivate da ROLE_DESCRIPTIONS)
 */
export const LOGICAL_ROLE_OPTIONS = Object.entries(ROLE_DESCRIPTIONS).map(([value, info]) => ({
  value,
  label: info.description.split(" ")[0] + " " + (info.description.split(" ")[1] || ""),
  fullDescription: info.description,
  type: info.type,
}));

/**
 * Opzioni per tipo di match
 */
export const MATCH_TYPE_OPTIONS = [
  { value: "contains" as const, label: "Contiene" },
  { value: "exact" as const, label: "Esatto" },
  { value: "startswith" as const, label: "Inizia con" },
  { value: "endswith" as const, label: "Finisce con" },
];

/**
 * 62 Pattern di Riconoscimento Automatico
 * Usati per mappare automaticamente i nomi colonna dei partner
 */
export const SYSTEM_RULES: SystemRule[] = [
  // document_id
  { pattern: "idddt", matchType: "startswith", matchTypeLabel: "Inizia con", role: "document_id", description: "DDT italiani" },
  { pattern: "id_ordine", matchType: "contains", matchTypeLabel: "Contiene", role: "document_id", description: "Ordini POS" },
  { pattern: "scontrino", matchType: "contains", matchTypeLabel: "Contiene", role: "document_id", description: "Scontrini fiscali" },
  { pattern: "numero_ordine", matchType: "contains", matchTypeLabel: "Contiene", role: "document_id", description: "Numero ordine" },
  { pattern: "order_id", matchType: "exact", matchTypeLabel: "Esatto", role: "document_id", description: "ID ordine inglese" },
  // order_date
  { pattern: "data", matchType: "startswith", matchTypeLabel: "Inizia con", role: "order_date", description: "Data transazione" },
  { pattern: "dataordine", matchType: "contains", matchTypeLabel: "Contiene", role: "order_date", description: "Data ordine" },
  { pattern: "order_date", matchType: "exact", matchTypeLabel: "Esatto", role: "order_date", description: "Data ordine inglese" },
  { pattern: "timestamp", matchType: "contains", matchTypeLabel: "Contiene", role: "order_date", description: "Timestamp" },
  // product_id
  { pattern: "id_prodotto", matchType: "contains", matchTypeLabel: "Contiene", role: "product_id", description: "ID prodotto" },
  { pattern: "sku", matchType: "exact", matchTypeLabel: "Esatto", role: "product_id", description: "Codice SKU" },
  { pattern: "codice_articolo", matchType: "contains", matchTypeLabel: "Contiene", role: "product_id", description: "Codice articolo" },
  // product_name
  { pattern: "descrizione", matchType: "exact", matchTypeLabel: "Esatto", role: "product_name", description: "Nome prodotto" },
  { pattern: "articolo", matchType: "contains", matchTypeLabel: "Contiene", role: "product_name", description: "Nome articolo" },
  { pattern: "prodotto", matchType: "contains", matchTypeLabel: "Contiene", role: "product_name", description: "Nome prodotto" },
  // category
  { pattern: "reparto", matchType: "exact", matchTypeLabel: "Esatto", role: "category", description: "Categoria/reparto" },
  { pattern: "categoria", matchType: "contains", matchTypeLabel: "Contiene", role: "category", description: "Categoria prodotto" },
  { pattern: "gruppo", matchType: "contains", matchTypeLabel: "Contiene", role: "category", description: "Gruppo prodotto" },
  // quantity
  { pattern: "quantita", matchType: "contains", matchTypeLabel: "Contiene", role: "quantity", description: "Quantità venduta" },
  { pattern: "qta", matchType: "exact", matchTypeLabel: "Esatto", role: "quantity", description: "Abbreviazione comune" },
  { pattern: "qty", matchType: "exact", matchTypeLabel: "Esatto", role: "quantity", description: "Abbreviazione inglese" },
  // price
  { pattern: "prezzo_unitario", matchType: "contains", matchTypeLabel: "Contiene", role: "price", description: "Prezzo di listino" },
  { pattern: "listino", matchType: "contains", matchTypeLabel: "Contiene", role: "price", description: "Prezzo di listino" },
  { pattern: "unit_price", matchType: "contains", matchTypeLabel: "Contiene", role: "price", description: "Prezzo unitario inglese" },
  // cost
  { pattern: "costo", matchType: "startswith", matchTypeLabel: "Inizia con", role: "cost", description: "Costo unitario" },
  { pattern: "food_cost", matchType: "contains", matchTypeLabel: "Contiene", role: "cost", description: "Food cost" },
  { pattern: "prezzo_acquisto", matchType: "contains", matchTypeLabel: "Contiene", role: "cost", description: "Prezzo di acquisto" },
  // revenue_amount
  { pattern: "prezzo_finale", matchType: "startswith", matchTypeLabel: "Inizia con", role: "revenue_amount", description: "Pattern comune gestionali POS" },
  { pattern: "prezzofinale", matchType: "startswith", matchTypeLabel: "Inizia con", role: "revenue_amount", description: "Pattern senza underscore" },
  { pattern: "importo_riga", matchType: "contains", matchTypeLabel: "Contiene", role: "revenue_amount", description: "Totale riga fattura" },
  { pattern: "totale_riga", matchType: "contains", matchTypeLabel: "Contiene", role: "revenue_amount", description: "Totale riga documento" },
  { pattern: "importo2", matchType: "exact", matchTypeLabel: "Esatto", role: "revenue_amount", description: "Export comuni ristoranti" },
  // discount_amount / discount_percent
  { pattern: "sconto", matchType: "startswith", matchTypeLabel: "Inizia con", role: "discount_amount", description: "Sconto applicato" },
  { pattern: "discount", matchType: "contains", matchTypeLabel: "Contiene", role: "discount_amount", description: "Sconto inglese" },
  { pattern: "sconto_perc", matchType: "contains", matchTypeLabel: "Contiene", role: "discount_percent", description: "Percentuale sconto" },
  // customer
  { pattern: "cliente", matchType: "contains", matchTypeLabel: "Contiene", role: "customer_name", description: "Nome cliente" },
  { pattern: "id_cliente", matchType: "contains", matchTypeLabel: "Contiene", role: "customer_id", description: "ID cliente" },
  { pattern: "customer", matchType: "contains", matchTypeLabel: "Contiene", role: "customer_name", description: "Customer inglese" },
  // payment_method
  { pattern: "pagamento", matchType: "contains", matchTypeLabel: "Contiene", role: "payment_method", description: "Metodo pagamento" },
  { pattern: "payment", matchType: "contains", matchTypeLabel: "Contiene", role: "payment_method", description: "Payment method" },
  // tax_rate
  { pattern: "iva", matchType: "contains", matchTypeLabel: "Contiene", role: "tax_rate", description: "Aliquota IVA" },
  { pattern: "aliquota", matchType: "contains", matchTypeLabel: "Contiene", role: "tax_rate", description: "Aliquota fiscale" },
  // document_type
  { pattern: "tipo_doc", matchType: "contains", matchTypeLabel: "Contiene", role: "document_type", description: "Tipo documento" },
  { pattern: "tipodoc", matchType: "contains", matchTypeLabel: "Contiene", role: "document_type", description: "Tipo documento" },
  { pattern: "transaction_type", matchType: "contains", matchTypeLabel: "Contiene", role: "document_type", description: "Tipo transazione" },
  { pattern: "tipo_transazione", matchType: "contains", matchTypeLabel: "Contiene", role: "document_type", description: "Tipo transazione IT" },
  // time_slot
  { pattern: "fascia_oraria", matchType: "contains", matchTypeLabel: "Contiene", role: "time_slot", description: "Fascia oraria" },
  { pattern: "turno", matchType: "exact", matchTypeLabel: "Esatto", role: "time_slot", description: "Turno di servizio" },
  { pattern: "shift", matchType: "exact", matchTypeLabel: "Esatto", role: "time_slot", description: "Shift inglese" },
  // sales_channel
  { pattern: "canale", matchType: "contains", matchTypeLabel: "Contiene", role: "sales_channel", description: "Canale vendita" },
  { pattern: "channel", matchType: "contains", matchTypeLabel: "Contiene", role: "sales_channel", description: "Channel inglese" },
  { pattern: "modalita_servizio", matchType: "contains", matchTypeLabel: "Contiene", role: "sales_channel", description: "Modalità servizio" },
  // is_sellable
  { pattern: "vendibile", matchType: "contains", matchTypeLabel: "Contiene", role: "is_sellable", description: "Flag prodotto vendibile" },
  { pattern: "is_sellable", matchType: "exact", matchTypeLabel: "Esatto", role: "is_sellable", description: "Sellable flag" },
  { pattern: "is_product", matchType: "contains", matchTypeLabel: "Contiene", role: "is_sellable", description: "Is product flag" },
  // line_id
  { pattern: "id_riga", matchType: "contains", matchTypeLabel: "Contiene", role: "line_id", description: "ID riga dettaglio" },
  { pattern: "line_id", matchType: "exact", matchTypeLabel: "Esatto", role: "line_id", description: "Line ID inglese" },
  { pattern: "idriga", matchType: "contains", matchTypeLabel: "Contiene", role: "line_id", description: "ID riga compatto" },
];

/**
 * Helper: ottiene label per un matchType
 */
export function getMatchTypeLabel(matchType: string): string {
  const option = MATCH_TYPE_OPTIONS.find(m => m.value === matchType);
  return option?.label || matchType;
}

/**
 * Helper: ottiene info per un ruolo logico
 */
export function getRoleInfo(role: string): RoleDescription | undefined {
  return ROLE_DESCRIPTIONS[role];
}

/**
 * Helper: ottiene pattern per un ruolo
 */
export function getPatternsForRole(role: string): string[] {
  return SYSTEM_RULES.filter(r => r.role === role).map(r => r.pattern);
}
