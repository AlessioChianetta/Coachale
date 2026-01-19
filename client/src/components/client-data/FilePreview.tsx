import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Check, Plus, ArrowRight, X } from "lucide-react";

interface SheetInfo {
  name: string;
  rowCount: number;
  columns: { name: string; sampleValues: any[] }[];
  sampleRows: Record<string, any>[];
}

interface UploadResult {
  filePath: string;
  originalFilename: string;
  fileSize: number;
  format: string;
  sheets: SheetInfo[];
}

interface FilePreviewProps {
  uploadResult: UploadResult;
  onConfirm: () => void;
  onAddMore: () => void;
  onCancel: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ uploadResult, onConfirm, onAddMore, onCancel }: FilePreviewProps) {
  const mainSheet = uploadResult.sheets[0];
  const columns = mainSheet?.columns.slice(0, 8) || [];
  const sampleRows = mainSheet?.sampleRows.slice(0, 5) || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Anteprima File Caricato
        </CardTitle>
        <CardDescription>
          Verifica che sia il file corretto prima di procedere
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="font-medium">{uploadResult.originalFilename}</p>
              <p className="text-sm text-slate-500">
                {formatFileSize(uploadResult.fileSize)} · {uploadResult.format.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {uploadResult.sheets.map((sheet) => (
              <Badge key={sheet.name} variant="secondary">
                {sheet.name}: {sheet.rowCount.toLocaleString()} righe
              </Badge>
            ))}
          </div>
        </div>

        {sampleRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Prime {sampleRows.length} righe di "{mainSheet.name}"
            </p>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.name} className="whitespace-nowrap text-xs">
                        {col.name}
                      </TableHead>
                    ))}
                    {mainSheet.columns.length > 8 && (
                      <TableHead className="text-xs text-slate-400">
                        +{mainSheet.columns.length - 8} altre
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col.name} className="text-sm max-w-32 truncate">
                          {row[col.name]?.toString() || "-"}
                        </TableCell>
                      ))}
                      {mainSheet.columns.length > 8 && (
                        <TableCell className="text-slate-400">...</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-slate-500 text-right">
              Mostrando {sampleRows.length} di {mainSheet.rowCount.toLocaleString()} righe
            </p>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Prossimo passo:</strong> L'AI analizzerà automaticamente le colonne 
            e suggerirà i tipi di dati appropriati (numeri, date, testo, ecc.)
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Annulla
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onAddMore}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi altro file
          </Button>
          <Button onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowRight className="h-4 w-4 mr-2" />
            Procedi con l'analisi
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
