import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, File, Image, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  maxSize?: number; // in bytes
  className?: string;
}

interface FileWithPreview extends File {
  preview?: string;
}

export default function FileUpload({
  onFilesChange,
  maxFiles = 5,
  acceptedFileTypes = [
    "image/*", 
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
    "text/plain", 
    "application/rtf", 
    "application/vnd.oasis.opendocument.text", 
    "application/vnd.ms-excel", 
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
    "application/vnd.ms-powerpoint", 
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", 
    "video/mp4", 
    "video/quicktime", 
    "video/x-msvideo", 
    "video/x-matroska", 
    "video/webm", 
    "audio/mpeg", 
    "audio/wav"
  ],
  maxSize = 50 * 1024 * 1024, // 50MB
  className,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })
    );

    const updatedFiles = [...files, ...newFiles].slice(0, maxFiles);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, maxFiles, onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    maxFiles: maxFiles - files.length,
  });

  const removeFile = (fileToRemove: FileWithPreview) => {
    const updatedFiles = files.filter((file) => file !== fileToRemove);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);

    // Clean up preview URL
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image size={20} />;
    if (file.type === "application/pdf") return <FileText size={20} />;
    if (["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/rtf", "application/vnd.oasis.opendocument.text", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm", "audio/mpeg", "audio/wav"].includes(file.type)) {
      return <FileText size={20} />;
    }
    return <File size={20} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)} data-testid="file-upload">
      {/* Upload Area */}
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed cursor-pointer transition-colors p-6",
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-primary/50",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
        data-testid="drop-zone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragActive ? "Rilascia i file qui..." : "Trascina i file qui"}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            o clicca per selezionare ({maxFiles - files.length} file rimanenti)
          </p>
          <p className="text-xs text-muted-foreground">
            Supportati: immagini (jpg, png, gif), documenti (pdf, doc, docx, txt, rtf), fogli di calcolo (xls, xlsx), presentazioni (ppt, pptx), video (mp4, mov, avi), audio (mp3, wav) - max 50MB
          </p>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2" data-testid="file-list">
          <h4 className="text-sm font-medium text-foreground">File caricati:</h4>
          {files.map((file, index) => (
            <Card key={index} className="p-3" data-testid={`file-item-${index}`}>
              <div className="flex items-center space-x-3">
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-10 h-10 rounded object-cover"
                    data-testid={`file-preview-${index}`}
                  />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" data-testid={`file-name-${index}`}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`file-size-${index}`}>
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  data-testid={`button-remove-file-${index}`}
                >
                  <X size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}