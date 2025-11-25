import { formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface WhatsAppMessageBubbleProps {
  message: {
    id: string;
    text: string;
    sender: "client" | "consultant" | "ai" | "system";
    direction: "inbound" | "outbound";
    mediaType?: string;
    mediaUrl?: string | null;
    createdAt: Date;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    metadata?: {
      simulated?: boolean;
      isDryRun?: boolean;
      templateSid?: string;
      templateVariables?: Record<string, string>;
      messageType?: string;
      isError?: boolean;
      errorType?: string;
      templateBody?: string;
      [key: string]: any;
    } | null;
  };
}

export function WhatsAppMessageBubble({ message }: WhatsAppMessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isSimulated = message.metadata?.simulated === true;
  const isDryRun = message.metadata?.isDryRun === true;
  const isError = message.sender === "system" && message.metadata?.isError === true;

  // Extract readable text from template messages
  const getDisplayText = () => {
    // Show error messages as-is (already formatted)
    if (isError) {
      return message.text;
    }

    // Handle template messages: "TEMPLATE:HXb1e..." → show template body if available
    if (message.text.startsWith("TEMPLATE:")) {
      const templateBody = message.metadata?.templateBody;

      if (templateBody) {
        // Template body available: show formatted content
        return templateBody;
      } else {
        // Template body not available: show generic message
        const templateSid = message.text.replace("TEMPLATE:", "").trim();
        return `📋 Messaggio template inviato\n\n(Template ID: ${templateSid})`;
      }
    }

    // Regular message: show as-is
    return message.text;
  };

  const getBubbleStyles = () => {
    // Error messages: red/warning style
    if (isError) {
      return "bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-gray-900 dark:text-gray-100 shadow-sm";
    }

    if (isSimulated || isDryRun) {
      return "bg-orange-50 dark:bg-orange-800/40 border border-dashed border-orange-400 text-gray-900 dark:text-gray-100 shadow-sm";
    }

    if (message.sender === "client") {
      // ✅ Messaggi cliente a destra - stile WhatsApp verde
      return "bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-gray-100 shadow-sm";
    }

    if (message.sender === "ai") {
      // ✅ Messaggi AI a sinistra - stile WhatsApp bianco
      return "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-200 dark:border-gray-700";
    }

    // ✅ Messaggi consulente a destra - stile WhatsApp verde
    return "bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-gray-100 shadow-sm";
  };

  const getMessageStatus = () => {
    if (!isOutbound) return null;

    if (message.readAt) {
      return <span className="text-blue-400">✓✓</span>;
    }

    if (message.deliveredAt) {
      return <span className="opacity-70">✓✓</span>;
    }

    if (message.sentAt) {
      return <span className="opacity-70">✓</span>;
    }

    return null;
  };

  // Determine if message has audio (check for both generic 'audio' and MIME types like 'audio/wav')
  const hasAudio = message.mediaUrl && (message.mediaType === 'audio' || message.mediaType?.startsWith('audio/'));
  const isClientAudio = (message.sender === "client" || message.sender === "consultant") && hasAudio;
  const isAIAudio = message.sender === "ai" && hasAudio;

  return (
    <div
      className={cn(
        "flex w-full transition-all duration-200 animate-fade-in",
        // ✅ Cliente e consulente a destra, AI a sinistra
        (message.sender === "client" || message.sender === "consultant") ? "justify-end" : "justify-start"
      )}
    >
      {/* Questo contenitore imposta il max-w e l'allineamento */}
      <div
        className={cn(
          "flex flex-col max-w-[80%] gap-1.5",
          // ✅ Cliente e consulente a destra, AI a sinistra
          (message.sender === "client" || message.sender === "consultant") ? "items-end" : "items-start"
        )}
      >
        {/* ✅ Bubble con arrotondamento ridotto */}
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-lg",
            // ✅ Cliente e consulente: angolo in alto a destra meno arrotondato, AI: angolo in alto a sinistra meno arrotondato
            (message.sender === "client" || message.sender === "consultant") ? "rounded-tr-sm" : "rounded-tl-sm",
            getBubbleStyles()
          )}
        >
          {isError && (
            <Badge className="mb-1.5 text-xs bg-red-600 text-white hover:bg-red-700">
              ⚠️ Errore Sistema
            </Badge>
          )}

          {(isSimulated || isDryRun) && !isError && (
            <Badge className="mb-1.5 text-xs bg-orange-600 text-white hover:bg-orange-700">
              {isDryRun 
                ? `🧪 DRY RUN${message.metadata?.messageType ? ` - ${message.metadata.messageType}` : ''}`
                : '🧪 Simulato'
              }
            </Badge>
          )}

          {/* Show non-audio media inside bubble */}
          {message.mediaUrl && !hasAudio && (
            <div className="mb-2">
              {message.mediaType?.startsWith("image") ? (
                <img
                  src={message.mediaUrl}
                  alt="Media"
                  className="rounded-lg max-w-full h-auto"
                />
              ) : (
                <div className="flex items-center gap-2 p-2 bg-black/10 dark:bg-white/10 rounded-lg">
                  <span className="text-sm">📄</span>
                  <span className="text-sm truncate">
                    {message.mediaType || "Documento"}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Audio player - shown inside bubble with small label */}
          {hasAudio && (
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs opacity-60">
                  {isAIAudio ? '🎙️ Audio' : '🎤 Audio'}
                </span>
                {message.metadata?.audioDuration && (
                  <span className="text-xs opacity-50">
                    {message.metadata.audioDuration}s
                  </span>
                )}
              </div>
              <audio
                controls
                className="w-full max-w-xs h-9 rounded-lg"
                preload="metadata"
              >
                <source 
                  src={message.mediaUrl} 
                  type={message.mediaType || 'audio/wav'} 
                />
                Il tuo browser non supporta l'elemento audio.
              </audio>
            </div>
          )}

          {/* Testo formattato con markdown sicuro - nascosto se audio-only (no text) */}
          {!(hasAudio && !message.text.trim()) && message.text.trim() && (
            <div className="prose prose-sm max-w-none break-words [&>ol]:list-decimal [&>ol]:ml-4 [&>ul]:list-disc [&>ul]:ml-4 [&>li]:leading-relaxed [&>strong]:font-bold [&>em]:italic [&>p]:mb-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {getDisplayText()}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Questo timestamp si allinea correttamente grazie a 'items-end'/'items-start' del genitore */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] px-1 mt-0.5",
            // ✅ Timestamp adattato al mittente
            (message.sender === "client" || message.sender === "consultant") ? "text-gray-500" : "text-gray-400"
          )}
        >
          <span className="font-normal">
            {(() => {
              // Ensure createdAt is a valid Date object
              const messageDate = message.createdAt instanceof Date
                ? message.createdAt
                : new Date(message.createdAt);

              // Validate the date is valid before formatting
              const isValidDate = !isNaN(messageDate.getTime());

              return isValidDate
                ? formatDistanceToNow(messageDate, {
                    addSuffix: true,
                    locale: it,
                  })
                : 'data non valida';
            })()}
          </span>
          {getMessageStatus()}
        </div>
      </div>
    </div>
  );
}