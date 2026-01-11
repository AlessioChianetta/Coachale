import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  Megaphone,
  Plus,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface CalendarEvent {
  id: string;
  title: string;
  type: "post" | "campaign";
  date: string;
  time?: string;
  platform?: string;
}

export default function ContentStudioCalendar() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const demoEvents: CalendarEvent[] = [
    {
      id: "1",
      title: "[DEMO] Post Instagram - Fitness Tips",
      type: "post",
      date: "2025-01-15",
      time: "09:00",
      platform: "Instagram",
    },
    {
      id: "2",
      title: "[DEMO] Campagna Lead Gen",
      type: "campaign",
      date: "2025-01-15",
    },
    {
      id: "3",
      title: "[DEMO] Reel TikTok - Behind the Scenes",
      type: "post",
      date: "2025-01-16",
      time: "12:30",
      platform: "TikTok",
    },
    {
      id: "4",
      title: "[DEMO] Post LinkedIn - Case Study",
      type: "post",
      date: "2025-01-18",
      time: "08:00",
      platform: "LinkedIn",
    },
    {
      id: "5",
      title: "[DEMO] Campagna Retargeting",
      type: "campaign",
      date: "2025-01-20",
    },
    {
      id: "6",
      title: "[DEMO] Carosello Instagram",
      type: "post",
      date: "2025-01-22",
      time: "18:00",
      platform: "Instagram",
    },
    {
      id: "7",
      title: "[DEMO] Video YouTube",
      type: "post",
      date: "2025-01-25",
      time: "15:00",
      platform: "YouTube",
    },
  ];

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
    return demoEvents.filter((event) => event.date === dateStr);
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
    ? demoEvents.filter((event) => event.date === selectedDate)
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
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                [DEMO] Dati di Esempio
              </Badge>
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
                      const events = getEventsForDate(day);
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
                              {events.slice(0, 2).map((event) => (
                                <div
                                  key={event.id}
                                  className={`h-1.5 rounded-full ${
                                    event.type === "post"
                                      ? "bg-blue-500"
                                      : "bg-purple-500"
                                  }`}
                                />
                              ))}
                              {events.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{events.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi
                  </Button>
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
                                {event.time && (
                                  <Badge variant="outline" className="text-xs">
                                    {event.time}
                                  </Badge>
                                )}
                                {event.platform && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.platform}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nessun contenuto programmato per questa data
                      </p>
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
    </div>
  );
}
