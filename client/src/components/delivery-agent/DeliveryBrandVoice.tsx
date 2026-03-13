import { useState, useEffect, useCallback, useRef } from "react";
import { BrandVoiceSection, type BrandVoiceData } from "@/components/brand-voice/BrandVoiceSection";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { MarketResearchData } from "@shared/schema";

interface DeliveryBrandVoiceProps {
  sessionId: string;
}

export function DeliveryBrandVoice({ sessionId }: DeliveryBrandVoiceProps) {
  const { toast } = useToast();
  const [data, setData] = useState<BrandVoiceData>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000;

    const fetchBrandVoice = async () => {
      try {
        const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}/brand-voice`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data && Object.keys(result.data).length > 0) {
            setData(result.data);
            setLoading(false);
          } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(fetchBrandVoice, retryDelay);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch session brand voice:", err);
        setLoading(false);
      }
    };
    fetchBrandVoice();
  }, [sessionId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}/brand-voice`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSaveSuccess(true);
        toast({ title: "Brand Voice salvato" });
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        toast({ title: "Errore nel salvataggio", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, data, toast]);

  const fetchSessionMR = useCallback(async (): Promise<MarketResearchData | null> => {
    try {
      const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}/market-research`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        console.error(`[DeliveryBrandVoice] MR fetch failed: ${res.status}`);
        return null;
      }
      const result = await res.json();
      return result.success ? result.data : null;
    } catch (err) {
      console.error("[DeliveryBrandVoice] MR fetch error:", err);
      return null;
    }
  }, [sessionId]);

  const saveSessionMR = useCallback(async (mrData: MarketResearchData): Promise<void> => {
    try {
      const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}/market-research`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ data: mrData }),
      });
      if (!res.ok) {
        console.error(`[DeliveryBrandVoice] MR save failed: ${res.status}`);
        toast({ title: "Errore nel salvataggio ricerca di mercato", variant: "destructive" });
      }
    } catch (err) {
      console.error("[DeliveryBrandVoice] MR save error:", err);
      toast({ title: "Errore nel salvataggio ricerca di mercato", variant: "destructive" });
    }
  }, [sessionId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <BrandVoiceSection
        data={data}
        onDataChange={setData}
        onSave={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        showImportButton={false}
        showImportFromLuca={false}
        showMarketResearch={true}
        showSaveButton={true}
        compact={false}
        autoTriggerDeepResearch={true}
        fetchMarketResearch={fetchSessionMR}
        saveMarketResearch={saveSessionMR}
      />
    </div>
  );
}
