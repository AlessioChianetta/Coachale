import { Button } from "@/components/ui/button";
import { Github, Plus, Loader2, Users } from "lucide-react";

interface ImportButtonsProps {
  onImportOfficial: () => void;
  onImportCommunity: () => void;
  onCreateCustom: () => void;
  isImportingOfficial?: boolean;
  isImportingCommunity?: boolean;
}

export function ImportButtons({
  onImportOfficial,
  onImportCommunity,
  onCreateCustom,
  isImportingOfficial,
  isImportingCommunity,
}: ImportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onImportOfficial}
        disabled={isImportingOfficial}
        className="gap-1.5"
      >
        {isImportingOfficial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
        Importa Official
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onImportCommunity}
        disabled={isImportingCommunity}
        className="gap-1.5"
      >
        {isImportingCommunity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
        Importa Community
      </Button>
      <Button
        size="sm"
        onClick={onCreateCustom}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Crea Skill Custom
      </Button>
    </div>
  );
}
