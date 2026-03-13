import { useState, useEffect, useCallback, useRef } from "react";
import { BrandVoiceSection, type BrandVoiceData } from "@/components/brand-voice/BrandVoiceSection";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
    const fetchBrandVoice = async () => {
      try {
        const res = await fetch(`/api/consultant/delivery-agent/sessions/${sessionId}/brand-voice`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data && Object.keys(result.data).length > 0) {
            setData(result.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session brand voice:", err);
      } finally {
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
        showMarketResearch={false}
        showSaveButton={true}
        compact={false}
      />
    </div>
  );
}
