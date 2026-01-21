/**
 * Full Audit System
 * Comprehensive 8-step analysis pipeline for presentation-ready reports
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { getSemanticMappings } from "../../services/client-data/semantic-mapping-service";
import { getAvailableMetrics, exploreDimensions, getDateRange } from "./smart-questions";
import { METRIC_TEMPLATES } from "./metric-templates";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { getAIProvider } from "../ai-provider";
import { safeTableName, safeColumnName } from "./sql-utils";

export interface AuditStep {
  stepNumber: number;
  title: string;
  status: "pending" | "running" | "completed" | "skipped" | "error";
  data?: any;
  summary?: string;
  charts?: any[];
  insights?: string[];
  error?: string;
  duration?: number;
}

export interface FullAuditResult {
  datasetId: number;
  datasetName: string;
  generatedAt: string;
  totalDuration: number;
  steps: AuditStep[];
  executiveSummary: string;
  recommendations: string[];
  success: boolean;
}

interface AuditContext {
  datasetId: number;
  datasetName: string;
  tableName: string;
  rowCount: number;
  confirmedMappings: Map<string, string>;
  availableMetrics: string[];
  dimensions: Record<string, string[]>;
  dateRange: { min: string | null; max: string | null } | null;
}

async function buildAuditContext(datasetId: number): Promise<AuditContext> {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  if (!dataset || !dataset.tableName) {
    throw new Error(`Dataset ${datasetId} not found or has no table`);
  }

  const mappingResult = await getSemanticMappings(datasetId);
  const confirmedMappings = new Map<string, string>();

  for (const mapping of mappingResult.mappings) {
    if (mapping.status === "confirmed") {
      confirmedMappings.set(mapping.logicalRole, mapping.physicalColumn);
    }
  }

  const { available } = getAvailableMetrics(confirmedMappings);
  const dimensions = await exploreDimensions(dataset.tableName, confirmedMappings);
  const dateRange = await getDateRange(dataset.tableName, confirmedMappings);

  return {
    datasetId,
    datasetName: dataset.name,
    tableName: dataset.tableName,
    rowCount: dataset.rowCount || 0,
    confirmedMappings,
    availableMetrics: available,
    dimensions,
    dateRange,
  };
}

async function runStep1Overview(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  try {
    const columnCount = ctx.confirmedMappings.size;
    const categoriesCount = ctx.dimensions.category?.length || 0;
    const productsCount = ctx.dimensions.product_name?.length || 0;
    const paymentMethodsCount = ctx.dimensions.payment_method?.length || 0;

    const data = {
      totalRows: ctx.rowCount,
      mappedColumns: columnCount,
      availableMetrics: ctx.availableMetrics,
      categories: categoriesCount,
      products: productsCount,
      paymentMethods: paymentMethodsCount,
      dateRange: ctx.dateRange,
    };

    return {
      stepNumber: 1,
      title: "Overview Dataset",
      status: "completed",
      data,
      summary: `Dataset con ${ctx.rowCount.toLocaleString("it-IT")} righe, ${ctx.availableMetrics.length} metriche disponibili, ${categoriesCount} categorie e ${productsCount} prodotti.`,
      insights: [
        `Periodo analizzato: ${ctx.dateRange?.min || "N/A"} - ${ctx.dateRange?.max || "N/A"}`,
        `Metriche calcolabili: ${ctx.availableMetrics.join(", ")}`,
      ],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 1,
      title: "Overview Dataset",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep2Revenue(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  if (!ctx.availableMetrics.includes("revenue")) {
    return {
      stepNumber: 2,
      title: "Analisi Fatturato",
      status: "skipped",
      summary: "Colonna fatturato non mappata. Conferma la colonna 'revenue_amount' per attivare questa analisi.",
      duration: Date.now() - startTime,
    };
  }

  try {
    const revenueCol = ctx.confirmedMappings.get("revenue_amount");
    const categoryCol = ctx.confirmedMappings.get("category");
    const dateCol = ctx.confirmedMappings.get("order_date");

    const totalQuery = sql.raw(`SELECT SUM(${safeColumnName(revenueCol!)}) as total FROM ${safeTableName(ctx.tableName)}`);
    const totalResult = await db.execute(totalQuery);
    const totalRevenue = parseFloat((totalResult.rows as any[])[0]?.total || "0");

    let byCategory: any[] = [];
    if (categoryCol) {
      const catQuery = sql.raw(`
        SELECT ${safeColumnName(categoryCol)} as category, SUM(${safeColumnName(revenueCol!)}) as revenue
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(categoryCol)} IS NOT NULL
        GROUP BY ${safeColumnName(categoryCol)}
        ORDER BY revenue DESC
        LIMIT 10
      `);
      const catResult = await db.execute(catQuery);
      byCategory = (catResult.rows as any[]).map((r) => ({
        category: r.category,
        revenue: parseFloat(r.revenue),
        percentage: (parseFloat(r.revenue) / totalRevenue) * 100,
      }));
    }

    let trend: any[] = [];
    if (dateCol) {
      const trendQuery = sql.raw(`
        SELECT 
          DATE_TRUNC('month', ${safeColumnName(dateCol)}::timestamp) as month,
          SUM(${safeColumnName(revenueCol!)}) as revenue
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(dateCol)} IS NOT NULL
        GROUP BY DATE_TRUNC('month', ${safeColumnName(dateCol)}::timestamp)
        ORDER BY month
      `);
      const trendResult = await db.execute(trendQuery);
      trend = (trendResult.rows as any[]).map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
      }));
    }

    const data = { totalRevenue, byCategory, trend };
    const topCategory = byCategory[0]?.category || "N/A";
    const topCategoryPct = byCategory[0]?.percentage?.toFixed(1) || "0";

    return {
      stepNumber: 2,
      title: "Analisi Fatturato",
      status: "completed",
      data,
      summary: `Fatturato totale: ${totalRevenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`,
      insights: [
        `La categoria principale e' "${topCategory}" con il ${topCategoryPct}% del fatturato`,
        trend.length > 1 ? `Trend analizzato su ${trend.length} mesi` : "Dati temporali insufficienti per trend",
      ],
      charts: [
        { type: "pie", title: "Fatturato per Categoria", data: byCategory },
        { type: "line", title: "Trend Fatturato Mensile", data: trend },
      ],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 2,
      title: "Analisi Fatturato",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep3Products(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  const productCol = ctx.confirmedMappings.get("product_name");
  const quantityCol = ctx.confirmedMappings.get("quantity");
  const revenueCol = ctx.confirmedMappings.get("revenue_amount");

  if (!productCol || (!quantityCol && !revenueCol)) {
    return {
      stepNumber: 3,
      title: "Performance Prodotti",
      status: "skipped",
      summary: "Colonne prodotto/quantita' non mappate.",
      duration: Date.now() - startTime,
    };
  }

  try {
    let topProducts: any[] = [];
    const valueCol = revenueCol || quantityCol;
    const valueName = revenueCol ? "revenue" : "quantity";

    const topQuery = sql.raw(`
      SELECT ${safeColumnName(productCol)} as product, SUM(${safeColumnName(valueCol!)}) as value
      FROM ${safeTableName(ctx.tableName)}
      WHERE ${safeColumnName(productCol)} IS NOT NULL
      GROUP BY ${safeColumnName(productCol)}
      ORDER BY value DESC
      LIMIT 10
    `);
    const topResult = await db.execute(topQuery);
    topProducts = (topResult.rows as any[]).map((r, idx) => ({
      rank: idx + 1,
      product: r.product,
      value: parseFloat(r.value),
    }));

    let bottomProducts: any[] = [];
    const bottomQuery = sql.raw(`
      SELECT ${safeColumnName(productCol)} as product, SUM(${safeColumnName(valueCol!)}) as value
      FROM ${safeTableName(ctx.tableName)}
      WHERE ${safeColumnName(productCol)} IS NOT NULL
      GROUP BY ${safeColumnName(productCol)}
      HAVING SUM(${safeColumnName(valueCol!)}) > 0
      ORDER BY value ASC
      LIMIT 5
    `);
    const bottomResult = await db.execute(bottomQuery);
    bottomProducts = (bottomResult.rows as any[]).map((r) => ({
      product: r.product,
      value: parseFloat(r.value),
    }));

    return {
      stepNumber: 3,
      title: "Performance Prodotti",
      status: "completed",
      data: { topProducts, bottomProducts },
      summary: `Top prodotto: "${topProducts[0]?.product || "N/A"}" con ${topProducts[0]?.value?.toLocaleString("it-IT") || 0} ${valueName === "revenue" ? "EUR" : "unita'"}`,
      insights: [
        `Analizzati ${ctx.dimensions.product_name?.length || 0} prodotti unici`,
        bottomProducts.length > 0 ? `Prodotti a bassa performance: ${bottomProducts.map((p) => p.product).slice(0, 3).join(", ")}` : "",
      ].filter(Boolean),
      charts: [{ type: "bar", title: "Top 10 Prodotti", data: topProducts }],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 3,
      title: "Performance Prodotti",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep4Costs(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  const hasFoodCost = ctx.availableMetrics.includes("food_cost") || ctx.availableMetrics.includes("food_cost_percent");

  if (!hasFoodCost) {
    return {
      stepNumber: 4,
      title: "Analisi Costi",
      status: "skipped",
      summary: "Colonne costo non mappate. Conferma 'cost' e 'quantity' per attivare.",
      duration: Date.now() - startTime,
    };
  }

  try {
    const costCol = ctx.confirmedMappings.get("cost");
    const quantityCol = ctx.confirmedMappings.get("quantity");
    const revenueCol = ctx.confirmedMappings.get("revenue_amount");
    const categoryCol = ctx.confirmedMappings.get("category");

    let totalCost = 0;
    let totalRevenue = 0;

    if (costCol && quantityCol) {
      const costQuery = sql.raw(`
        SELECT SUM(${safeColumnName(costCol)} * ${safeColumnName(quantityCol)}) as total_cost
        FROM ${safeTableName(ctx.tableName)}
      `);
      const costResult = await db.execute(costQuery);
      totalCost = parseFloat((costResult.rows as any[])[0]?.total_cost || "0");
    }

    if (revenueCol) {
      const revQuery = sql.raw(`SELECT SUM(${safeColumnName(revenueCol)}) as total FROM ${safeTableName(ctx.tableName)}`);
      const revResult = await db.execute(revQuery);
      totalRevenue = parseFloat((revResult.rows as any[])[0]?.total || "0");
    }

    const foodCostPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    let costByCategory: any[] = [];
    if (categoryCol && costCol && quantityCol && revenueCol) {
      const catCostQuery = sql.raw(`
        SELECT 
          ${safeColumnName(categoryCol)} as category,
          SUM(${safeColumnName(costCol)} * ${safeColumnName(quantityCol)}) as cost,
          SUM(${safeColumnName(revenueCol)}) as revenue
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(categoryCol)} IS NOT NULL
        GROUP BY ${safeColumnName(categoryCol)}
        ORDER BY cost DESC
        LIMIT 10
      `);
      const catResult = await db.execute(catCostQuery);
      costByCategory = (catResult.rows as any[]).map((r) => ({
        category: r.category,
        cost: parseFloat(r.cost),
        revenue: parseFloat(r.revenue),
        foodCostPercent: parseFloat(r.revenue) > 0 ? (parseFloat(r.cost) / parseFloat(r.revenue)) * 100 : 0,
      }));
    }

    const highCostCategories = costByCategory.filter((c) => c.foodCostPercent > 35);

    return {
      stepNumber: 4,
      title: "Analisi Costi",
      status: "completed",
      data: { totalCost, totalRevenue, foodCostPercent, costByCategory },
      summary: `Food Cost totale: ${foodCostPercent.toFixed(1)}% (${totalCost.toLocaleString("it-IT", { style: "currency", currency: "EUR" })})`,
      insights: [
        foodCostPercent < 30 ? "Food cost ottimale (<30%)" : foodCostPercent < 35 ? "Food cost nella norma (30-35%)" : "Food cost elevato (>35%) - da ottimizzare",
        highCostCategories.length > 0 ? `Categorie ad alto food cost: ${highCostCategories.map((c) => c.category).join(", ")}` : "Nessuna categoria critica",
      ],
      charts: [{ type: "bar", title: "Food Cost per Categoria", data: costByCategory }],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 4,
      title: "Analisi Costi",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep5Customers(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  const customerCol = ctx.confirmedMappings.get("customer_name") || ctx.confirmedMappings.get("customer_id");

  if (!customerCol) {
    return {
      stepNumber: 5,
      title: "Analisi Clienti",
      status: "skipped",
      summary: "Colonna cliente non mappata.",
      duration: Date.now() - startTime,
    };
  }

  try {
    const revenueCol = ctx.confirmedMappings.get("revenue_amount");

    let topCustomers: any[] = [];
    if (revenueCol) {
      const custQuery = sql.raw(`
        SELECT ${safeColumnName(customerCol)} as customer, SUM(${safeColumnName(revenueCol)}) as revenue, COUNT(*) as orders
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(customerCol)} IS NOT NULL
        GROUP BY ${safeColumnName(customerCol)}
        ORDER BY revenue DESC
        LIMIT 10
      `);
      const custResult = await db.execute(custQuery);
      topCustomers = (custResult.rows as any[]).map((r, idx) => ({
        rank: idx + 1,
        customer: r.customer,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders),
      }));
    }

    const uniqueCustomersQuery = sql.raw(`
      SELECT COUNT(DISTINCT ${safeColumnName(customerCol)}) as count
      FROM ${safeTableName(ctx.tableName)}
    `);
    const uniqueResult = await db.execute(uniqueCustomersQuery);
    const uniqueCustomers = parseInt((uniqueResult.rows as any[])[0]?.count || "0");

    return {
      stepNumber: 5,
      title: "Analisi Clienti",
      status: "completed",
      data: { topCustomers, uniqueCustomers },
      summary: `${uniqueCustomers.toLocaleString("it-IT")} clienti unici analizzati`,
      insights: [
        topCustomers.length > 0 ? `Top cliente: "${topCustomers[0].customer}" con ${topCustomers[0].revenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}` : "",
        topCustomers.length > 0 ? `Top 10 clienti rappresentano alta concentrazione di fatturato` : "",
      ].filter(Boolean),
      charts: [{ type: "bar", title: "Top 10 Clienti", data: topCustomers }],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 5,
      title: "Analisi Clienti",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep6TimePatterns(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  const dateCol = ctx.confirmedMappings.get("order_date");

  if (!dateCol || !ctx.dateRange?.min) {
    return {
      stepNumber: 6,
      title: "Pattern Temporali",
      status: "skipped",
      summary: "Colonna data non mappata.",
      duration: Date.now() - startTime,
    };
  }

  try {
    const revenueCol = ctx.confirmedMappings.get("revenue_amount");

    let byDayOfWeek: any[] = [];
    if (revenueCol) {
      const dowQuery = sql.raw(`
        SELECT 
          EXTRACT(DOW FROM ${safeColumnName(dateCol)}::timestamp) as dow,
          SUM(${safeColumnName(revenueCol)}) as revenue,
          COUNT(*) as orders
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(dateCol)} IS NOT NULL
        GROUP BY EXTRACT(DOW FROM ${safeColumnName(dateCol)}::timestamp)
        ORDER BY dow
      `);
      const dowResult = await db.execute(dowQuery);
      const dayNames = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
      byDayOfWeek = (dowResult.rows as any[]).map((r) => ({
        day: dayNames[parseInt(r.dow)] || r.dow,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders),
      }));
    }

    const bestDay = byDayOfWeek.reduce((max, d) => (d.revenue > (max?.revenue || 0) ? d : max), null);
    const worstDay = byDayOfWeek.reduce((min, d) => (d.revenue < (min?.revenue || Infinity) ? d : min), null);

    return {
      stepNumber: 6,
      title: "Pattern Temporali",
      status: "completed",
      data: { byDayOfWeek, dateRange: ctx.dateRange },
      summary: `Giorno migliore: ${bestDay?.day || "N/A"}, peggiore: ${worstDay?.day || "N/A"}`,
      insights: [
        bestDay ? `${bestDay.day} genera ${bestDay.revenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })} di fatturato` : "",
        `Periodo analizzato: ${ctx.dateRange.min} - ${ctx.dateRange.max}`,
      ].filter(Boolean),
      charts: [{ type: "bar", title: "Fatturato per Giorno della Settimana", data: byDayOfWeek }],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 6,
      title: "Pattern Temporali",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep7Payments(ctx: AuditContext): Promise<AuditStep> {
  const startTime = Date.now();

  const paymentCol = ctx.confirmedMappings.get("payment_method");

  if (!paymentCol) {
    return {
      stepNumber: 7,
      title: "Analisi Pagamenti",
      status: "skipped",
      summary: "Colonna metodo pagamento non mappata.",
      duration: Date.now() - startTime,
    };
  }

  try {
    const revenueCol = ctx.confirmedMappings.get("revenue_amount");

    let byPaymentMethod: any[] = [];
    if (revenueCol) {
      const payQuery = sql.raw(`
        SELECT ${safeColumnName(paymentCol)} as method, SUM(${safeColumnName(revenueCol)}) as revenue, COUNT(*) as orders
        FROM ${safeTableName(ctx.tableName)}
        WHERE ${safeColumnName(paymentCol)} IS NOT NULL
        GROUP BY ${safeColumnName(paymentCol)}
        ORDER BY revenue DESC
      `);
      const payResult = await db.execute(payQuery);
      const total = (payResult.rows as any[]).reduce((sum, r) => sum + parseFloat(r.revenue), 0);
      byPaymentMethod = (payResult.rows as any[]).map((r) => ({
        method: r.method,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders),
        percentage: (parseFloat(r.revenue) / total) * 100,
      }));
    }

    const topMethod = byPaymentMethod[0];

    return {
      stepNumber: 7,
      title: "Analisi Pagamenti",
      status: "completed",
      data: { byPaymentMethod },
      summary: `Metodo principale: ${topMethod?.method || "N/A"} (${topMethod?.percentage?.toFixed(1) || 0}%)`,
      insights: byPaymentMethod.map((m) => `${m.method}: ${m.percentage.toFixed(1)}% del fatturato (${m.orders} ordini)`),
      charts: [{ type: "pie", title: "Distribuzione Metodi di Pagamento", data: byPaymentMethod }],
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 7,
      title: "Analisi Pagamenti",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runStep8Recommendations(ctx: AuditContext, previousSteps: AuditStep[]): Promise<AuditStep> {
  const startTime = Date.now();

  try {
    const recommendations: string[] = [];

    const revenueStep = previousSteps.find((s) => s.stepNumber === 2);
    const costStep = previousSteps.find((s) => s.stepNumber === 4);
    const productStep = previousSteps.find((s) => s.stepNumber === 3);
    const timeStep = previousSteps.find((s) => s.stepNumber === 6);

    if (costStep?.data?.foodCostPercent > 35) {
      recommendations.push("Rivedere i prezzi di acquisto o vendita per ridurre il food cost sotto il 35%");
      if (costStep.data.costByCategory?.length > 0) {
        const highCost = costStep.data.costByCategory.filter((c: any) => c.foodCostPercent > 40);
        if (highCost.length > 0) {
          recommendations.push(`Focalizzarsi sulle categorie ${highCost.map((c: any) => c.category).join(", ")} per ottimizzazione costi`);
        }
      }
    }

    if (productStep?.data?.bottomProducts?.length > 0) {
      recommendations.push("Valutare rimozione prodotti a bassa rotazione dal menu");
    }

    if (timeStep?.data?.byDayOfWeek) {
      const days = timeStep.data.byDayOfWeek;
      const avg = days.reduce((sum: number, d: any) => sum + d.revenue, 0) / days.length;
      const lowDays = days.filter((d: any) => d.revenue < avg * 0.7);
      if (lowDays.length > 0) {
        recommendations.push(`Considerare promozioni per ${lowDays.map((d: any) => d.day).join(", ")} (giorni deboli)`);
      }
    }

    if (revenueStep?.data?.byCategory?.length > 3) {
      const topCat = revenueStep.data.byCategory[0];
      if (topCat.percentage > 50) {
        recommendations.push(`Alta dipendenza dalla categoria "${topCat.category}" - diversificare l'offerta`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Performance generale equilibrata - monitorare KPI regolarmente");
    }

    return {
      stepNumber: 8,
      title: "Raccomandazioni",
      status: "completed",
      data: { recommendations },
      summary: `${recommendations.length} raccomandazioni generate`,
      insights: recommendations,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stepNumber: 8,
      title: "Raccomandazioni",
      status: "error",
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

export async function runFullAudit(
  datasetId: number,
  consultantId: string,
  onStepComplete?: (step: AuditStep) => void
): Promise<FullAuditResult> {
  const startTime = Date.now();
  console.log(`[FULL-AUDIT] Starting audit for dataset ${datasetId}`);

  const ctx = await buildAuditContext(datasetId);
  const steps: AuditStep[] = [];

  const stepFunctions = [
    () => runStep1Overview(ctx),
    () => runStep2Revenue(ctx),
    () => runStep3Products(ctx),
    () => runStep4Costs(ctx),
    () => runStep5Customers(ctx),
    () => runStep6TimePatterns(ctx),
    () => runStep7Payments(ctx),
    (prevSteps: AuditStep[]) => runStep8Recommendations(ctx, prevSteps),
  ];

  for (let i = 0; i < stepFunctions.length; i++) {
    const stepFn = stepFunctions[i];
    const step = i === 7 ? await stepFn(steps) : await (stepFn as () => Promise<AuditStep>)();
    steps.push(step);

    if (onStepComplete) {
      onStepComplete(step);
    }

    console.log(`[FULL-AUDIT] Step ${step.stepNumber} "${step.title}" completed: ${step.status} in ${step.duration}ms`);
  }

  const completedSteps = steps.filter((s) => s.status === "completed");
  const totalDuration = Date.now() - startTime;

  const revenueStep = steps.find((s) => s.stepNumber === 2);
  const costStep = steps.find((s) => s.stepNumber === 4);

  let executiveSummary = `Audit completato in ${(totalDuration / 1000).toFixed(1)} secondi. `;
  executiveSummary += `Analizzate ${ctx.rowCount.toLocaleString("it-IT")} righe. `;

  if (revenueStep?.data?.totalRevenue) {
    executiveSummary += `Fatturato: ${revenueStep.data.totalRevenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}. `;
  }

  if (costStep?.data?.foodCostPercent) {
    executiveSummary += `Food Cost: ${costStep.data.foodCostPercent.toFixed(1)}%. `;
  }

  const recStep = steps.find((s) => s.stepNumber === 8);
  const recommendations = recStep?.data?.recommendations || [];

  console.log(`[FULL-AUDIT] Completed in ${totalDuration}ms with ${completedSteps.length}/${steps.length} steps`);

  return {
    datasetId,
    datasetName: ctx.datasetName,
    generatedAt: new Date().toISOString(),
    totalDuration,
    steps,
    executiveSummary,
    recommendations,
    success: true,
  };
}
