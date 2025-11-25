import React, { useState, useEffect } from 'react';
import { HiOutlineFolderDownload } from 'react-icons/hi';
import { MdOutlineKeyboardArrowRight } from 'react-icons/md';
import { IoIosStarOutline } from 'react-icons/io';
import { FaRegCalendarAlt } from 'react-icons/fa';
import { TbFileDescription } from 'react-icons/tb';
import { SlPicture } from 'react-icons/sl';
import { MdOutlineInsertDriveFile } from 'react-icons/md';
import { IoDocumentTextOutline } from 'react-icons/io5';
import { BiSolidUser } from 'react-icons/bi';
import { MdOutlineEdit } from 'react-icons/md';
import { MdOutlineDeleteOutline } from 'react-icons/md';
import { IoIosMore } from 'react-icons/io';
import { MdOutlineSearch } from 'react-icons/md';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { BookOpen, CheckCircle, Clock, Folder, GraduationCap, Search, ChevronRight, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Card, CardContent } from 'lucide-react'; // Assuming these are available from a UI library

// Dummy data and functions (replace with actual implementations)
const categories = [
  { id: "cat1", name: "Introduzione a React", color: "blue", icon: "BookOpen", documentCount: 5 },
  { id: "cat2", name: "Backend con Node.js", color: "green", icon: "Folder", documentCount: 8 },
  { id: "cat3", name: "Database SQL", color: "red", icon: "BookOpen", documentCount: 3 },
];

const subcategories = [
  { id: "sub1", categoryId: "cat1", name: "Componenti", color: "blue", icon: "BookOpen", documentCount: 2 },
  { id: "sub2", categoryId: "cat1", name: "State & Props", color: "blue", icon: "Folder", documentCount: 3 },
  { id: "sub3", categoryId: "cat2", name: "API REST", color: "green", icon: "BookOpen", documentCount: 4 },
  { id: "sub4", categoryId: "cat2", name: "Autenticazione", color: "green", icon: "Folder", documentCount: 4 },
];

const documents = [
  { id: "doc1", categoryId: "cat1", subcategoryId: "sub1", title: "Cos'è un componente React?", description: "Spiegazione dei componenti funzionali e di classe.", level: "base", estimatedDuration: 5, date: "2023-01-10" },
  { id: "doc2", categoryId: "cat1", subcategoryId: "sub1", title: "Props vs State", description: "Differenze e casi d'uso di props e state.", level: "base", estimatedDuration: 7, date: "2023-01-12" },
  { id: "doc3", categoryId: "cat1", subcategoryId: "sub2", title: "Gestire lo stato locale", description: "Utilizzo di useState hook.", level: "intermedio", estimatedDuration: 10, date: "2023-01-15" },
  { id: "doc4", categoryId: "cat1", subcategoryId: "sub2", title: "Passare dati con Props", description: "Come inviare dati da un componente padre a un figlio.", level: "base", estimatedDuration: 6, date: "2023-01-18" },
  { id: "doc5", categoryId: "cat2", subcategoryId: "sub3", title: "Creare un'API REST con Express", description: "Fondamenti di Express.js per creare API.", level: "intermedio", estimatedDuration: 15, date: "2023-02-01" },
  { id: "doc6", categoryId: "cat2", subcategoryId: "sub3", title: "Metodi HTTP", description: "GET, POST, PUT, DELETE e loro utilizzi.", level: "intermedio", estimatedDuration: 8, date: "2023-02-03" },
  { id: "doc7", categoryId: "cat2", subcategoryId: "sub4", title: "JWT per l'autenticazione", description: "Implementazione di JSON Web Tokens.", level: "avanzato", estimatedDuration: 12, date: "2023-02-05" },
  { id: "doc8", categoryId: "cat3", subcategoryId: "sub5", title: "Introduzione a SQL", description: "Comandi base per interrogare un database.", level: "base", estimatedDuration: 9, date: "2023-03-01" },
];

const getCategoryIcon = (iconName) => {
  switch (iconName) {
    case "BookOpen":
      return <BookOpen size={16} className="text-white" />;
    case "Folder":
      return <Folder size={16} className="text-white" />;
    default:
      return <BookOpen size={16} className="text-white" />;
  }
};

const getLevelBadgeColor = (level) => {
  switch (level) {
    case "base":
      return "bg-green-500";
    case "intermedio":
      return "bg-yellow-500";
    case "avanzato":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getCategoryProgress = (categoryId) => {
  // Dummy progress calculation
  const categoryDocs = documents.filter(doc => doc.categoryId === categoryId);
  const readCount = categoryDocs.filter(doc => isDocumentRead(doc.id)).length;
  return { total: categoryDocs.length, read: readCount };
};

const isDocumentRead = (documentId) => {
  // Dummy function to check if a document is read
  return Math.random() > 0.5;
};

const Sidebar = ({
  // categories, // These props are now managed internally for the new structure
  // documents,
  // selectedCategory,
  // onCategorySelect,
  // onDocumentSelect,
  // openDocument,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [filteredDocuments, setFilteredDocuments] = useState(documents);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory("all"); // Reset subcategory when category changes
  };

  const handleSubcategoryChange = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
  };

  const handleViewDocument = (document) => {
    console.log("Viewing document:", document.title);
    // Implement actual document viewing logic here
  };

  useEffect(() => {
    let currentFilteredDocuments = documents;

    // Filter by category
    if (selectedCategory !== "all") {
      currentFilteredDocuments = currentFilteredDocuments.filter(doc => doc.categoryId === selectedCategory);
    }

    // Filter by subcategory
    if (selectedSubcategory !== "all") {
      currentFilteredDocuments = currentFilteredDocuments.filter(doc => doc.subcategoryId === selectedSubcategory);
    }

    // Filter by level
    if (selectedLevel !== "all") {
      currentFilteredDocuments = currentFilteredDocuments.filter(doc => doc.level === selectedLevel);
    }

    // Filter by search term
    if (searchTerm) {
      currentFilteredDocuments = currentFilteredDocuments.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDocuments(currentFilteredDocuments);
  }, [selectedCategory, selectedSubcategory, selectedLevel, searchTerm, documents]);

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      {isOpen && (
        <div className="w-80 flex flex-col bg-white dark:bg-gray-800 px-6 py-8 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              <GraduationCap size={28} className="inline-block mr-2 text-blue-600" />
              La Mia Libreria
            </h2>
            <button onClick={toggleSidebar} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <MdKeyboardArrowDown className="w-7 h-7" />
            </button>
          </div>

          {/* Course Selection Section */}
          <Card className="shadow-sm border-muted/40 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <GraduationCap size={24} className="text-blue-600" />
                <h2 className="text-xl font-semibold">Seleziona il tuo Corso</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* All Courses Option */}
                <Card
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedCategory === "all"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-md"
                      : "hover:border-blue-300 hover:shadow-sm"
                  }`}
                  onClick={() => handleCategoryChange("all")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <BookOpen size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Tutti i Corsi</h3>
                        <p className="text-sm text-muted-foreground">{documents.length} lezioni totali</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Course Cards */}
                {categories.map((category: any) => {
                  const categoryDocs = documents.filter((d: any) => d.categoryId === category.id);
                  const categoryProgress = getCategoryProgress(category.id);

                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        selectedCategory === category.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-md"
                          : "hover:border-blue-300 hover:shadow-sm"
                      }`}
                      onClick={() => handleCategoryChange(category.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 bg-${category.color}-500 rounded-lg flex items-center justify-center`}>
                            {getCategoryIcon(category.icon || "BookOpen")}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{category.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{categoryDocs.length} lezioni</span>
                              {categoryProgress.read > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-600">{categoryProgress.read} completate</span>
                                </>
                              )}
                            </div>
                          </div>
                          {selectedCategory === category.id && (
                            <CheckCircle size={16} className="text-blue-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Layout with Sidebar */}
          <div className="flex gap-8">
            {/* Left Sidebar - Categories */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm sticky top-6">
                <div className="flex items-center gap-2 mb-6">
                  <Folder size={20} className="text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Categorie</h3>
                </div>

                {/* Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      placeholder="Cerca lezioni..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-purple-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Categories List */}
                <div className="space-y-2">
                  {/* All Subcategories */}
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedSubcategory === "all"
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                    }`}
                    onClick={() => setSelectedSubcategory("all")}
                  >
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">Tutte le Categorie</div>
                      <div className={`text-xs ${selectedSubcategory === "all" ? "text-purple-100" : "text-gray-500"}`}>
                        {filteredDocuments.length} lezioni
                      </div>
                    </div>
                  </div>

                  {/* Subcategories for selected course */}
                  {selectedCategory !== "all" && subcategories
                    .filter((sub: any) => sub.categoryId === selectedCategory)
                    .map((subcategory: any) => {
                      const subCategoryDocs = documents.filter((d: any) => d.subcategoryId === subcategory.id);

                      return (
                        <div
                          key={subcategory.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            selectedSubcategory === subcategory.id
                              ? "bg-purple-500 text-white shadow-md"
                              : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                          }`}
                          onClick={() => setSelectedSubcategory(subcategory.id)}
                        >
                          <div className={`w-8 h-8 bg-${subcategory.color}-400 rounded-lg flex items-center justify-center flex-shrink-0`}>
                            {getCategoryIcon(subcategory.icon || "Folder")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{subcategory.name}</div>
                            <div className={`text-xs ${selectedSubcategory === subcategory.id ? "text-purple-100" : "text-gray-500"}`}>
                              {subCategoryDocs.length} lezioni
                            </div>
                          </div>
                          {selectedSubcategory === subcategory.id && (
                            <ChevronRight size={16} />
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Level Filter */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">📊 Livello</h4>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900 hover:bg-white focus:bg-white">
                      <SelectValue placeholder="Tutti i livelli" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i livelli</SelectItem>
                      <SelectItem value="base">🟢 Base</SelectItem>
                      <SelectItem value="intermedio">🟡 Intermedio</SelectItem>
                      <SelectItem value="avanzato">🔴 Avanzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Content Area - Lessons */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedCategory !== "all" && (
                      <>
                        <span className="text-lg font-semibold text-blue-600">
                          {categories.find((c: any) => c.id === selectedCategory)?.name}
                        </span>
                        {selectedSubcategory !== "all" && (
                          <>
                            <ChevronRight size={16} className="text-gray-400" />
                            <span className="text-lg font-semibold text-purple-600">
                              {subcategories.find((sc: any) => sc.id === selectedSubcategory)?.name}
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {selectedCategory === "all" && (
                      <span className="text-lg font-semibold text-gray-900">Tutte le Lezioni</span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {filteredDocuments.length} lezioni disponibili
                  </p>
                </div>
              </div>

              {/* Lessons Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {filteredDocuments.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <BookOpen size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna lezione trovata</h3>
                    <p className="text-gray-600 text-center">
                      {searchTerm || selectedCategory !== "all" || selectedSubcategory !== "all" || selectedLevel !== "all"
                        ? "Prova a modificare i filtri di ricerca."
                        : "Non ci sono ancora lezioni disponibili in questa sezione."}
                    </p>
                  </div>
                ) : (
                  filteredDocuments.map((document: any) => {
                    const category = categories.find((c: any) => c.id === document.categoryId);
                    const subcategory = subcategories.find((sc: any) => sc.id === document.subcategoryId);
                    const isRead = isDocumentRead(document.id);

                    return (
                      <Card
                        key={document.id}
                        className="bg-white border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden"
                        onClick={() => handleViewDocument(document)}
                      >
                        {/* Video Thumbnail Area */}
                        <div className="relative h-40 bg-gradient-to-br from-purple-600 to-blue-700 flex items-center justify-center">
                          {/* Play Button */}
                          <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-black/70 transition-all">
                            <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1"></div>
                          </div>

                          {/* Duration Badge */}
                          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {document.estimatedDuration || 5}min
                          </div>

                          {/* Level Badge */}
                          <div className="absolute top-3 left-3">
                            <Badge className={`${getLevelBadgeColor(document.level)} text-xs`}>
                              {document.level}
                            </Badge>
                          </div>

                          {/* Completed Check */}
                          {isRead && (
                            <div className="absolute bottom-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle size={16} className="text-white" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <CardContent className="p-4">
                          {/* Course/Category Path */}
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <span>{category?.name}</span>
                            {subcategory && (
                              <>
                                <ChevronRight size={10} />
                                <span>{subcategory.name}</span>
                              </>
                            )}
                          </div>

                          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                            {document.title ? String(document.title) : 'Senza titolo'}
                          </h3>

                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {document.description ? String(document.description) : 'Descrizione non disponibile'}
                          </p>

                          {/* Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isRead ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                              <span className={`text-xs font-medium ${isRead ? 'text-green-600' : 'text-purple-600'}`}>
                                {isRead ? 'Completata' : 'Disponibile'}
                              </span>
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock size={12} className="mr-1" />
                              {document.estimatedDuration || 5}min
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={toggleSidebar}
        className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 focus:outline-none z-10"
        style={{ marginLeft: isOpen ? '320px' : '0px' }} // Adjust margin based on new sidebar width
      >
        {isOpen ? (
          <MdOutlineKeyboardArrowRight className="w-6 h-6" />
        ) : (
          <MdOutlineKeyboardArrowRight className="w-6 h-6" />
        )}
      </button>
    </div>
  );
};

// Dummy Input component for illustration
const Input = ({ className, ...props }) => (
  <input className={`p-2 border rounded-md ${className}`} {...props} />
);

export default Sidebar;