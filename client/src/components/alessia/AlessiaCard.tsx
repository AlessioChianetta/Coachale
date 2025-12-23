import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Phone, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MicLevelIndicator } from './MicLevelIndicator';
import { useAlessiaSession } from '@/contexts/AlessiaSessionContext';
import { cn } from '@/lib/utils';

interface AlessiaCardProps {
  className?: string;
}

export function AlessiaCard({ className }: AlessiaCardProps) {
  const { session, startSession } = useAlessiaSession();
  const [isHovered, setIsHovered] = useState(false);

  const handleStartConversation = () => {
    if (!session.isActive) {
      startSession();
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden border-0 shadow-2xl relative group",
        "bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-pink-500/10",
        "hover:from-fuchsia-500/20 hover:via-purple-500/20 hover:to-pink-500/20",
        "transition-all duration-500",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/5 via-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-fuchsia-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-500/20 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <CardContent className="relative z-10 p-6">
        <div className="flex items-start gap-4 mb-5">
          <motion.div 
            animate={isHovered ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </span>
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Parla con Alessia
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white rounded-full">
                AI
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              La tua assistente personale sempre disponibile. Chiedi qualsiasi cosa in tempo reale!
            </p>
          </div>
        </div>

        <div className="mb-5">
          <MicLevelIndicator />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleStartConversation}
            disabled={session.isActive}
            size="lg"
            className={cn(
              "flex-1 h-14 text-base font-bold",
              "bg-gradient-to-r from-fuchsia-500 via-purple-600 to-pink-600",
              "hover:from-fuchsia-600 hover:via-purple-700 hover:to-pink-700",
              "shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50",
              "transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
              session.isActive && "opacity-50 cursor-not-allowed"
            )}
          >
            <Phone className="mr-2 h-5 w-5" />
            {session.isActive ? 'Conversazione Attiva' : 'Inizia Conversazione'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => window.location.href = '/client/ai-assistant'}
            className="h-14 px-6 border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Chat Testuale
          </Button>
        </div>

        {session.isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30"
          >
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                Conversazione in corso - Clicca sul widget viola in basso a destra
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
