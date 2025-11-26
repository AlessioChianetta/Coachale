import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import it from "date-fns/locale/it";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Calendar as CalendarIcon, Trophy, Pencil, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyTask, DailyReflection } from "@shared/schema";

interface TaskCalendarProps {
  tasks: DailyTask[];
  reflections?: DailyReflection[];
  onAddTask: (description: string, date: string) => void;
  onToggleTask: (taskId: string, completed: boolean, completedAt?: Date) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, description: string) => void;
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  currentWeek?: Date;
  onWeekChange?: (week: Date) => void;
}

export default function TaskCalendar({ tasks, reflections = [], onAddTask, onToggleTask, onDeleteTask, onEditTask, onDateSelect, selectedDate, currentWeek = new Date(), onWeekChange }: TaskCalendarProps) {
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePreviousWeek = () => {
    onWeekChange?.(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    onWeekChange?.(addWeeks(currentWeek, 1));
  };

  const handleToday = () => {
    onWeekChange?.(new Date());
  };

  const handleAddTask = (date: string) => {
    const description = newTaskInputs[date]?.trim();
    if (description) {
      onAddTask(description, date);
      setNewTaskInputs({ ...newTaskInputs, [date]: "" });
    }
  };

  const handleStartEdit = (taskId: string, currentDescription: string) => {
    setEditingTaskId(taskId);
    setEditingText(currentDescription);
  };

  const handleSaveEdit = () => {
    if (editingTaskId && editingText.trim()) {
      onEditTask(editingTaskId, editingText);
      setEditingTaskId(null);
      setEditingText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingText("");
  };

  const getTasksForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return tasks.filter(task => task.date === dateStr);
  };

  const hasReflection = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reflections.some(reflection => reflection.date === dateStr);
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  const totalWeekTasks = weekDays.reduce((sum, day) => sum + getTasksForDay(day).length, 0);
  const completedWeekTasks = weekDays.reduce((sum, day) => 
    sum + getTasksForDay(day).filter(t => t.completed).length, 0
  );
  const weekProgress = totalWeekTasks > 0 ? Math.round((completedWeekTasks / totalWeekTasks) * 100) : 0;

  return (
    <Card className="shadow-lg border-0 overflow-hidden" data-tour="tasks-calendar-view">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Calendario Task Settimanali
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(weekStart, "d MMM", { locale: it })} - {format(weekEnd, "d MMM yyyy", { locale: it })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2" data-tour="tasks-week-navigation">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePreviousWeek} 
                className="hover:bg-blue-50 dark:hover:bg-blue-950 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleToday} 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 font-semibold shadow-md px-4"
              >
                Oggi
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextWeek} 
                className="hover:bg-blue-50 dark:hover:bg-blue-950 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Week Progress Bar */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50" data-tour="tasks-progress-bar">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Progresso Settimanale</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{weekProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${weekProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{completedWeekTasks} completate</span>
              <span>{totalWeekTasks} totali</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const completedCount = dayTasks.filter(t => t.completed).length;
            const totalCount = dayTasks.length;
            const isAllCompleted = totalCount > 0 && completedCount === totalCount;

            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateSelect?.(day)}
                data-tour={index === 0 ? "tasks-day-card" : undefined}
                className={cn(
                  "relative border-2 rounded-xl p-4 min-h-[180px] flex flex-col transition-all duration-300 cursor-pointer group",
                  isToday(day) 
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800" 
                    : isSelected
                    ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 shadow-lg ring-2 ring-purple-200 dark:ring-purple-800"
                    : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:scale-[1.02]",
                  isAllCompleted && !isToday(day) && !isSelected && "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/20"
                )}
              >
                {/* Today indicator */}
                {isToday(day) && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}
                
                <div className="flex flex-col mb-auto">
                  <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {format(day, "EEE", { locale: it })}
                  </div>
                  <div className={cn(
                    "text-4xl font-bold transition-colors",
                    isToday(day) && "text-blue-600 dark:text-blue-400",
                    isSelected && "text-purple-600 dark:text-purple-400",
                    !isToday(day) && !isSelected && "text-foreground group-hover:text-blue-600"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 mt-3">
                  {totalCount > 0 && (
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 font-semibold",
                        isAllCompleted 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" 
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      )}>
                        {isAllCompleted && <Trophy className="h-3.5 w-3.5" />}
                        <span>{completedCount}/{totalCount}</span>
                      </div>
                      {hasReflection(day) && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center ring-2 ring-purple-200 dark:ring-purple-800">
                          <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                    </div>
                  )}
                  {totalCount === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Clicca per aggiungere task
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Tasks section for selected day */}
        <div className="hidden md:block mt-6">
          {selectedDate && (
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-lg">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 border-b-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <CalendarIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Task del giorno
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(selectedDate, "d MMMM yyyy", { locale: it })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTasksForDay(selectedDate).length > 0 && (
                      <Badge variant="outline" className="text-xs font-semibold">
                        {getTasksForDay(selectedDate).filter(t => t.completed).length}/{getTasksForDay(selectedDate).length} completate
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista task */}
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  {getTasksForDay(selectedDate).length === 0 ? (
                    <div className="text-center py-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-950/50 rounded-full mb-3">
                        <Plus className="h-6 w-6 text-blue-400" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Nessuna task per questo giorno</p>
                      <p className="text-xs text-muted-foreground/70">Aggiungi la tua prima task usando il campo qui sotto</p>
                    </div>
                  ) : (
                    getTasksForDay(selectedDate).map((task, taskIndex) => (
                      <div
                        key={task.id}
                        data-tour={taskIndex === 0 ? "tasks-task-item" : undefined}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl transition-all duration-200 group border-2",
                          task.completed 
                            ? "bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50" 
                            : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
                        )}
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) => {
                            const isCompleted = checked === true;
                            onToggleTask(task.id, isCompleted, isCompleted ? new Date() : undefined);
                          }}
                          className="mt-1"
                        />
                        {editingTaskId === task.id ? (
                          <>
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit();
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                              className="flex-1 h-10 border-2"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 hover:bg-green-100 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400"
                              onClick={handleSaveEdit}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className={cn(
                              "flex-1 text-sm leading-relaxed pt-1",
                              task.completed && "line-through text-muted-foreground"
                            )}>
                              {task.description}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400"
                              onClick={() => handleStartEdit(task.id, task.description)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
                              onClick={() => onDeleteTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Input per nuova task - sempre visibile in basso */}
                <div className="pt-4 border-t-2 border-dashed border-blue-200 dark:border-blue-800">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="✨ Aggiungi una nuova task..."
                        value={newTaskInputs[format(selectedDate, "yyyy-MM-dd")] || ""}
                        onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [format(selectedDate, "yyyy-MM-dd")]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTask(format(selectedDate, "yyyy-MM-dd"));
                          }
                        }}
                        className="h-12 pl-4 pr-12 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-500 rounded-xl bg-white dark:bg-gray-800 shadow-sm"
                      />
                    </div>
                    <Button
                      size="default"
                      className="h-12 px-6 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 rounded-xl font-semibold"
                      onClick={() => handleAddTask(format(selectedDate, "yyyy-MM-dd"))}
                      data-tour="tasks-add-new"
                    >
                      <Plus className="h-5 w-5 mr-2 text-white" />
                      <span className="text-white">Aggiungi</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Compact List Layout */}
        <div className="md:hidden space-y-3">
          {weekDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const completedCount = dayTasks.filter(t => t.completed).length;
            const totalCount = dayTasks.length;
            const isAllCompleted = totalCount > 0 && completedCount === totalCount;

            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isExpanded = isSelected || isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-2 rounded-xl transition-all duration-300 overflow-hidden",
                  isToday(day) 
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 shadow-lg" 
                    : isSelected
                    ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 shadow-lg"
                    : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700",
                  isAllCompleted && !isToday(day) && !isSelected && "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/20"
                )}
              >
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => onDateSelect?.(day)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-3xl font-bold transition-colors",
                      isToday(day) && "text-blue-600 dark:text-blue-400",
                      isSelected && "text-purple-600 dark:text-purple-400"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div>
                      <div className="font-semibold text-base flex items-center gap-2">
                        {format(day, "EEEE", { locale: it })}
                        {isToday(day) && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">Oggi</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, "d MMMM", { locale: it })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCount > 0 && (
                      <div className={cn(
                        "px-2.5 py-1 rounded-full inline-flex items-center gap-1 font-semibold text-xs",
                        isAllCompleted 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" 
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      )}>
                        {isAllCompleted && <Trophy className="h-3 w-3" />}
                        {completedCount}/{totalCount}
                      </div>
                    )}
                    {hasReflection(day) && (
                      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                        <MessageSquare className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                    <ChevronRight className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform duration-300",
                      isExpanded && "rotate-90"
                    )} />
                  </div>
                </div>

                {/* Expanded content */}
                <div className={cn(
                  "transition-all duration-300 ease-in-out",
                  isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                )}>
                  <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3 mt-1">

                {dayTasks.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessuna task per questo giorno</p>
                      </div>
                    )}
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-2xl transition-all duration-300 group/task shadow-sm hover:shadow-md",
                          task.completed 
                            ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-2 border-green-300 dark:border-green-800" 
                            : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 hover:scale-[1.02] active:scale-[0.98]"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 transition-transform duration-200",
                          !task.completed && "group-hover/task:scale-110"
                        )}>
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={(checked) => {
                              const isCompleted = checked === true;
                              onToggleTask(task.id, isCompleted, isCompleted ? new Date() : undefined);
                            }}
                            className="h-5 w-5 border-2"
                          />
                        </div>
                        {editingTaskId === task.id ? (
                          <>
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit();
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                              className="flex-1 h-10 text-sm border-2 rounded-xl"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-xl hover:bg-green-100 dark:hover:bg-green-950 hover:text-green-600 dark:hover:text-green-400 transition-all hover:scale-110 active:scale-95"
                              onClick={handleSaveEdit}
                            >
                              <Check className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-xl hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-all hover:scale-110 active:scale-95"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className={cn(
                              "flex-1 text-sm leading-relaxed font-medium pt-0.5",
                              task.completed ? "line-through text-muted-foreground" : "text-foreground"
                            )}>
                              {task.description}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity duration-200">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110 active:scale-95 shadow-sm"
                                onClick={() => handleStartEdit(task.id, task.description)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-all hover:scale-110 active:scale-95 shadow-sm"
                                onClick={() => onDeleteTask(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Input
                        placeholder="✨ Aggiungi una task..."
                        value={newTaskInputs[dateStr] || ""}
                        onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [dateStr]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTask(dateStr);
                          }
                        }}
                        className="border-2 border-dashed border-blue-300 dark:border-blue-700 focus:border-solid focus:border-blue-500 transition-all"
                      />
                      <Button
                        size="icon"
                        className="bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95"
                        onClick={() => handleAddTask(dateStr)}
                      >
                        <Plus className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}