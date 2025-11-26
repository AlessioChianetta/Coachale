import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Briefcase, TrendingUp, BrainCircuit } from "lucide-react";
import { ConsultantType } from "./AIAssistant";

interface ConsultantTypePickerProps {
  consultantType: ConsultantType;
  setConsultantType: (type: ConsultantType) => void;
}

export function ConsultantTypePicker({ consultantType, setConsultantType }: ConsultantTypePickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
        <BrainCircuit className="h-3.5 w-3.5" />
        Tipo di Consulente
      </label>
      <Select value={consultantType} onValueChange={(value) => setConsultantType(value as ConsultantType)}>
        <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 h-10 rounded-lg transition-all">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="finanziario" className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20">
            <div className="flex items-center gap-2 py-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-medium text-sm">Consulente Finanziario</span>
            </div>
          </SelectItem>
          <SelectItem value="business" className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20">
            <div className="flex items-center gap-2 py-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Briefcase className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-medium text-sm">Consulente Business</span>
            </div>
          </SelectItem>
          <SelectItem value="vendita" className="cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20">
            <div className="flex items-center gap-2 py-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-medium text-sm">Consulente Vendita</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
