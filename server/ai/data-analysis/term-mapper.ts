/**
 * Term Mapper
 * Hard-locks certain user terms to specific canonical metrics
 * This ensures consistency and prevents AI from bypassing standard metrics
 */

export interface TermMapping {
  terms: string[];
  metricName: string;
  priority: number;
}

const TERM_MAPPINGS: TermMapping[] = [
  {
    terms: ["fatturato", "vendite", "revenue", "incasso", "incassi", "ricavo", "ricavi", "venduto"],
    metricName: "revenue_gross",
    priority: 1,
  },
  {
    terms: ["fatturato lordo", "vendite lorde", "gross revenue"],
    metricName: "revenue_gross",
    priority: 2,
  },
  {
    terms: ["fatturato netto", "vendite nette", "net revenue", "netto"],
    metricName: "revenue_net",
    priority: 2,
  },
  {
    terms: ["food cost", "foodcost", "costo cibo", "costo materie prime", "costo ingredienti"],
    metricName: "food_cost_percent",
    priority: 1,
  },
  {
    terms: ["costo totale", "costo complessivo", "costi totali"],
    metricName: "food_cost",
    priority: 1,
  },
  {
    terms: ["margine", "margine lordo", "guadagno", "profitto", "profit"],
    metricName: "gross_margin",
    priority: 1,
  },
  {
    terms: ["margine percentuale", "margine %", "margine percent"],
    metricName: "gross_margin_percent",
    priority: 2,
  },
  {
    terms: ["ordini", "numero ordini", "scontrini", "transazioni", "orders"],
    metricName: "order_count",
    priority: 1,
  },
  {
    terms: ["ticket medio", "scontrino medio", "valore medio ordine", "average order"],
    metricName: "ticket_medio",
    priority: 1,
  },
  {
    terms: ["quantità", "pezzi venduti", "unità vendute", "quantity"],
    metricName: "quantity_total",
    priority: 1,
  },
  {
    terms: ["prezzo medio", "prezzo medio unitario", "average price"],
    metricName: "avg_unit_price",
    priority: 1,
  },
  {
    terms: ["sconti", "sconto totale", "sconti totali", "discounts"],
    metricName: "discount_total",
    priority: 1,
  },
  {
    terms: ["incidenza sconti", "impatto sconti", "sconti percentuale", "percentuale sconti", "discount percent", "discount rate"],
    metricName: "discount_percent_on_revenue",
    priority: 2,
  },
  {
    terms: ["costo personale", "personale", "labor cost", "labour cost", "costo lavoro", "costo del personale"],
    metricName: "cost_staff_percent",
    priority: 1,
  },
  {
    terms: ["costo personale totale", "costo personale euro", "labor cost total"],
    metricName: "cost_staff_total",
    priority: 2,
  },
  {
    terms: ["prime cost", "primecost", "costo primo"],
    metricName: "prime_cost_percent",
    priority: 1,
  },
  {
    terms: ["prime cost euro", "prime cost totale", "prime cost €"],
    metricName: "prime_cost",
    priority: 2,
  },
  {
    terms: ["costo produzione", "costi produzione", "costo produzione totale", "costi totali produzione"],
    metricName: "total_production_cost",
    priority: 1,
  },
  {
    terms: ["incidenza costi produzione", "costi produzione percentuale"],
    metricName: "total_production_cost_percent",
    priority: 2,
  },
  {
    terms: ["costo food beverage", "costo f&b", "costo fb", "costo food and beverage"],
    metricName: "cost_foodbev_total",
    priority: 1,
  },
  {
    terms: ["incidenza f&b", "incidenza food beverage", "f&b percentuale"],
    metricName: "cost_foodbev_percent",
    priority: 2,
  },
  {
    terms: ["costo materiali", "costo materiali totale"],
    metricName: "cost_materials_total",
    priority: 1,
  },
  {
    terms: ["costo extra", "costi extra", "costi vari"],
    metricName: "cost_extra_total",
    priority: 1,
  },
  {
    terms: ["costo struttura", "costi struttura", "costo affitto"],
    metricName: "cost_structure_total",
    priority: 1,
  },
  {
    terms: ["costo consumi", "costo utenze", "costi consumi", "costi utenze"],
    metricName: "cost_utilities_total",
    priority: 1,
  },
];

export function forceMetricFromTerms(question: string): string | null {
  const questionLower = question.toLowerCase().trim();
  
  const sortedMappings = [...TERM_MAPPINGS].sort((a, b) => b.priority - a.priority);
  
  for (const mapping of sortedMappings) {
    for (const term of mapping.terms) {
      if (questionLower.includes(term.toLowerCase())) {
        console.log(`[TERM-MAPPER] Matched "${term}" → ${mapping.metricName} (priority: ${mapping.priority})`);
        return mapping.metricName;
      }
    }
  }
  
  return null;
}

export function getTermsForMetric(metricName: string): string[] {
  const mapping = TERM_MAPPINGS.find((m) => m.metricName === metricName);
  return mapping?.terms || [];
}

export function getAllMappedTerms(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const mapping of TERM_MAPPINGS) {
    if (!result[mapping.metricName]) {
      result[mapping.metricName] = [];
    }
    result[mapping.metricName].push(...mapping.terms);
  }
  
  return result;
}

export function isMetricTermInQuestion(question: string, metricName: string): boolean {
  const terms = getTermsForMetric(metricName);
  const questionLower = question.toLowerCase();
  
  return terms.some((term) => questionLower.includes(term.toLowerCase()));
}
