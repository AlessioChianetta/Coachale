import type { ExecutedToolResult } from "./tool-definitions";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface ChartData {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'kpi';
  title: string;
  unit?: 'currency' | 'percentage' | 'number';
  data?: ChartDataPoint[];
  series?: ChartSeries[];
  value?: number;
  sourceTool?: string;
  metric?: string;
}

const COLOR_PALETTE = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

const DATE_PATTERNS = [
  /^\d{4}-\d{2}$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^Q[1-4]\s*\d{4}$/i,
  /^Q[1-4]$/i,
  /^\d{4}$/,
];

const ITALIAN_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

const ITALIAN_MONTH_ABBR = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic'
];

function isDateLabel(label: string): boolean {
  if (DATE_PATTERNS.some(p => p.test(label))) return true;
  const lower = label.toLowerCase();
  if (ITALIAN_MONTHS.some(m => lower.includes(m))) return true;
  if (ITALIAN_MONTH_ABBR.some(m => lower === m || lower.startsWith(m + ' '))) return true;
  return false;
}

function detectUnit(name: string): 'currency' | 'percentage' | 'number' {
  const lower = name.toLowerCase();
  if (lower.includes('percent') || lower.includes('%')) return 'percentage';
  if (lower.includes('cost') || lower.includes('revenue') || lower.includes('price') ||
      lower.includes('total') || lower.includes('euro') || lower.includes('€') ||
      lower.includes('fatturato') || lower.includes('ricavo') || lower.includes('incasso') ||
      lower.includes('costo') || lower.includes('prezzo') || lower.includes('margine')) return 'currency';
  return 'number';
}

function humanizeMetricName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function sortChronologically(points: ChartDataPoint[]): ChartDataPoint[] {
  return [...points].sort((a, b) => {
    const aDate = parseChronoLabel(a.label);
    const bDate = parseChronoLabel(b.label);
    if (aDate && bDate) return aDate - bDate;
    return 0;
  });
}

function parseChronoLabel(label: string): number | null {
  const yyyyMm = label.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMm) return parseInt(yyyyMm[1]) * 100 + parseInt(yyyyMm[2]);

  const yyyyMmDd = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) return parseInt(yyyyMmDd[1]) * 10000 + parseInt(yyyyMmDd[2]) * 100 + parseInt(yyyyMmDd[3]);

  const quarter = label.match(/^Q([1-4])\s*(\d{4})$/i);
  if (quarter) return parseInt(quarter[2]) * 10 + parseInt(quarter[1]);

  const lower = label.toLowerCase();
  const monthIdx = ITALIAN_MONTHS.findIndex(m => lower.includes(m));
  if (monthIdx >= 0) {
    const yearMatch = label.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : 2000;
    return year * 100 + monthIdx + 1;
  }
  const abbrIdx = ITALIAN_MONTH_ABBR.findIndex(m => lower === m || lower.startsWith(m + ' '));
  if (abbrIdx >= 0) {
    const yearMatch = label.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : 2000;
    return year * 100 + abbrIdx + 1;
  }

  return null;
}

function buildKpi(result: ExecutedToolResult, index: number, timestamp: number): ChartData | null {
  if (!Array.isArray(result.result) || result.result.length !== 1) return null;
  const row = result.result[0];
  const keys = Object.keys(row);

  let numericValue: number | null = null;
  let metricKey = '';

  for (const key of keys) {
    const val = row[key];
    const parsed = typeof val === 'number' ? val : parseFloat(val);
    if (!isNaN(parsed)) {
      numericValue = parsed;
      metricKey = key;
      break;
    }
  }

  if (numericValue === null) return null;

  const metricName = result.args?.metricName || metricKey || 'metric';

  return {
    id: `chart_${timestamp}_${index}`,
    type: 'kpi',
    title: humanizeMetricName(metricName),
    unit: detectUnit(metricName),
    value: numericValue,
    sourceTool: result.toolName,
    metric: metricName,
  };
}

function buildFromRows(rows: Record<string, any>[], result: ExecutedToolResult, index: number, timestamp: number): ChartData[] {
  if (rows.length === 0) return [];

  const charts: ChartData[] = [];
  const sampleRow = rows[0];
  const keys = Object.keys(sampleRow);

  const stringCols: string[] = [];
  const numericCols: string[] = [];

  for (const key of keys) {
    const values = rows.map(r => r[key]).filter(v => v !== null && v !== undefined);
    const numericCount = values.filter(v => {
      const n = typeof v === 'number' ? v : parseFloat(v);
      return !isNaN(n);
    }).length;

    if (numericCount > values.length * 0.7) {
      numericCols.push(key);
    } else {
      stringCols.push(key);
    }
  }

  if (stringCols.length === 0 || numericCols.length === 0) return [];

  const labelCol = stringCols[0];
  const labels = rows.map(r => String(r[labelCol] ?? ''));
  const hasDateLabels = labels.filter(l => isDateLabel(l)).length > labels.length * 0.5;

  const metricContext = result.args?.metricName || result.args?.metric || numericCols[0] || '';

  if (numericCols.length === 1) {
    const valueCol = numericCols[0];
    let points: ChartDataPoint[] = rows.map((row, i) => ({
      label: String(row[labelCol] ?? ''),
      value: typeof row[valueCol] === 'number' ? row[valueCol] : parseFloat(row[valueCol]) || 0,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }));

    let chartType: 'bar' | 'line' | 'pie';

    if (hasDateLabels) {
      chartType = 'line';
      points = sortChronologically(points);
    } else if (rows.length < 8) {
      chartType = 'pie';
      if (rows.length > 7) {
        const sorted = [...points].sort((a, b) => b.value - a.value);
        const top7 = sorted.slice(0, 7);
        const altroValue = sorted.slice(7).reduce((sum, p) => sum + p.value, 0);
        if (altroValue > 0) {
          top7.push({ label: 'Altro', value: altroValue, color: COLOR_PALETTE[7 % COLOR_PALETTE.length] });
        }
        points = top7.map((p, i) => ({ ...p, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }));
      }
    } else {
      chartType = 'bar';
    }

    const title = humanizeMetricName(valueCol) + (labelCol ? ` per ${humanizeMetricName(labelCol)}` : '');

    charts.push({
      id: `chart_${timestamp}_${index}`,
      type: chartType,
      title,
      unit: detectUnit(metricContext || valueCol),
      data: points,
      sourceTool: result.toolName,
      metric: metricContext || valueCol,
    });
  } else {
    const series: ChartSeries[] = numericCols.map(col => ({
      name: humanizeMetricName(col),
      data: rows.map((row, i) => ({
        label: String(row[labelCol] ?? ''),
        value: typeof row[col] === 'number' ? row[col] : parseFloat(row[col]) || 0,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      })),
    }));

    if (hasDateLabels) {
      for (const s of series) {
        s.data = sortChronologically(s.data);
      }
    }

    const title = numericCols.map(c => humanizeMetricName(c)).join(', ') +
      ` per ${humanizeMetricName(labelCol)}`;

    charts.push({
      id: `chart_${timestamp}_${index}`,
      type: hasDateLabels ? 'line' : 'bar',
      title,
      unit: detectUnit(metricContext || numericCols[0]),
      series,
      sourceTool: result.toolName,
      metric: metricContext || numericCols[0],
    });
  }

  return charts;
}

export function buildChartData(results: ExecutedToolResult[]): ChartData[] {
  const charts: ChartData[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result.success || !result.result) continue;

    if (!Array.isArray(result.result)) continue;

    const rows = result.result;
    if (rows.length === 0) continue;

    if (result.toolName === 'execute_metric' && rows.length === 1) {
      const kpi = buildKpi(result, i, timestamp);
      if (kpi) {
        charts.push(kpi);
        continue;
      }
    }

    if (rows.length === 1) {
      const row = rows[0];
      const numericKeys = Object.keys(row).filter(k => {
        const v = row[k];
        return !isNaN(typeof v === 'number' ? v : parseFloat(v));
      });
      if (numericKeys.length === 1 && Object.keys(row).length <= 2) {
        const kpi = buildKpi(result, i, timestamp);
        if (kpi) {
          charts.push(kpi);
          continue;
        }
      }
    }

    if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
      const rowCharts = buildFromRows(rows, result, i, timestamp);
      charts.push(...rowCharts);
    }
  }

  return charts;
}
