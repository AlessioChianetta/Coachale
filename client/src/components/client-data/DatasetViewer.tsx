import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  Filter,
  RefreshCw,
  TableIcon,
} from "lucide-react";

interface DatasetViewerProps {
  datasetId: string;
  datasetName: string;
  onBack?: () => void;
}

interface PreviewData {
  columns: string[];
  rows: Record<string, any>[];
  totalRowCount: number;
  columnMapping: Record<string, { displayName: string; dataType: string }>;
}

export function DatasetViewer({ datasetId, datasetName, onBack }: DatasetViewerProps) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 50;

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ success: boolean; data: PreviewData }>({
    queryKey: [`/api/client-data/datasets/${datasetId}/preview`, page, pageSize],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/client-data/datasets/${datasetId}/preview?limit=${pageSize}&offset=${(page - 1) * pageSize}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error("Errore nel caricamento");
      return response.json();
    },
  });

  const previewData = data?.data;
  const totalPages = previewData ? Math.ceil(previewData.totalRowCount / pageSize) : 0;

  const formatCellValue = (value: any, dataType?: string) => {
    if (value === null || value === undefined) return "-";

    switch (dataType) {
      case "currency":
        return typeof value === "number"
          ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value)
          : value;
      case "percentage":
        return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : value;
      case "date":
        if (value instanceof Date || typeof value === "string") {
          const date = new Date(value);
          return isNaN(date.getTime())
            ? value
            : date.toLocaleDateString("it-IT");
        }
        return value;
      case "number":
        return typeof value === "number"
          ? new Intl.NumberFormat("it-IT").format(value)
          : value;
      default:
        return String(value);
    }
  };

  const getColumnDisplayName = (colName: string) => {
    return previewData?.columnMapping?.[colName]?.displayName || colName;
  };

  const getColumnDataType = (colName: string) => {
    return previewData?.columnMapping?.[colName]?.dataType;
  };

  const filteredRows = previewData?.rows.filter((row) => {
    if (!searchTerm) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500">Errore nel caricamento dei dati</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-cyan-600" />
                {datasetName}
              </CardTitle>
              <CardDescription>
                {previewData && (
                  <>
                    {previewData.totalRowCount.toLocaleString("it-IT")} righe ·{" "}
                    {previewData.columns.length} colonne
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cerca nei dati..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : previewData ? (
          <>
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead className="w-12 text-center">#</TableHead>
                    {previewData.columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span>{getColumnDisplayName(col)}</span>
                          <Badge variant="outline" className="text-xs w-fit">
                            {getColumnDataType(col) || "text"}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredRows || []).map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <TableCell className="text-center text-xs text-slate-400">
                        {(page - 1) * pageSize + idx + 1}
                      </TableCell>
                      {previewData.columns.map((col) => (
                        <TableCell key={col} className="max-w-xs truncate">
                          {formatCellValue(row[col], getColumnDataType(col))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 flex-none">
              <p className="text-sm text-slate-500">
                Pagina {page} di {totalPages} ({previewData.totalRowCount.toLocaleString("it-IT")} righe totali)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-4 py-2 text-sm">{page}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
