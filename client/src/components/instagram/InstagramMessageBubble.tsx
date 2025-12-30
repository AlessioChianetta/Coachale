import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Bot, User, Heart, MessageCircle, Image } from "lucide-react";

interface InstagramMessageBubbleProps {
  message: {
    id: string;
    text: string | null;
    direction: "inbound" | "outbound";
    sender: "user" | "ai" | "consultant";
    messageType: "text" | "image" | "story_reply" | "story_mention";
    mediaUrl?: string | null;
    storyUrl?: string | null;
    createdAt: Date | string;
  };
}

export function InstagramMessageBubble({ message }: InstagramMessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isAI = message.sender === "ai";
  
  return (
    <div className={cn("flex gap-2 mb-1", isOutbound ? "justify-end" : "justify-start")}>
      {/* Avatar per messaggi in entrata */}
      {!isOutbound && (
        <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 self-end mb-1">
          <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </div>
      )}
      
      <div className="max-w-[65%] flex flex-col">
        {/* Indicatore story reply/mention */}
        {message.messageType === "story_reply" && (
          <div className="text-[10px] text-zinc-400 mb-1 flex items-center gap-1 px-1">
            <Heart className="h-3 w-3 fill-pink-500 text-pink-500" />
            <span>Ha risposto alla tua storia</span>
          </div>
        )}
        
        {message.messageType === "story_mention" && (
          <div className="text-[10px] text-zinc-400 mb-1 flex items-center gap-1 px-1">
            <MessageCircle className="h-3 w-3" />
            <span>Ti ha menzionato in una storia</span>
          </div>
        )}

        {/* Story preview se presente */}
        {(message.messageType === "story_reply" || message.messageType === "story_mention") && message.storyUrl && (
          <div className="mb-1 rounded-lg overflow-hidden max-w-[120px]">
            <img 
              src={message.storyUrl} 
              alt="Story" 
              className="w-full h-auto object-cover opacity-60"
            />
          </div>
        )}
        
        {/* Bolla messaggio */}
        <div className={cn(
          "rounded-3xl px-4 py-2.5 relative",
          isOutbound 
            ? isAI 
              ? "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white" 
              : "bg-[#3797f0] text-white"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
        )}>
          {/* Immagine se presente */}
          {message.messageType === "image" && message.mediaUrl && (
            <div className="mb-2 -mx-2 -mt-1">
              <img 
                src={message.mediaUrl} 
                alt="Image" 
                className="rounded-2xl max-w-full"
              />
            </div>
          )}
          
          {/* Testo messaggio */}
          {message.text ? (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{message.text}</p>
          ) : message.messageType === "image" ? null : (
            <p className="text-[15px] text-zinc-400 italic">Messaggio vuoto</p>
          )}
        </div>

        {/* Timestamp e badge AI */}
        <div className={cn(
          "flex items-center gap-1.5 mt-0.5 px-1",
          isOutbound ? "justify-end" : "justify-start"
        )}>
          <span className="text-[10px] text-zinc-400">
            {format(new Date(message.createdAt), "HH:mm", { locale: it })}
          </span>
          {isAI && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium">
              AI
            </span>
          )}
        </div>
      </div>
      
      {/* Avatar per messaggi in uscita (solo per consulente, non AI) */}
      {isOutbound && !isAI && (
        <div className="w-7 h-7 rounded-full bg-[#3797f0] flex items-center justify-center flex-shrink-0 self-end mb-1">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
      
      {/* Avatar per messaggi AI */}
      {isOutbound && isAI && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0 self-end mb-1">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
