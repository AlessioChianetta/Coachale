import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Question {
  id: string;
  text: string;
  options: { label: string; value: string }[];
  zoneToHighlight?: string;
}

interface Message {
  id: string;
  type: "ai" | "user";
  content: string;
  isTyping?: boolean;
}

interface ChatNarrativaProps {
  onResponse: (questionId: string, answer: string) => void;
  onComplete: (responses: Record<string, string>) => void;
  highlightZone?: (zoneId: string) => void;
}

const introMessages: string[] = [
  "Ciao! 👋 Benvenuto nella tua nuova piattaforma di gestione.",
  "Sono qui per guidarti in un breve percorso di scoperta. Raccontami un po' di te, così posso personalizzare la tua esperienza.",
];

const questions: Question[] = [
  {
    id: "activity_type",
    text: "Che tipo di attività hai?",
    options: [
      { label: "🎯 Coaching", value: "coaching" },
      { label: "💼 Consulenza", value: "consulenza" },
      { label: "📚 Formazione", value: "formazione" },
      { label: "✨ Altro", value: "altro" },
    ],
    zoneToHighlight: "principale",
  },
  {
    id: "platform_reason",
    text: "Perché hai deciso di usare questa piattaforma?",
    options: [
      { label: "📈 Scalare il business", value: "scalare" },
      { label: "⏰ Risparmiare tempo", value: "tempo" },
      { label: "🤖 Automatizzare i processi", value: "automazione" },
      { label: "👥 Gestire meglio i clienti", value: "clienti" },
    ],
    zoneToHighlight: "lavoro-quotidiano",
  },
  {
    id: "client_count",
    text: "Quanti clienti gestisci attualmente?",
    options: [
      { label: "1-5 clienti", value: "1-5" },
      { label: "6-15 clienti", value: "6-15" },
      { label: "16-50 clienti", value: "16-50" },
      { label: "50+ clienti", value: "50+" },
    ],
    zoneToHighlight: "comunicazione",
  },
  {
    id: "priorities",
    text: "Quali sono le tue priorità principali?",
    options: [
      { label: "📱 Comunicazione WhatsApp", value: "whatsapp" },
      { label: "📅 Gestione appuntamenti", value: "calendario" },
      { label: "🎓 Formazione clienti", value: "formazione" },
      { label: "📊 Analytics e report", value: "analytics" },
    ],
    zoneToHighlight: "guide",
  },
];

const getZoneSuggestions = (responses: Record<string, string>): string[] => {
  const zones: string[] = [];
  
  if (responses.priorities === "whatsapp") {
    zones.push("comunicazione");
  }
  if (responses.priorities === "calendario") {
    zones.push("lavoro-quotidiano");
  }
  if (responses.priorities === "formazione") {
    zones.push("formazione");
  }
  if (responses.platform_reason === "automazione") {
    zones.push("comunicazione");
  }
  if (responses.client_count === "50+" || responses.client_count === "16-50") {
    zones.push("ai-avanzato");
  }
  
  zones.push("principale");
  
  return [...new Set(zones)];
};

const getSummaryMessage = (responses: Record<string, string>): string => {
  const activityMap: Record<string, string> = {
    coaching: "coach",
    consulenza: "consulente",
    formazione: "formatore",
    altro: "professionista",
  };
  
  const activity = activityMap[responses.activity_type] || "professionista";
  const clientRange = responses.client_count || "alcuni";
  
  let message = `Perfetto! Ora ho un quadro più chiaro. 🎯\n\n`;
  message += `Sei un ${activity} che gestisce ${clientRange === "50+" ? "oltre 50" : clientRange} clienti. `;
  
  if (responses.platform_reason === "scalare") {
    message += `Il tuo obiettivo è scalare il business, e questa piattaforma è progettata esattamente per questo!\n\n`;
  } else if (responses.platform_reason === "tempo") {
    message += `Vuoi risparmiare tempo prezioso automatizzando le attività ripetitive.\n\n`;
  } else if (responses.platform_reason === "automazione") {
    message += `Vuoi automatizzare i processi per lavorare in modo più smart.\n\n`;
  } else {
    message += `Il tuo focus è sulla gestione efficace dei clienti.\n\n`;
  }
  
  message += `Ti consiglio di esplorare le zone evidenziate nella mappa. Inizia da lì per configurare la tua piattaforma! ✨`;
  
  return message;
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAI = message.type === "ai";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex items-end gap-2 ${isAI ? "justify-start" : "justify-end"}`}
    >
      {isAI && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
          className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg"
        >
          <Bot className="w-4 h-4 text-white" />
        </motion.div>
      )}

      <div
        className={`
          max-w-[80%] px-4 py-3 rounded-2xl shadow-sm
          ${isAI
            ? "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-md"
            : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-br-md"
          }
        `}
      >
        {message.isTyping ? (
          <TypingIndicator />
        ) : (
          <p className="text-sm whitespace-pre-line leading-relaxed">
            {message.content}
          </p>
        )}
      </div>

      {!isAI && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
          className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center shadow-lg"
        >
          <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </motion.div>
      )}
    </motion.div>
  );
}

function OptionButtons({
  options,
  onSelect,
  disabled,
}: {
  options: { label: string; value: string }[];
  onSelect: (value: string, label: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex flex-wrap gap-2 mt-3 ml-10"
    >
      {options.map((option, index) => (
        <motion.div
          key={option.value}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + index * 0.1 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(option.value, option.label)}
            disabled={disabled}
            className="
              bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
              border-violet-200 dark:border-violet-800
              hover:bg-violet-50 dark:hover:bg-violet-950/50
              hover:border-violet-400 dark:hover:border-violet-600
              hover:scale-105 hover:shadow-md
              transition-all duration-200
              text-sm font-medium
            "
          >
            {option.label}
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
}

function ZoneSuggestion({ zones }: { zones: string[] }) {
  const zoneNames: Record<string, string> = {
    principale: "Principale",
    "lavoro-quotidiano": "Lavoro Quotidiano",
    comunicazione: "Comunicazione",
    formazione: "Formazione",
    "base-conoscenza": "Base di Conoscenza",
    impostazioni: "Impostazioni",
    guide: "Guide",
    "ai-avanzato": "AI Avanzato",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-4 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl border border-violet-200 dark:border-violet-800"
    >
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-semibold text-violet-900 dark:text-violet-100">
          Zone consigliate da esplorare:
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {zones.map((zone) => (
          <motion.span
            key={zone}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="
              inline-flex items-center gap-1 px-3 py-1.5
              bg-white dark:bg-gray-800 rounded-full
              text-xs font-medium text-violet-700 dark:text-violet-300
              border border-violet-200 dark:border-violet-700
              shadow-sm
            "
          >
            <Sparkles className="w-3 h-3" />
            {zoneNames[zone] || zone}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

export default function ChatNarrativa({
  onResponse,
  onComplete,
  highlightZone,
}: ChatNarrativaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [suggestedZones, setSuggestedZones] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = (content: string, type: "ai" | "user") => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const simulateTyping = async (content: string, type: "ai" | "user") => {
    if (type === "ai") {
      setIsTyping(true);
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));
      setIsTyping(false);
    }
    addMessage(content, type);
  };

  useEffect(() => {
    const startChat = async () => {
      for (const intro of introMessages) {
        await simulateTyping(intro, "ai");
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      setCurrentQuestionIndex(0);
    };

    startChat();
  }, []);

  useEffect(() => {
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      const question = questions[currentQuestionIndex];
      simulateTyping(question.text, "ai");
      
      if (question.zoneToHighlight && highlightZone) {
        highlightZone(question.zoneToHighlight);
      }
    }
  }, [currentQuestionIndex, highlightZone]);

  const handleOptionSelect = async (value: string, label: string) => {
    const question = questions[currentQuestionIndex];
    
    addMessage(label, "user");
    
    const newResponses = { ...responses, [question.id]: value };
    setResponses(newResponses);
    onResponse(question.id, value);

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsTyping(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsTyping(false);
      
      const summary = getSummaryMessage(newResponses);
      addMessage(summary, "ai");
      
      const zones = getZoneSuggestions(newResponses);
      setSuggestedZones(zones);
      
      zones.forEach((zone) => {
        highlightZone?.(zone);
      });
      
      setIsComplete(true);
      onComplete(newResponses);
    }
  };

  const currentQuestion = currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-violet-500/10 to-indigo-500/10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Assistente Onboarding</h3>
          <p className="text-xs text-muted-foreground">
            {isTyping ? "Sta scrivendo..." : "Online"}
          </p>
        </div>
        <motion.div
          className="ml-auto w-2 h-2 rounded-full bg-green-500"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-end gap-2"
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md shadow-sm">
              <TypingIndicator />
            </div>
          </motion.div>
        )}

        {currentQuestion && !isTyping && !isComplete && (
          <OptionButtons
            options={currentQuestion.options}
            onSelect={handleOptionSelect}
            disabled={isTyping}
          />
        )}

        {isComplete && suggestedZones.length > 0 && (
          <ZoneSuggestion zones={suggestedZones} />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
