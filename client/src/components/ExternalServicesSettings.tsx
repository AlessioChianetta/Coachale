import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, Save, CheckCircle2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { setAuthUser, getAuthUser } from "@/lib/auth";

interface SiteUrlResponse {
  siteUrl: string;
}

export default function ExternalServicesSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [siteUrl, setSiteUrl] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery<SiteUrlResponse>({
    queryKey: ["/api/finance-settings/site-url"],
    queryFn: () => apiRequest("GET", "/api/finance-settings/site-url"),
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setSiteUrl(data.siteUrl || "");
      setHasChanges(false);
    }
  }, [data]);

  useEffect(() => {
    if (data) {
      setHasChanges(siteUrl !== (data.siteUrl || ""));
    } else {
      setHasChanges(siteUrl.trim() !== "");
    }
  }, [siteUrl, data]);

  const saveMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("POST", "/api/finance-settings/site-url", { siteUrl: url });
    },
    onSuccess: (response: any) => {
      queryClient.setQueryData(["/api/finance-settings/site-url"], { siteUrl: response.siteUrl || "" });
      setHasChanges(false);
      
      const currentUser = getAuthUser();
      if (currentUser) {
        setAuthUser({ ...currentUser, siteUrl: response.siteUrl || null });
      }
      
      toast({
        title: "Salvato",
        description: "URL del sito aggiornato con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare l'URL. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (siteUrl.trim() && !siteUrl.startsWith("http://") && !siteUrl.startsWith("https://")) {
      toast({
        title: "URL non valido",
        description: "L'URL deve iniziare con http:// o https://",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(siteUrl.trim());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 overflow-hidden mt-6">
      <CardHeader className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950 dark:via-amber-950 dark:to-yellow-950">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-md">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              SiteAle - Il Tuo Sito
            </CardTitle>
            <CardDescription className="mt-1">
              Configura l'URL del tuo sito personale per accesso rapido dalla sidebar
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="siteUrl" className="text-sm font-semibold">
              URL del Sito
            </Label>
            <Input
              id="siteUrl"
              type="url"
              placeholder="https://il-tuo-sito.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Una volta configurato, comparirà nella sezione "Servizi Esterni" della sidebar
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!hasChanges || saveMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva URL
                </>
              )}
            </Button>

            {data?.siteUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(data.siteUrl, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Apri Sito
              </Button>
            )}
          </div>
        </form>

        {data?.siteUrl && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Sito configurato: {data.siteUrl}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
