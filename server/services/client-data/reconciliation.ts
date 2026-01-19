/**
 * Reconciliation Tests for Client Data Analysis
 * Automatic data quality and consistency checks
 */

import { pool, db } from "../../db";
import { clientDataDatasets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { queryMetric, type QueryResult } from "./query-executor";

export interface ReconciliationTest {
  name: string;
  description: string;
  status: "pass" | "fail" | "warning" | "error";
  expected?: any;
  actual?: any;
  discrepancy?: number;
  discrepancyPercent?: number;
  message: string;
}

export interface ReconciliationReport {
  datasetId: string;
  datasetName: string;
  runAt: Date;
  tests: ReconciliationTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    errors: number;
  };
  overallStatus: "healthy" | "warnings" | "issues" | "critical";
}

async function getDatasetInfo(datasetId: string) {
  const [dataset] = await db
    .select()
    .from(clientDataDatasets)
    .where(eq(clientDataDatasets.id, datasetId))
    .limit(1);

  return dataset;
}

async function executeRawQuery(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount || 0 };
  } finally {
    client.release();
  }
}

async function testRowCount(datasetId: string, tableName: string, expectedRowCount: number): Promise<ReconciliationTest> {
  try {
    const result = await executeRawQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const actualCount = parseInt(result.rows[0]?.count || "0", 10);

    const discrepancy = Math.abs(actualCount - expectedRowCount);
    const discrepancyPercent = expectedRowCount > 0 ? (discrepancy / expectedRowCount) * 100 : 0;

    if (actualCount === expectedRowCount) {
      return {
        name: "row_count",
        description: "Verifica che il conteggio righe corrisponda al metadata",
        status: "pass",
        expected: expectedRowCount,
        actual: actualCount,
        discrepancy: 0,
        discrepancyPercent: 0,
        message: `Conteggio righe corretto: ${actualCount}`
      };
    } else if (discrepancyPercent <= 1) {
      return {
        name: "row_count",
        description: "Verifica che il conteggio righe corrisponda al metadata",
        status: "warning",
        expected: expectedRowCount,
        actual: actualCount,
        discrepancy,
        discrepancyPercent,
        message: `Discrepanza minima nel conteggio: atteso ${expectedRowCount}, trovato ${actualCount} (${discrepancyPercent.toFixed(2)}%)`
      };
    } else {
      return {
        name: "row_count",
        description: "Verifica che il conteggio righe corrisponda al metadata",
        status: "fail",
        expected: expectedRowCount,
        actual: actualCount,
        discrepancy,
        discrepancyPercent,
        message: `Discrepanza significativa nel conteggio: atteso ${expectedRowCount}, trovato ${actualCount} (${discrepancyPercent.toFixed(2)}%)`
      };
    }
  } catch (error: any) {
    return {
      name: "row_count",
      description: "Verifica che il conteggio righe corrisponda al metadata",
      status: "error",
      message: `Errore nel test: ${error.message}`
    };
  }
}

async function testNullsInNumericColumns(tableName: string, columns: string[]): Promise<ReconciliationTest[]> {
  const tests: ReconciliationTest[] = [];

  for (const column of columns) {
    try {
      const result = await executeRawQuery(
        `SELECT 
          COUNT(*) as total,
          COUNT("${column}") as non_null,
          COUNT(*) - COUNT("${column}") as null_count
        FROM "${tableName}"`
      );

      const { total, null_count } = result.rows[0];
      const nullPercent = total > 0 ? (null_count / total) * 100 : 0;

      if (null_count === 0) {
        tests.push({
          name: `null_check_${column}`,
          description: `Verifica valori NULL nella colonna ${column}`,
          status: "pass",
          expected: 0,
          actual: 0,
          message: `Colonna "${column}": nessun valore NULL`
        });
      } else if (nullPercent <= 5) {
        tests.push({
          name: `null_check_${column}`,
          description: `Verifica valori NULL nella colonna ${column}`,
          status: "warning",
          expected: 0,
          actual: null_count,
          discrepancyPercent: nullPercent,
          message: `Colonna "${column}": ${null_count} valori NULL (${nullPercent.toFixed(1)}%)`
        });
      } else {
        tests.push({
          name: `null_check_${column}`,
          description: `Verifica valori NULL nella colonna ${column}`,
          status: "fail",
          expected: 0,
          actual: null_count,
          discrepancyPercent: nullPercent,
          message: `Colonna "${column}": troppi NULL - ${null_count} su ${total} (${nullPercent.toFixed(1)}%)`
        });
      }
    } catch (error: any) {
      tests.push({
        name: `null_check_${column}`,
        description: `Verifica valori NULL nella colonna ${column}`,
        status: "error",
        message: `Errore: ${error.message}`
      });
    }
  }

  return tests;
}

async function testDateRange(tableName: string, dateColumns: string[]): Promise<ReconciliationTest[]> {
  const tests: ReconciliationTest[] = [];
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

  for (const column of dateColumns) {
    try {
      const result = await executeRawQuery(
        `SELECT 
          MIN("${column}")::text as min_date,
          MAX("${column}")::text as max_date
        FROM "${tableName}"
        WHERE "${column}" IS NOT NULL`
      );

      if (!result.rows[0]?.min_date) {
        tests.push({
          name: `date_range_${column}`,
          description: `Verifica range date nella colonna ${column}`,
          status: "warning",
          message: `Colonna "${column}": nessuna data valida trovata`
        });
        continue;
      }

      const { min_date, max_date } = result.rows[0];
      const minDate = new Date(min_date);
      const maxDate = new Date(max_date);

      const issues: string[] = [];

      if (minDate < oneYearAgo) {
        issues.push(`date troppo vecchie (min: ${min_date})`);
      }
      if (maxDate > tenYearsFromNow) {
        issues.push(`date future sospette (max: ${max_date})`);
      }

      if (issues.length === 0) {
        tests.push({
          name: `date_range_${column}`,
          description: `Verifica range date nella colonna ${column}`,
          status: "pass",
          message: `Colonna "${column}": range plausibile (${min_date} - ${max_date})`
        });
      } else {
        tests.push({
          name: `date_range_${column}`,
          description: `Verifica range date nella colonna ${column}`,
          status: "warning",
          message: `Colonna "${column}": ${issues.join(", ")}`
        });
      }
    } catch (error: any) {
      tests.push({
        name: `date_range_${column}`,
        description: `Verifica range date nella colonna ${column}`,
        status: "error",
        message: `Errore: ${error.message}`
      });
    }
  }

  return tests;
}

async function testDuplicates(tableName: string, keyColumns: string[]): Promise<ReconciliationTest> {
  if (keyColumns.length === 0) {
    return {
      name: "duplicates",
      description: "Verifica righe duplicate",
      status: "pass",
      message: "Nessuna colonna chiave definita per il test duplicati"
    };
  }

  try {
    const columnsStr = keyColumns.map(c => `"${c}"`).join(", ");
    const result = await executeRawQuery(
      `SELECT ${columnsStr}, COUNT(*) as dup_count
       FROM "${tableName}"
       GROUP BY ${columnsStr}
       HAVING COUNT(*) > 1
       LIMIT 10`
    );

    if (result.rowCount === 0) {
      return {
        name: "duplicates",
        description: `Verifica righe duplicate per colonne: ${keyColumns.join(", ")}`,
        status: "pass",
        message: "Nessuna riga duplicata trovata"
      };
    }

    const totalDups = result.rows.reduce((sum, r) => sum + parseInt(r.dup_count, 10), 0);

    return {
      name: "duplicates",
      description: `Verifica righe duplicate per colonne: ${keyColumns.join(", ")}`,
      status: "warning",
      actual: result.rowCount,
      message: `Trovate ${result.rowCount} combinazioni duplicate (${totalDups} righe totali)`
    };
  } catch (error: any) {
    return {
      name: "duplicates",
      description: "Verifica righe duplicate",
      status: "error",
      message: `Errore: ${error.message}`
    };
  }
}

async function testSumConsistency(datasetId: string, numericColumns: string[]): Promise<ReconciliationTest[]> {
  const tests: ReconciliationTest[] = [];

  for (const column of numericColumns.slice(0, 3)) {
    try {
      const result = await queryMetric(datasetId, `SUM(${column})`);

      if (result.success && result.data?.[0]?.result !== undefined) {
        const sumValue = result.data[0].result;

        if (sumValue === null || sumValue === 0) {
          tests.push({
            name: `sum_check_${column}`,
            description: `Verifica SUM della colonna ${column}`,
            status: "warning",
            actual: sumValue,
            message: `Colonna "${column}": SUM = ${sumValue} (potrebbe indicare tutti NULL o zeri)`
          });
        } else {
          tests.push({
            name: `sum_check_${column}`,
            description: `Verifica SUM della colonna ${column}`,
            status: "pass",
            actual: sumValue,
            message: `Colonna "${column}": SUM = ${sumValue.toLocaleString("it-IT")}`
          });
        }
      } else {
        tests.push({
          name: `sum_check_${column}`,
          description: `Verifica SUM della colonna ${column}`,
          status: "error",
          message: `Errore nel calcolo: ${result.error}`
        });
      }
    } catch (error: any) {
      tests.push({
        name: `sum_check_${column}`,
        description: `Verifica SUM della colonna ${column}`,
        status: "error",
        message: `Errore: ${error.message}`
      });
    }
  }

  return tests;
}

export async function runReconciliationTests(datasetId: string): Promise<ReconciliationReport> {
  const dataset = await getDatasetInfo(datasetId);

  if (!dataset) {
    return {
      datasetId,
      datasetName: "Unknown",
      runAt: new Date(),
      tests: [{
        name: "dataset_check",
        description: "Verifica esistenza dataset",
        status: "error",
        message: "Dataset non trovato"
      }],
      summary: { total: 1, passed: 0, failed: 0, warnings: 0, errors: 1 },
      overallStatus: "critical"
    };
  }

  if (dataset.status !== "ready") {
    return {
      datasetId,
      datasetName: dataset.name,
      runAt: new Date(),
      tests: [{
        name: "dataset_status",
        description: "Verifica stato dataset",
        status: "error",
        message: `Dataset non pronto. Stato attuale: ${dataset.status}`
      }],
      summary: { total: 1, passed: 0, failed: 0, warnings: 0, errors: 1 },
      overallStatus: "critical"
    };
  }

  const tests: ReconciliationTest[] = [];
  const columnMapping = dataset.columnMapping as Record<string, { displayName: string; dataType: string }>;

  const numericColumns = Object.entries(columnMapping)
    .filter(([_, info]) => ["number", "integer", "decimal", "float"].includes(info.dataType))
    .map(([name]) => name);

  const dateColumns = Object.entries(columnMapping)
    .filter(([_, info]) => ["date", "datetime", "timestamp"].includes(info.dataType))
    .map(([name]) => name);

  const potentialKeyColumns = Object.entries(columnMapping)
    .filter(([name, info]) =>
      name.toLowerCase().includes("id") ||
      name.toLowerCase().includes("cod") ||
      name.toLowerCase().includes("code")
    )
    .map(([name]) => name)
    .slice(0, 2);

  tests.push(await testRowCount(datasetId, dataset.tableName, dataset.rowCount || 0));

  tests.push(...await testNullsInNumericColumns(dataset.tableName, numericColumns));

  if (dateColumns.length > 0) {
    tests.push(...await testDateRange(dataset.tableName, dateColumns));
  }

  if (potentialKeyColumns.length > 0) {
    tests.push(await testDuplicates(dataset.tableName, potentialKeyColumns));
  }

  tests.push(...await testSumConsistency(datasetId, numericColumns));

  const summary = {
    total: tests.length,
    passed: tests.filter(t => t.status === "pass").length,
    failed: tests.filter(t => t.status === "fail").length,
    warnings: tests.filter(t => t.status === "warning").length,
    errors: tests.filter(t => t.status === "error").length
  };

  let overallStatus: ReconciliationReport["overallStatus"];
  if (summary.errors > 0 || summary.failed >= summary.total * 0.5) {
    overallStatus = "critical";
  } else if (summary.failed > 0) {
    overallStatus = "issues";
  } else if (summary.warnings > 0) {
    overallStatus = "warnings";
  } else {
    overallStatus = "healthy";
  }

  console.log(`[RECONCILIATION] Dataset ${datasetId}: ${summary.passed}/${summary.total} passed, status: ${overallStatus}`);

  return {
    datasetId,
    datasetName: dataset.name,
    runAt: new Date(),
    tests,
    summary,
    overallStatus
  };
}

export interface AggregationComparisonResult {
  dsl1: string;
  dsl2: string;
  value1: number | null;
  value2: number | null;
  expectedRelation: "equal" | "greater" | "less" | "sum";
  expectedValue?: number;
  status: "pass" | "fail" | "warning";
  discrepancyPercent?: number;
  message: string;
}

export async function compareAggregations(
  datasetId: string,
  dsl1: string,
  dsl2: string,
  expectedRelation: "equal" | "greater" | "less" | "sum",
  expectedValue?: number
): Promise<AggregationComparisonResult> {
  const [result1, result2] = await Promise.all([
    queryMetric(datasetId, dsl1),
    queryMetric(datasetId, dsl2)
  ]);

  if (!result1.success || !result2.success) {
    return {
      dsl1,
      dsl2,
      value1: null,
      value2: null,
      expectedRelation,
      expectedValue,
      status: "fail",
      message: `Errore: ${result1.error || result2.error}`
    };
  }

  const value1 = result1.data?.[0]?.result ?? null;
  const value2 = result2.data?.[0]?.result ?? null;

  if (value1 === null || value2 === null) {
    return {
      dsl1,
      dsl2,
      value1,
      value2,
      expectedRelation,
      expectedValue,
      status: "warning",
      message: "Uno o entrambi i valori sono NULL"
    };
  }

  let status: "pass" | "fail" | "warning" = "pass";
  let message = "";
  let discrepancyPercent: number | undefined;

  switch (expectedRelation) {
    case "equal":
      discrepancyPercent = value2 !== 0 ? Math.abs((value1 - value2) / value2) * 100 : (value1 !== 0 ? 100 : 0);
      if (discrepancyPercent <= 0.01) {
        status = "pass";
        message = `Valori uguali: ${value1}`;
      } else if (discrepancyPercent <= 1) {
        status = "warning";
        message = `Discrepanza minima: ${discrepancyPercent.toFixed(2)}%`;
      } else {
        status = "fail";
        message = `Discrepanza: ${value1} vs ${value2} (${discrepancyPercent.toFixed(2)}%)`;
      }
      break;

    case "greater":
      if (value1 > value2) {
        status = "pass";
        message = `${value1} > ${value2} ✓`;
      } else {
        status = "fail";
        message = `Atteso ${dsl1} > ${dsl2}, ma ${value1} <= ${value2}`;
      }
      break;

    case "less":
      if (value1 < value2) {
        status = "pass";
        message = `${value1} < ${value2} ✓`;
      } else {
        status = "fail";
        message = `Atteso ${dsl1} < ${dsl2}, ma ${value1} >= ${value2}`;
      }
      break;

    case "sum":
      if (expectedValue !== undefined) {
        const sum = value1 + value2;
        discrepancyPercent = expectedValue !== 0 ? Math.abs((sum - expectedValue) / expectedValue) * 100 : (sum !== 0 ? 100 : 0);
        if (discrepancyPercent <= 1) {
          status = "pass";
          message = `Somma corretta: ${value1} + ${value2} = ${sum} (atteso: ${expectedValue})`;
        } else {
          status = "fail";
          message = `Somma non corrisponde: ${value1} + ${value2} = ${sum}, atteso ${expectedValue}`;
        }
      }
      break;
  }

  return {
    dsl1,
    dsl2,
    value1,
    value2,
    expectedRelation,
    expectedValue,
    status,
    discrepancyPercent,
    message
  };
}
