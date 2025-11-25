import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, X, CheckCircle2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface LibraryDocumentTableProps {
  selectedDocumentId: string;
  onDocumentSelect: (documentId: string) => void;
}

export function LibraryDocumentTable({
  selectedDocumentId,
  onDocumentSelect
}: LibraryDocumentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["/api/library/categories"],
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["/api/library/subcategories"],
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["/api/library/documents"],
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

  const getSubcategoryName = (subcategoryId: string | null) => {
    if (!subcategoryId) return null;
    const subcategory = subcategories.find((s: any) => s.id === subcategoryId);
    return subcategory?.name || null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="h-4 w-4 text-primary" />
          Lezione del Corso Collegata
        </Label>
        {filteredDocuments.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {filteredDocuments.length} {filteredDocuments.length === 1 ? 'trovata' : 'trovate'}
          </Badge>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca lezione..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutte le categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document selezionato */}
      {selectedDocumentId && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <strong>Selezionato:</strong> {documents.find((d: any) => d.id === selectedDocumentId)?.title}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDocumentSelect("")}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Livello</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nessuna lezione trovata
                </TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      console.log('🗑️ LIBRARY DOCUMENT DESELECTED', {
                        previousId: selectedDocumentId,
                        timestamp: new Date().toISOString()
                      });
                      onDocumentSelect("");
                    }}
                  >
                    <TableCell>
                      <div className={`h-4 w-4 rounded-full border-2 ${!selectedDocumentId ? 'bg-primary border-primary' : 'border-muted'}`}>
                        {!selectedDocumentId && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-muted-foreground" />
                        Nessun documento collegato
                      </div>
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                {paginatedDocuments.map((doc: any) => {
                  const subcategoryName = getSubcategoryName(doc.subcategoryId);
                  return (
                    <TableRow 
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        console.log('✅ LIBRARY DOCUMENT SELECTED', {
                          documentId: doc.id,
                          documentTitle: doc.title,
                          previousId: selectedDocumentId,
                          timestamp: new Date().toISOString()
                        });
                        onDocumentSelect(doc.id);
                      }}
                    >
                      <TableCell>
                        <div className={`h-4 w-4 rounded-full border-2 ${selectedDocumentId === doc.id ? 'bg-primary border-primary' : 'border-muted'}`}>
                          {selectedDocumentId === doc.id && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getCategoryName(doc.categoryId)}</div>
                          {subcategoryName && (
                            <div className="text-xs text-muted-foreground">{subcategoryName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.level && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              doc.level === 'avanzato' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                              doc.level === 'intermedio' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                              'bg-green-50 text-green-600 border-green-200'
                            }`}
                          >
                            {doc.level}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginazione */}
      {filteredDocuments.length > itemsPerPage && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} di {filteredDocuments.length}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              Precedente
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  type="button"
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    console.log('📄 LIBRARY DOCUMENT TABLE - PAGE CHANGE', {
                      previousPage: currentPage,
                      newPage: page,
                      totalPages,
                      filteredDocumentsCount: filteredDocuments.length,
                      selectedDocumentId,
                      selectedDocumentTitle: documents.find((d: any) => d.id === selectedDocumentId)?.title,
                      startIndex: (page - 1) * itemsPerPage,
                      endIndex: Math.min(page * itemsPerPage, filteredDocuments.length),
                      timestamp: new Date().toISOString()
                    });
                    setCurrentPage(page);
                  }}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Successivo
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}