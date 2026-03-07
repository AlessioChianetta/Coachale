import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Target,
  Award,
  Star,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Download,
  Save,
  Loader2,
  Check,
  MessageSquare
} from "lucide-react";

export interface BrandVoiceData {
  consultantDisplayName?: string;
  businessName?: string;
  businessDescription?: string;
  consultantBio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  softwareCreated?: { emoji: string; name: string; description: string }[];
  booksPublished?: { title: string; year: string }[];
  caseStudies?: { client: string; result: string }[];
  servicesOffered?: { name: string; price: string; description: string }[];
  guarantees?: string;
  personalTone?: string;
  contentPersonality?: string;
  audienceLanguage?: string;
  avoidPatterns?: string;
  writingExamples?: string[];
  signaturePhrases?: string[];
}

export interface BrandVoiceSectionProps {
  data: BrandVoiceData;
  onDataChange: (data: BrandVoiceData) => void;
  onSave: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  showImportButton?: boolean;
  onImportClick?: () => void;
  compact?: boolean;
  showSaveButton?: boolean;
}

export function BrandVoiceSection({
  data,
  onDataChange,
  onSave,
  isSaving = false,
  saveSuccess = false,
  showImportButton = true,
  onImportClick,
  compact = false,
  showSaveButton = true
}: BrandVoiceSectionProps) {
  const [businessInfoOpen, setBusinessInfoOpen] = useState(!compact);
  const [authorityOpen, setAuthorityOpen] = useState(!compact);
  const [credentialsOpen, setCredentialsOpen] = useState(!compact);
  const [servicesOpen, setServicesOpen] = useState(!compact);
  const [voiceStyleOpen, setVoiceStyleOpen] = useState(!compact);
  const [valueInput, setValueInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");

  const updateField = <K extends keyof BrandVoiceData>(field: K, value: BrandVoiceData[K]) => {
    onDataChange({ ...data, [field]: value });
  };

  const handleAddValue = () => {
    if (valueInput.trim()) {
      const currentValues = data.values || [];
      updateField("values", [...currentValues, valueInput.trim()]);
      setValueInput("");
    }
  };

  const handleRemoveValue = (index: number) => {
    const currentValues = data.values || [];
    updateField("values", currentValues.filter((_, i) => i !== index));
  };

  const handleAddSoftware = () => {
    const current = data.softwareCreated || [];
    updateField("softwareCreated", [...current, { emoji: "", name: "", description: "" }]);
  };

  const handleUpdateSoftware = (index: number, field: "emoji" | "name" | "description", value: string) => {
    const current = [...(data.softwareCreated || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("softwareCreated", current);
  };

  const handleRemoveSoftware = (index: number) => {
    const current = data.softwareCreated || [];
    updateField("softwareCreated", current.filter((_, i) => i !== index));
  };

  const handleAddBook = () => {
    const current = data.booksPublished || [];
    updateField("booksPublished", [...current, { title: "", year: "" }]);
  };

  const handleUpdateBook = (index: number, field: "title" | "year", value: string) => {
    const current = [...(data.booksPublished || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("booksPublished", current);
  };

  const handleRemoveBook = (index: number) => {
    const current = data.booksPublished || [];
    updateField("booksPublished", current.filter((_, i) => i !== index));
  };

  const handleAddCaseStudy = () => {
    const current = data.caseStudies || [];
    updateField("caseStudies", [...current, { client: "", result: "" }]);
  };

  const handleUpdateCaseStudy = (index: number, field: "client" | "result", value: string) => {
    const current = [...(data.caseStudies || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("caseStudies", current);
  };

  const handleRemoveCaseStudy = (index: number) => {
    const current = data.caseStudies || [];
    updateField("caseStudies", current.filter((_, i) => i !== index));
  };

  const handleAddService = () => {
    const current = data.servicesOffered || [];
    updateField("servicesOffered", [...current, { name: "", price: "", description: "" }]);
  };

  const handleUpdateService = (index: number, field: "name" | "price" | "description", value: string) => {
    const current = [...(data.servicesOffered || [])];
    current[index] = { ...current[index], [field]: value };
    updateField("servicesOffered", current);
  };

  const handleRemoveService = (index: number) => {
    const current = data.servicesOffered || [];
    updateField("servicesOffered", current.filter((_, i) => i !== index));
  };

  const handleAddPhrase = () => {
    if (phraseInput.trim()) {
      const current = data.signaturePhrases || [];
      updateField("signaturePhrases", [...current, phraseInput.trim()]);
      setPhraseInput("");
    }
  };

  const handleRemovePhrase = (index: number) => {
    const current = data.signaturePhrases || [];
    updateField("signaturePhrases", current.filter((_, i) => i !== index));
  };

  const handleAddWritingExample = () => {
    const current = data.writingExamples || [];
    if (current.length < 3) {
      updateField("writingExamples", [...current, ""]);
    }
  };

  const handleUpdateWritingExample = (index: number, value: string) => {
    const current = [...(data.writingExamples || [])];
    current[index] = value;
    updateField("writingExamples", current);
  };

  const handleRemoveWritingExample = (index: number) => {
    const current = data.writingExamples || [];
    updateField("writingExamples", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Brand Voice & Credibilità
          </h2>
          <p className="text-muted-foreground text-sm">
            Definisci l'identità del tuo brand per email personalizzate (tutti i campi sono opzionali)
          </p>
        </div>
        {showImportButton && onImportClick && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onImportClick}
          >
            <Download className="h-4 w-4 mr-2" />
            Importa da Agente
          </Button>
        )}
      </div>

      <Collapsible open={businessInfoOpen} onOpenChange={setBusinessInfoOpen}>
        <Card className="border-2 border-primary/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Informazioni Business</CardTitle>
                </div>
                {businessInfoOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Nome, descrizione e bio del consulente</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-consultantDisplayName">Nome Display Consulente</Label>
                  <Input
                    id="bv-consultantDisplayName"
                    value={data.consultantDisplayName || ""}
                    onChange={(e) => updateField("consultantDisplayName", e.target.value)}
                    placeholder="Es: Marco Rossi"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-businessName">Nome Business</Label>
                  <Input
                    id="bv-businessName"
                    value={data.businessName || ""}
                    onChange={(e) => updateField("businessName", e.target.value)}
                    placeholder="Es: Momentum Coaching"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bv-businessDescription">Descrizione Business</Label>
                <Textarea
                  id="bv-businessDescription"
                  value={data.businessDescription || ""}
                  onChange={(e) => updateField("businessDescription", e.target.value)}
                  placeholder="Breve descrizione di cosa fa il tuo business..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="bv-consultantBio">Bio Consulente</Label>
                <Textarea
                  id="bv-consultantBio"
                  value={data.consultantBio || ""}
                  onChange={(e) => updateField("consultantBio", e.target.value)}
                  placeholder="Bio personale del consulente..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={authorityOpen} onOpenChange={setAuthorityOpen}>
        <Card className="border-2 border-blue-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 cursor-pointer hover:from-blue-500/10 hover:to-blue-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <CardTitle>Authority & Posizionamento</CardTitle>
                </div>
                {authorityOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Vision, mission, valori e USP</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="bv-vision">Vision</Label>
                <Textarea
                  id="bv-vision"
                  value={data.vision || ""}
                  onChange={(e) => updateField("vision", e.target.value)}
                  placeholder="La tua vision per il futuro..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="bv-mission">Mission</Label>
                <Textarea
                  id="bv-mission"
                  value={data.mission || ""}
                  onChange={(e) => updateField("mission", e.target.value)}
                  placeholder="La tua mission..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Valori</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      placeholder="Aggiungi un valore..."
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddValue())}
                    />
                    <Button type="button" onClick={handleAddValue} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(data.values || []).map((value: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {value}
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="bv-usp">Unique Selling Proposition (USP)</Label>
                <Textarea
                  id="bv-usp"
                  value={data.usp || ""}
                  onChange={(e) => updateField("usp", e.target.value)}
                  placeholder="Cosa ti rende unico rispetto ai competitor..."
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-whoWeHelp">Chi Aiutiamo</Label>
                  <Textarea
                    id="bv-whoWeHelp"
                    value={data.whoWeHelp || ""}
                    onChange={(e) => updateField("whoWeHelp", e.target.value)}
                    placeholder="Il tuo cliente ideale..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-whoWeDontHelp">Chi NON Aiutiamo</Label>
                  <Textarea
                    id="bv-whoWeDontHelp"
                    value={data.whoWeDontHelp || ""}
                    onChange={(e) => updateField("whoWeDontHelp", e.target.value)}
                    placeholder="Clienti non target..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bv-whatWeDo">Cosa Facciamo</Label>
                  <Textarea
                    id="bv-whatWeDo"
                    value={data.whatWeDo || ""}
                    onChange={(e) => updateField("whatWeDo", e.target.value)}
                    placeholder="I servizi che offri..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-howWeDoIt">Come Lo Facciamo</Label>
                  <Textarea
                    id="bv-howWeDoIt"
                    value={data.howWeDoIt || ""}
                    onChange={(e) => updateField("howWeDoIt", e.target.value)}
                    placeholder="Il tuo metodo/processo..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <Card className="border-2 border-green-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10 cursor-pointer hover:from-green-500/10 hover:to-green-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-500" />
                  <CardTitle>Credenziali & Risultati</CardTitle>
                </div>
                {credentialsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Esperienza, software, libri e case studies</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bv-yearsExperience">Anni di Esperienza</Label>
                  <Input
                    id="bv-yearsExperience"
                    type="number"
                    min="0"
                    value={data.yearsExperience || ""}
                    onChange={(e) => updateField("yearsExperience", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-clientsHelped">Clienti Aiutati</Label>
                  <Input
                    id="bv-clientsHelped"
                    type="number"
                    min="0"
                    value={data.clientsHelped || ""}
                    onChange={(e) => updateField("clientsHelped", parseInt(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bv-resultsGenerated">Risultati Generati</Label>
                  <Input
                    id="bv-resultsGenerated"
                    value={data.resultsGenerated || ""}
                    onChange={(e) => updateField("resultsGenerated", e.target.value)}
                    placeholder="Es: €10M+ fatturato"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Software Creati</Label>
                  <Button type="button" onClick={handleAddSoftware} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.softwareCreated || []).map((software, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={software.emoji}
                        onChange={(e) => handleUpdateSoftware(index, "emoji", e.target.value)}
                        placeholder="📱"
                        className="w-16 text-center"
                      />
                      <Input
                        value={software.name}
                        onChange={(e) => handleUpdateSoftware(index, "name", e.target.value)}
                        placeholder="Nome software"
                        className="flex-1"
                      />
                      <Input
                        value={software.description}
                        onChange={(e) => handleUpdateSoftware(index, "description", e.target.value)}
                        placeholder="Breve descrizione"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSoftware(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Libri Pubblicati</Label>
                  <Button type="button" onClick={handleAddBook} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.booksPublished || []).map((book, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={book.title}
                        onChange={(e) => handleUpdateBook(index, "title", e.target.value)}
                        placeholder="Titolo libro"
                        className="flex-1"
                      />
                      <Input
                        value={book.year}
                        onChange={(e) => handleUpdateBook(index, "year", e.target.value)}
                        placeholder="Anno"
                        className="w-24"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveBook(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Case Studies</Label>
                  <Button type="button" onClick={handleAddCaseStudy} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.caseStudies || []).map((caseStudy, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={caseStudy.client}
                        onChange={(e) => handleUpdateCaseStudy(index, "client", e.target.value)}
                        placeholder="Nome cliente"
                        className="flex-1"
                      />
                      <Input
                        value={caseStudy.result}
                        onChange={(e) => handleUpdateCaseStudy(index, "result", e.target.value)}
                        placeholder="Risultato ottenuto"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCaseStudy(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 cursor-pointer hover:from-purple-500/10 hover:to-purple-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-500" />
                  <CardTitle>Servizi & Garanzie</CardTitle>
                </div>
                {servicesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Offerta servizi e garanzie</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Servizi Offerti</Label>
                  <Button type="button" onClick={handleAddService} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
                </div>
                <div className="space-y-3">
                  {(data.servicesOffered || []).map((service, index: number) => (
                    <div key={index} className="flex gap-2 p-3 border rounded-lg bg-card">
                      <Input
                        value={service.name}
                        onChange={(e) => handleUpdateService(index, "name", e.target.value)}
                        placeholder="Nome servizio"
                        className="flex-1"
                      />
                      <Input
                        value={service.price}
                        onChange={(e) => handleUpdateService(index, "price", e.target.value)}
                        placeholder="Prezzo"
                        className="w-32"
                      />
                      <Input
                        value={service.description}
                        onChange={(e) => handleUpdateService(index, "description", e.target.value)}
                        placeholder="Descrizione"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveService(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="bv-guarantees">Garanzie</Label>
                <Textarea
                  id="bv-guarantees"
                  value={data.guarantees || ""}
                  onChange={(e) => updateField("guarantees", e.target.value)}
                  placeholder="Le garanzie che offri ai tuoi clienti..."
                  rows={3}
                  className="mt-2"
                />
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={voiceStyleOpen} onOpenChange={setVoiceStyleOpen}>
        <Card className="border-2 border-indigo-500/20 shadow-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="bg-gradient-to-r from-indigo-500/5 to-indigo-500/10 cursor-pointer hover:from-indigo-500/10 hover:to-indigo-500/15 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-500" />
                  <CardTitle>Voce & Stile Personale</CardTitle>
                </div>
                {voiceStyleOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
              <CardDescription className="text-left">Come comunichi e come vuoi che l'AI scriva per te</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6 space-y-6">
              <div>
                <Label htmlFor="bv-personalTone">Tono Personale</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Descrivi come comunichi — il tuo stile naturale di scrittura</p>
                <Textarea
                  id="bv-personalTone"
                  value={data.personalTone || ""}
                  onChange={(e) => updateField("personalTone", e.target.value)}
                  placeholder="Es: Diretto e provocatorio, uso spesso l'ironia. Parlo come un coach da spogliatoio, non come un professore. Le mie frasi sono corte e vanno dritte al punto."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-contentPersonality">Personalità del Contenuto</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Che emozione vuoi trasmettere a chi legge?</p>
                <Textarea
                  id="bv-contentPersonality"
                  value={data.contentPersonality || ""}
                  onChange={(e) => updateField("contentPersonality", e.target.value)}
                  placeholder="Es: Voglio che chi legge si senta capito e un po' provocato, mai giudicato. Come parlare con un amico sincero che ti dice le cose in faccia."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-audienceLanguage">Linguaggio del Target</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Come parla il tuo pubblico? Che livello di formalità, slang o termini tecnici usano?</p>
                <Textarea
                  id="bv-audienceLanguage"
                  value={data.audienceLanguage || ""}
                  onChange={(e) => updateField("audienceLanguage", e.target.value)}
                  placeholder="Es: Il mio target sono personal trainer, parlano informale, usano termini tecnici come 'periodizzazione', 'volume', 'deload'. Sono pratici, vogliono soluzioni concrete."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="bv-avoidPatterns">Cosa NON Fare Mai</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Anti-pattern espliciti — cose che l'AI non deve MAI fare nei tuoi contenuti</p>
                <Textarea
                  id="bv-avoidPatterns"
                  value={data.avoidPatterns || ""}
                  onChange={(e) => updateField("avoidPatterns", e.target.value)}
                  placeholder="Es: Mai iniziare con 'In un mondo dove...', mai usare elenchi puntati generici, evitare il tono motivazionale americano, non usare 'game changer' o 'mindset shift'"
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Esempi di Scrittura Reale</Label>
                    <p className="text-xs text-muted-foreground mt-1">Incolla 1-3 post o testi che hai scritto tu. L'AI analizzerà il tuo stile per replicarlo.</p>
                  </div>
                  {(data.writingExamples || []).length < 3 && (
                    <Button type="button" onClick={handleAddWritingExample} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Aggiungi
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {(data.writingExamples || []).map((example, index: number) => (
                    <div key={index} className="relative">
                      <Textarea
                        value={example}
                        onChange={(e) => handleUpdateWritingExample(index, e.target.value)}
                        placeholder={`Esempio ${index + 1}: incolla qui un tuo post, caption o testo reale...`}
                        rows={4}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handleRemoveWritingExample(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Frasi Firma</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">Espressioni, modi di dire o catchphrase che usi sempre</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={phraseInput}
                      onChange={(e) => setPhraseInput(e.target.value)}
                      placeholder="Es: Il punto è questo:, Sveglia!, Non è magia, è metodo"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPhrase())}
                    />
                    <Button type="button" onClick={handleAddPhrase} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(data.signaturePhrases || []).map((phrase: string, index: number) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {phrase}
                        <button
                          type="button"
                          onClick={() => handleRemovePhrase(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {showSaveButton && (
                <Button 
                  onClick={onSave}
                  disabled={isSaving}
                  className={`w-full transition-all duration-300 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saveSuccess ? 'Salvato!' : 'Salva Brand Voice'}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export default BrandVoiceSection;
