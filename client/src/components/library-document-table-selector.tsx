
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Search, ChevronLeft, ChevronRight, X, CheckCircle2, Filter, Library } from "lucide-react";

interface LibraryDocumentTableSelectorProps {
  selectedDocumentId: string;
  onDocumentSelect: (documentId: string) => void;
}

export default function LibraryDocumentTableSelector({ 
  selectedDocumentId, 
  onDocumentSelect 
}: LibraryDocumentTableSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedDocumentId);
  const itemsPerPage = 5;
  
  // Sincronizza lo stato locale con il prop quando cambia dall'esterno
  React.useEffect(() => {
    setLocalSelectedId(selectedDocumentId);
  }, [selectedDocumentId]);
  
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["/api/library/documents"],
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["/api/library/categories"],
  });

  const isLoading = docsLoading || catsLoading;

  // Filtra documenti in base alla ricerca e categoria
  const filteredDocuments = documents.filter((doc: any) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || doc.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calcola paginazione
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset pagina quando cambia il filtro
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c: any) => c.id === categoryId);
    return category?.name || "Altro";
  };

  return (
    <div className="space-y-4">
      {/* Header con icona e contatore */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg border border-purple-100 dark:border-purple-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <Library className="h-5 w-5 text-white" />
          </div>
          <div>
            <Label className="text-base font-bold text-foreground">
              Lezione del Corso Collegata
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Collega questa lezione ad un documento dalla libreria
            </p>
          </div>
        </div>
        {filteredDocuments.length > 0 && (
          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 px-3 py-1">
            {filteredDocuments.length} {filteredDocuments.length === 1 ? 'documento' : 'documenti'}
          </Badge>
        )}
      </div>

      {/* Search and Filter - Stile migliorato */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-500" />
          <Input
            placeholder="🔍 Cerca per titolo lezione..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-2 border-purple-100 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600 rounded-lg"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[220px] h-11 border-2 border-purple-100 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-purple-500" />
              <SelectValue placeholder="Tutte le categorie" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">📚 Tutte le categorie</SelectItem>
            {categories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documento selezionato - Design migliorato */}
      {localSelectedId && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-800 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-0.5">
                  ✓ Documento Selezionato
                </p>
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  {documents.find((d: any) => d.id === localSelectedId)?.title}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalSelectedId("");
                onDocumentSelect("");
              }}
              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg"
            >
              <X className="h-4 w-4 text-green-700 dark:text-green-300" />
            </Button>
          </div>
        </div>
      )}

      {/* Table - Design migliorato */}
      <div className="border-2 border-purple-100 dark:border-purple-800 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 border-b-2 border-purple-200 dark:border-purple-700">
              <TableHead className="w-[60px] font-semibold"></TableHead>
              <TableHead className="font-semibold text-purple-900 dark:text-purple-100">📖 Titolo Lezione</TableHead>
              <TableHead className="font-semibold text-purple-900 dark:text-purple-100">📁 Categoria</TableHead>
              <TableHead className="font-semibold text-purple-900 dark:text-purple-100">🎯 Livello</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                    <p className="text-sm text-muted-foreground">Caricamento documenti...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <BookOpen className="h-12 w-12 text-muted-foreground opacity-30" />
                    <p className="text-sm font-medium text-muted-foreground">Nessuna lezione trovata</p>
                    <p className="text-xs text-muted-foreground">Prova a modificare i filtri di ricerca</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow 
                  className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors border-b border-purple-100 dark:border-purple-900"
                  onClick={() => {
                    setLocalSelectedId("");
                    onDocumentSelect("");
                  }}
                >
                  <TableCell>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      !localSelectedId 
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-500 shadow-sm' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                    }`}>
                      {!localSelectedId && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                      <span className="italic">Nessun documento collegato</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">-</TableCell>
                  <TableCell className="text-muted-foreground">-</TableCell>
                </TableRow>
                {paginatedDocuments.map((doc: any) => (
                  <TableRow 
                    key={doc.id}
                    className={`cursor-pointer transition-all border-b border-purple-50 dark:border-purple-900/50 ${
                      localSelectedId === doc.id 
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30' 
                        : 'hover:bg-purple-50/30 dark:hover:bg-purple-950/10'
                    }`}
                    onClick={() => {
                      setLocalSelectedId(doc.id);
                      onDocumentSelect(doc.id);
                    }}
                  >
                    <TableCell>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        localSelectedId === doc.id 
                          ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-500 shadow-sm' 
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                      }`}>
                        {localSelectedId === doc.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </div>
                    </TableCell>
                    <TableCell className={`font-medium ${localSelectedId === doc.id ? 'text-purple-900 dark:text-purple-100' : ''}`}>
                      {doc.title}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getCategoryName(doc.categoryId)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {doc.level && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-semibold border-2 ${
                            doc.level === 'avanzato' 
                              ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700' :
                            doc.level === 'intermedio' 
                              ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700' :
                              'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-300 dark:border-green-700'
                          }`}
                        >
                          {doc.level}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginazione - Design migliorato */}
      {filteredDocuments.length > itemsPerPage && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg border border-purple-100 dark:border-purple-800">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700">
              Pagina {currentPage} di {totalPages}
            </Badge>
            <span className="text-sm text-muted-foreground">
              • Mostrando <strong>{startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)}</strong> di <strong>{filteredDocuments.length}</strong>
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Precedente
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 p-0 ${
                      currentPage === page 
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-sm' 
                        : 'border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                    }`}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50"
            >
              Successivo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
