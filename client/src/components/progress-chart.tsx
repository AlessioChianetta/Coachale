import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Target } from "lucide-react";

interface ProgressData {
  day: string;
  completed: boolean;
  exerciseCount?: number;
}

interface Goal {
  title: string;
  progress: number;
  target: string;
  unit?: string;
}

interface ProgressChartProps {
  weeklyProgress?: ProgressData[];
  goals?: Goal[];
  stats?: {
    completedExercises: number;
    totalExercises: number;
    streak: number;
  };
}

const defaultWeeklyProgress: ProgressData[] = [
  { day: "Lun", completed: true },
  { day: "Mar", completed: true },
  { day: "Mer", completed: true },
  { day: "Gio", completed: false, exerciseCount: 2 },
  { day: "Ven", completed: false },
  { day: "Sab", completed: false },
  { day: "Dom", completed: false },
];

const defaultGoals: Goal[] = [
  { title: "Perdita Peso", progress: 70, target: "3 kg", unit: "kg" },
  { title: "Forza", progress: 85, target: "100%", unit: "%" },
  { title: "Costanza", progress: 90, target: "22 giorni", unit: "giorni" },
];

export default function ProgressChart({ 
  weeklyProgress = defaultWeeklyProgress, 
  goals = defaultGoals,
  stats 
}: ProgressChartProps) {
  return (
    <div className="space-y-6">
      {/* Weekly Progress */}
      <Card data-testid="card-weekly-progress">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Progresso Settimanale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weeklyProgress.map((day, index) => (
              <div key={day.day} className="flex justify-between items-center text-sm">
                <span 
                  className={day.completed ? "text-foreground font-medium" : "text-muted-foreground"}
                  data-testid={`text-day-${day.day.toLowerCase()}`}
                >
                  {day.day}
                </span>
                <div className="w-6 h-6 rounded-full flex items-center justify-center">
                  {day.completed ? (
                    <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                      <CheckCircle size={14} className="text-white" />
                    </div>
                  ) : day.exerciseCount ? (
                    <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{day.exerciseCount}</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-muted rounded-full"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Goals Progress */}
      <Card data-testid="card-goals-progress">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Obiettivi del Mese</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {goals.map((goal, index) => (
              <div key={index} className="space-y-2" data-testid={`goal-${index}`}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground" data-testid={`text-goal-title-${index}`}>
                    {goal.title}
                  </span>
                  <span className="text-muted-foreground" data-testid={`text-goal-progress-${index}`}>
                    {goal.progress}% di {goal.target}
                  </span>
                </div>
                <Progress 
                  value={goal.progress} 
                  className="h-2"
                  data-testid={`progress-goal-${index}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card data-testid="card-achievements">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Achievement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center" data-testid="achievement-streak">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">{stats?.streak || 7} giorni</p>
            </div>
            <div className="text-center" data-testid="achievement-first-week">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">Prima settimana</p>
            </div>
            <div className="text-center" data-testid="achievement-perfect">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">Perfezionista</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
