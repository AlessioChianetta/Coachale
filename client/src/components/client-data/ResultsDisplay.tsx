import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Table as TableIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Download,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QueryResult {
  success: boolean;
  data?: {
    question?: string;
    answer?: string;
    plan?: {
      steps: any[];
      complexity: string;
    };
    results?: Array<{
      tool: string;
      success: boolean;
      data: any;
      error?: string;
      executionTimeMs: number;
    }>;
    rows?: Record<string, any>[];
    aggregations?: Record<string, any>;
    chartData?: any[];
    summary?: string;
    totalExecutionTimeMs?: number;
  };
  explanation?: string;
  sqlGenerated?: string;
  error?: string;
}

interface ResultsDisplayProps {
  result: QueryResult;
  onClose?: () => void;
}

const COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function ResultsDisplay({ result, onClose }: ResultsDisplayProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("table");
  const [copied, setCopied] = useState(false);

  const extractRows = (): Record<string, any>[] => {
    if (result.data?.rows && result.data.rows.length > 0) {
      return result.data.rows;
    }
    if (result.data?.results) {
      for (const r of result.data.results) {
        if (r.success && Array.isArray(r.data) && r.data.length > 0) {
          return r.data;
        }
      }
    }
    return [];
  };

  const rows = extractRows();
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const aggregations = result.data?.aggregations || {};
  const chartData = result.data?.chartData || rows;

  const detectChartType = (): "bar" | "line" | "pie" => {
    if (rows.length <= 5 && columns.length === 2) return "pie";
    const hasTimeColumn = columns.some(
      (col) =>
        col.toLowerCase().includes("date") ||
        col.toLowerCase().includes("month") ||
        col.toLowerCase().includes("year") ||
        col.toLowerCase().includes("mese") ||
        col.toLowerCase().includes("anno")
    );
    return hasTimeColumn ? "line" : "bar";
  };

  const chartType = detectChartType();
  const numericColumns = columns.filter((col) => {
    const firstVal = rows[0]?.[col];
    return typeof firstVal === "number";
  });
  const labelColumn = columns.find((col) => !numericColumns.includes(col)) || columns[0];

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      return new Intl.NumberFormat("it-IT", {
        maximumFractionDigits: 2,
      }).format(value);
    }
    return String(value);
  };

  const handleCopy = async () => {
    const text = rows
      .map((row) => columns.map((col) => row[col]).join("\t"))
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copiato!",
      description: "I dati sono stati copiati negli appunti",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const headers = columns.join(",");
    const csvRows = rows.map((row) =>
      columns.map((col) => JSON.stringify(row[col] ?? "")).join(",")
    );
    const csv = [headers, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Errore nella Query</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">{result.error || "Errore sconosciuto"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-none border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-600" />
              Risultati Query
            </CardTitle>
            {result.data?.summary && (
              <CardDescription className="mt-1">{result.data.summary}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="table" className="gap-2">
                <TableIcon className="h-4 w-4" />
                Tabella
              </TabsTrigger>
              <TabsTrigger value="chart" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Grafico
              </TabsTrigger>
              {Object.keys(aggregations).length > 0 && (
                <TabsTrigger value="summary" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Riepilogo
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="table" className="flex-1 m-0 p-4 overflow-hidden">
            <ScrollArea className="h-full border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap font-medium">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col}>{formatValue(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <p className="text-sm text-slate-500 mt-2">
              {rows.length} righe trovate
            </p>
          </TabsContent>

          <TabsContent value="chart" className="flex-1 m-0 p-4">
            <div className="h-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey={numericColumns[0]}
                      nameKey={labelColumn}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatValue(value)} />
                    <Legend />
                  </PieChart>
                ) : chartType === "line" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={labelColumn} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatValue(value)} />
                    <Legend />
                    {numericColumns.map((col, idx) => (
                      <Line
                        key={col}
                        type="monotone"
                        dataKey={col}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={labelColumn} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatValue(value)} />
                    <Legend />
                    {numericColumns.map((col, idx) => (
                      <Bar
                        key={col}
                        dataKey={col}
                        fill={COLORS[idx % COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {Object.keys(aggregations).length > 0 && (
            <TabsContent value="summary" className="flex-1 m-0 p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(aggregations).map(([key, value]) => (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500 capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-2xl font-bold">{formatValue(value)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
