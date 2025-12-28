import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Bot, User, Heart, MessageCircle } from "lucide-react";

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
    <div className={cn("flex gap-2 mb-3", isOutbound ? "justify-end" : "justify-start")}>
      {!isOutbound && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
        isOutbound 
          ? isAI 
            ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white" 
            : "bg-slate-700 text-white"
          : "bg-white border border-slate-200"
      )}>
        {message.messageType === "story_reply" && message.storyUrl && (
          <div className="text-xs opacity-75 mb-1 flex items-center gap-1">
            <Heart className="h-3 w-3" />
            Risposta alla storia
          </div>
        )}
        
        {message.messageType === "story_mention" && (
          <div className="text-xs opacity-75 mb-1 flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            Ti ha menzionato in una storia
          </div>
        )}
        
        {message.messageType === "image" && message.mediaUrl && (
          <img 
            src={message.mediaUrl} 
            alt="Image" 
            className="rounded-lg max-w-full mb-2"
          />
        )}
        
        {message.text && (
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        )}
        
        <div className={cn(
          "text-xs mt-1",
          isOutbound ? "text-white/70" : "text-slate-400"
        )}>
          {format(new Date(message.createdAt), "HH:mm", { locale: it })}
          {isAI && " · AI"}
        </div>
      </div>
      
      {isOutbound && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isAI ? "bg-gradient-to-br from-cyan-500 to-teal-500" : "bg-slate-600"
        )}>
          {isAI ? <Bot className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-white" />}
        </div>
      )}
    </div>
  );
}
