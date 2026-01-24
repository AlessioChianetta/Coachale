import { useMemo } from "react";
import { useDatasetSyncSchema, SchemaRole } from "@/hooks/useDatasetSync";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Download,
  AlertTriangle,
  FileText,
  Package,
  Users,
  DollarSign,
  Clock,
  UserCog,
} from "lucide-react";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; labelIt: string; icon: React.ElementType; variant?: "destructive" | "default" }
> = {
  critical: { label: "Ruoli Critici", labelIt: "Critici", icon: AlertTriangle, variant: "destructive" },
  document: { label: "Ruoli Documento", labelIt: "Documento", icon: FileText },
  product: { label: "Ruoli Prodotto", labelIt: "Prodotto", icon: Package },
  customer: { label: "Ruoli Cliente", labelIt: "Cliente", icon: Users },
  financial: { label: "Ruoli Finanziari", labelIt: "Finanziari", icon: DollarSign },
  temporal: { label: "Ruoli Temporali", labelIt: "Temporali", icon: Clock },
  staff: { label: "Ruoli Staff", labelIt: "Staff", icon: UserCog },
};

function copyToClipboard(text: string, toast: ReturnType<typeof useToast>["toast"]) {
  navigator.clipboard.writeText(text);
  toast({
    title: "Copiato!",
    description: "Testo copiato negli appunti",
    duration: 2000,
  });
}

function RoleTable({
  roles,
  toast,
}: {
  roles: SchemaRole[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  if (!roles || roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nessun ruolo in questa categoria
      </p>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Ruolo ID</TableHead>
            <TableHead className="w-[150px]">Nome</TableHead>
            <TableHead className="w-[100px]">Tipo Dato</TableHead>
            <TableHead>Pattern Auto-Detect</TableHead>
            <TableHead className="w-[200px]">Descrizione</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-mono text-sm">
                <div className="flex items-center gap-1">
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                    {role.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(role.id, toast)}
                    title="Copia ID"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="font-medium">{role.nameIt || role.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {role.dataType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {role.autoDetectPatterns && role.autoDetectPatterns.length > 0 ? (
                    role.autoDetectPatterns.slice(0, 5).map((pattern, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs font-mono"
                      >
                        {pattern}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                  {role.autoDetectPatterns && role.autoDetectPatterns.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{role.autoDetectPatterns.length - 5}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {role.description}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[350px]" />
          </div>
          <Skeleton className="h-9 w-[120px]" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SchemaReferencePanel() {
  const { data: schema, isLoading, error } = useDatasetSyncSchema();
  const { toast } = useToast();

  const rolesByCategory = useMemo(() => {
    if (!schema?.roles || !schema?.roleCategories) return {};

    const result: Record<string, SchemaRole[]> = {};

    for (const [category, roleIds] of Object.entries(schema.roleCategories)) {
      result[category] = (roleIds as string[])
        .map((id) => schema.roles.find((r) => r.id === id))
        .filter(Boolean) as SchemaRole[];
    }

    return result;
  }, [schema]);

  const handleCopyFullSchema = () => {
    if (!schema) return;
    const json = JSON.stringify(schema, null, 2);
    navigator.clipboard.writeText(json);
    toast({
      title: "Schema copiato!",
      description: "Lo schema completo è stato copiato negli appunti",
      duration: 3000,
    });
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !schema) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Errore nel caricamento dello schema. Riprova più tardi.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">Schema Colonne</CardTitle>
              {schema.version && (
                <Badge variant="secondary">v{schema.version}</Badge>
              )}
            </div>
            <CardDescription>
              Documentazione dei ruoli logici per il mapping automatico
            </CardDescription>
            {schema.lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Ultimo aggiornamento:{" "}
                {new Date(schema.lastUpdated).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyFullSchema}>
            <Download className="h-4 w-4 mr-2" />
            Esporta Schema
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Accordion type="multiple" defaultValue={["critical"]} className="space-y-2">
          {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
            const roles = rolesByCategory[category] || [];
            const Icon = config.icon;
            const isCritical = category === "critical";

            return (
              <AccordionItem
                key={category}
                value={category}
                className={`border rounded-lg px-4 ${
                  isCritical ? "border-amber-300 bg-amber-50/50" : ""
                }`}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-5 w-5 ${
                        isCritical ? "text-amber-600" : "text-muted-foreground"
                      }`}
                    />
                    <span className={isCritical ? "font-semibold text-amber-800" : ""}>
                      {config.label}
                    </span>
                    <Badge variant={isCritical ? "default" : "secondary"} className="ml-2">
                      {roles.length}
                    </Badge>
                    {isCritical && (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white ml-1">
                        Obbligatori
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <RoleTable roles={roles} toast={toast} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {schema.defaults && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Valori di Default</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  document_type (default)
                </p>
                <Badge variant="default" className="text-sm">
                  {schema.defaults.document_type || "sale"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Se la colonna document_type non è presente, tutte le righe sono
                  considerate vendite
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  sales_channel (default)
                </p>
                <Badge variant="default" className="text-sm">
                  {schema.defaults.sales_channel || "dine_in"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Se non specificato, il canale vendita è considerato servizio al tavolo
                </p>
              </div>
            </div>

            {schema.defaults.time_slot_mapping && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Mappatura Fasce Orarie
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fascia</TableHead>
                        <TableHead>Orario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(schema.defaults.time_slot_mapping).map(
                        ([slot, timeRange]) => (
                          <TableRow key={slot}>
                            <TableCell className="font-medium capitalize">
                              {slot}
                            </TableCell>
                            <TableCell>
                              <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                                {timeRange}
                              </code>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {schema.schedulingOptions && schema.schedulingOptions.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Opzioni di Schedulazione</h3>
            <p className="text-sm text-muted-foreground">
              Configura la frequenza di sincronizzazione automatica dei dati
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Esempio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schema.schedulingOptions.map((option, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">
                          {option.pattern}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">
                          {option.example}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="pt-4 border-t flex justify-end">
          <Button onClick={handleCopyFullSchema} className="gap-2">
            <Copy className="h-4 w-4" />
            Copia Schema Completo (JSON)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SchemaReferencePanel;
