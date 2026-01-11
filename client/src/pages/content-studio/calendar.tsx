import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface CalendarEvent {
  id: string;
  title: string;
  type: "post" | "campaign";
  scheduledDate: string;
  scheduledTime?: string;
  platform?: string;
  status?: string;
}

export default function ContentStudioCalendar() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "post" as "post" | "campaign",
    scheduledDate: "",
    scheduledTime: "",
    platform: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: calendarResponse, isLoading } = useQuery({
    queryKey: ["/api/content/calendar"],
    queryFn: async () => {
      const response = await fetch("/api/content/calendar", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch calendar");
      return response.json();
    },
  });

  const events: CalendarEvent[] = calendarResponse?.data || [];

  const createEventMutation = useMutation({
    mutationFn: async (event: Partial<CalendarEvent>) => {
      const response = await fetch("/api/content/calendar", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evento creato",
        description: "L'evento è stato aggiunto al calendario",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/calendar"] });
      setIsDialogOpen(false);
      setFormData({
        title: "",
        type: "post",
        scheduledDate: "",
        scheduledTime: "",
        platform: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/content/calendar/${eventId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete event");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evento eliminato",
        description: "L'evento è stato rimosso dal calendario",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/calendar"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateEvent = () => {
    if (!formData.title || !formData.scheduledDate) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci titolo e data",
        variant: "destructive",
      });
      return;
    }
    createEventMutation.mutate(formData);
  };

  const handleAddEvent = (date: string) => {
    setFormData((prev) => ({ ...prev, scheduledDate: date }));
    setIsDialogOpen(true);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days: (number | null)[] = [];
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const formatDateString = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${month}-${dayStr}`;
  };

  const getEventsForDate = (day: number) => {
    const dateStr = formatDateString(day);
    return events.filter((event) => {
      const eventDate = event.scheduledDate?.split("T")[0];
      return eventDate === dateStr;
    });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  const days = getDaysInMonth(currentDate);

  const selectedDateEvents = selectedDate
    ? events.filter((event) => {
        const eventDate = event.scheduledDate?.split("T")[0];
        return eventDate === selectedDate;
      })
    : [];

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <CalendarIcon className="h-8 w-8 text-blue-500" />
                  Calendario Contenuti
                </h1>
                <p className="text-muted-foreground">
                  Pianifica e visualizza i tuoi contenuti
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-muted-foreground">Post</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-muted-foreground">Campagna</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateMonth("prev")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle className="text-lg">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateMonth("next")}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 35 }).map((_, i) => (
                          <Skeleton key={i} className="aspect-square" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map((day) => (
                          <div
                            key={day}
                            className="text-center text-sm font-medium text-muted-foreground py-2"
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => {
                          if (day === null) {
                            return <div key={`empty-${index}`} className="aspect-square" />;
                          }

                          const dateStr = formatDateString(day);
                          const dayEvents = getEventsForDate(day);
                          const isSelected = selectedDate === dateStr;
                          const isToday =
                            new Date().toISOString().split("T")[0] === dateStr;

                          return (
                            <button
                              key={day}
                              onClick={() => setSelectedDate(dateStr)}
                              className={`aspect-square p-1 rounded-lg border transition-all hover:bg-muted ${
                                isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-transparent"
                              } ${isToday ? "ring-2 ring-primary" : ""}`}
                            >
                              <div className="h-full flex flex-col">
                                <span
                                  className={`text-sm ${
                                    isToday ? "font-bold text-primary" : ""
                                  }`}
                                >
                                  {day}
                                </span>
                                <div className="flex-1 flex flex-col gap-0.5 mt-1">
                                  {dayEvents.slice(0, 2).map((event) => (
                                    <div
                                      key={event.id}
                                      className={`h-1.5 rounded-full ${
                                        event.type === "post"
                                          ? "bg-blue-500"
                                          : "bg-purple-500"
                                      }`}
                                    />
                                  ))}
                                  {dayEvents.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{dayEvents.length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                        })
                      : "Seleziona un giorno"}
                  </CardTitle>
                  {selectedDate && (
                    <Button size="sm" onClick={() => handleAddEvent(selectedDate)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Aggiungi
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDate ? (
                    selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border-l-4 ${
                            event.type === "post"
                              ? "border-l-blue-500 bg-blue-500/5"
                              : "border-l-purple-500 bg-purple-500/5"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {event.type === "post" ? (
                              <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                            ) : (
                              <Megaphone className="h-4 w-4 text-purple-500 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{event.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {event.scheduledTime && (
                                  <Badge variant="outline" className="text-xs">
                                    {event.scheduledTime}
                                  </Badge>
                                )}
                                {event.platform && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.platform}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => deleteEventMutation.mutate(event.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Nessun contenuto programmato
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => handleAddEvent(selectedDate)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Aggiungi evento
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Clicca su un giorno per vedere i contenuti programmati
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titolo</Label>
              <Input
                id="title"
                placeholder="Titolo dell'evento..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "post" | "campaign") =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="campaign">Campagna</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Ora</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledTime: e.target.value })
                  }
                />
              </div>
            </div>

            {formData.type === "post" && (
              <div className="space-y-2">
                <Label>Piattaforma</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) =>
                    setFormData({ ...formData, platform: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona piattaforma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleCreateEvent}
              disabled={createEventMutation.isPending}
              className="w-full"
            >
              {createEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Aggiungi al Calendario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
