import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BookOpen, Folder, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LibraryDocumentSelectorProps {
  selectedDocumentId: string;
  onDocumentSelect: (documentId: string) => void;
}

export function LibraryDocumentSelector({
  selectedDocumentId,
  onDocumentSelect
}: LibraryDocumentSelectorProps) {
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/library/categories"],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["/api/library/documents"],
  });

  // State for search query
  const [searchQuery, setSearchQuery] = React.useState("");

  // Raggruppa documenti per categoria e sottocategoria
  const groupedDocuments = documents.reduce((acc: any, doc: any) => {
    const categoryId = doc.categoryId;
    const subcategoryId = doc.subcategoryId || "no-subcategory";

    if (!acc[categoryId]) {
      acc[categoryId] = {};
    }
    if (!acc[categoryId][subcategoryId]) {
      acc[categoryId][subcategoryId] = [];
    }
    acc[categoryId][subcategoryId].push(doc);

    return acc;
  }, {});

  // Filter documents based on search query
  const filteredDocuments = documents.filter((doc: any) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered documents
  const filteredGroupedDocuments = filteredDocuments.reduce((acc: any, doc: any) => {
    const categoryId = doc.categoryId;
    const subcategoryId = doc.subcategoryId || "no-subcategory";

    if (!acc[categoryId]) {
      acc[categoryId] = {};
    }
    if (!acc[categoryId][subcategoryId]) {
      acc[categoryId][subcategoryId] = [];
    }
    acc[categoryId][subcategoryId].push(doc);

    return acc;
  }, {});


  return (
    <div className="space-y-2">
      <Label htmlFor="libraryDocument">Seleziona Lezione dal Corso</Label>
      <Select
        value={selectedDocumentId || ""}
        onValueChange={(value) => onDocumentSelect(value)}
      >
        <SelectTrigger className="h-12 text-base border-2 border-purple-200 hover:border-purple-300 focus:border-purple-400 transition-colors">
          <SelectValue placeholder="📚 Seleziona lezione del corso (opzionale)..." />
        </SelectTrigger>
        <SelectContent className="max-h-[450px]">
          {/* Search Bar */}
          <div className="p-2 sticky top-0 bg-background z-10 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca lezione..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>

          {/* Opzione "Nessun documento" */}
          <SelectItem value=" ">
            <div className="flex items-center gap-2 py-1">
              <X className="h-4 w-4 text-muted-foreground" />
              <span>Nessun documento collegato</span>
            </div>
          </SelectItem>
          {categories.map((category: any) => {
            const categoryDocs = filteredGroupedDocuments[category.id] || {};

            return Object.keys(categoryDocs).length > 0 ? (
              <div key={category.id}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {category.name}
                </div>
                {Object.entries(categoryDocs).map(([subcatId, docs]: [string, any]) => (
                  <div key={subcatId}>
                    {docs.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id} className="pl-6">
                        {doc.title}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </div>
            ) : null;
          })}
        </SelectContent>
      </Select>
      {/* Documento selezionato */}
      {selectedDocumentId && selectedDocumentId.trim() && (
        <p className="text-xs text-muted-foreground">
          La lezione mostrerà un pulsante "Vai alla Lezione" per accedere al corso
        </p>
      )}
    </div>
  );
}