import { motion } from "framer-motion";
import { BookOpen, FileText, CheckCircle2, List, GraduationCap } from "lucide-react";
import { PageContext } from "@/hooks/use-page-context";

interface ContextButtonProps {
  pageContext: PageContext;
  onClick: () => void;
  isOpen: boolean;
}

export function ContextButton({ pageContext, onClick, isOpen }: ContextButtonProps) {
  const isExercise = pageContext.pageType === "exercise";
  const isExercisesList = pageContext.pageType === "exercises_list";
  const isUniversity = pageContext.pageType === "course";
  const isLesson = pageContext.pageType === "library_document" || pageContext.pageType === "university_lesson";

  // Determina icona e colori in base al tipo di pagina
  let Icon = BookOpen;
  let bgColor = "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700";
  let badgeColor = "bg-blue-500";
  
  if (isExercise) {
    Icon = FileText;
    bgColor = "from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700";
    badgeColor = "bg-purple-500";
  } else if (isExercisesList) {
    Icon = List;
    bgColor = "from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700";
    badgeColor = "bg-indigo-500";
  } else if (isUniversity) {
    Icon = GraduationCap;
    bgColor = "from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700";
    badgeColor = "bg-cyan-500";
  }

  return (
    <div className="relative">
      <motion.button
        onClick={onClick}
        className={`
          relative w-16 h-16 rounded-full shadow-2xl
          bg-gradient-to-br ${bgColor}
          flex items-center justify-center
          transition-all duration-200
          hover:shadow-xl hover:scale-105
          focus:outline-none focus:ring-2 focus:ring-offset-2 
          ${isExercise ? 'focus:ring-purple-500' : isExercisesList ? 'focus:ring-indigo-500' : isUniversity ? 'focus:ring-cyan-500' : 'focus:ring-blue-500'}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Icon className="h-7 w-7 text-white" />
        
        <motion.div
          className="absolute top-0 right-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md border-2 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          <CheckCircle2 className="h-3 w-3 text-white" />
        </motion.div>
      </motion.button>

      {!isOpen && (
        <motion.div
          className={`absolute inset-0 rounded-full ${badgeColor} opacity-40 pointer-events-none`}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 0, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}
