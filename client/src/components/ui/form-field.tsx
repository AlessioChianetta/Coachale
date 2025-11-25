import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "password" | "number" | "email" | "tel";
  required?: boolean;
  error?: string;
  placeholder?: string;
  helpText?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

export function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  error,
  placeholder,
  helpText,
  multiline = false,
  rows = 3,
  disabled = false,
}: FormFieldProps) {
  const hasError = !!error;

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {multiline ? (
        <Textarea
          id={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            hasError && "border-destructive focus-visible:ring-destructive"
          )}
        />
      ) : (
        <Input
          id={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            hasError && "border-destructive focus-visible:ring-destructive"
          )}
        />
      )}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
