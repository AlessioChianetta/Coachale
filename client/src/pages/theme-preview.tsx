import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  User,
  Home,
  Bell,
  Search,
  ChevronRight,
  Sun,
  Moon,
  Plus,
  Check,
  X,
  Mail,
  Calendar,
  Star,
  Zap,
} from "lucide-react";

const palettes = [
  {
    name: "Linear",
    subtitle: "Deep Black",
    background: "222 18% 7%",
    card: "222 18% 10%",
    popover: "222 18% 12%",
    muted: "222 18% 14%",
    border: "222 15% 18%",
    foreground: "210 20% 96%",
    "muted-foreground": "215 12% 65%",
    primary: "224 85% 60%",
    secondary: "262 70% 60%",
    accent: "28 85% 55%",
  },
  {
    name: "Notion",
    subtitle: "Warm Gray",
    background: "30 5% 10%",
    card: "30 5% 13%",
    popover: "30 5% 15%",
    muted: "30 5% 17%",
    border: "30 5% 22%",
    foreground: "40 10% 92%",
    "muted-foreground": "30 5% 55%",
    primary: "224 85% 60%",
    secondary: "262 70% 60%",
    accent: "28 85% 55%",
  },
  {
    name: "Discord",
    subtitle: "Dark Blue",
    background: "220 15% 10%",
    card: "220 15% 13%",
    popover: "220 15% 15%",
    muted: "220 15% 17%",
    border: "220 12% 22%",
    foreground: "210 20% 96%",
    "muted-foreground": "220 10% 60%",
    primary: "235 85% 65%",
    secondary: "262 70% 60%",
    accent: "28 85% 55%",
  },
  {
    name: "Spotify",
    subtitle: "True Black + Green",
    background: "0 0% 5%",
    card: "0 0% 9%",
    popover: "0 0% 11%",
    muted: "0 0% 14%",
    border: "0 0% 18%",
    foreground: "0 0% 95%",
    "muted-foreground": "0 0% 55%",
    primary: "142 70% 45%",
    secondary: "262 70% 60%",
    accent: "28 85% 55%",
  },
  {
    name: "Midnight",
    subtitle: "Deep Navy",
    background: "230 25% 8%",
    card: "230 22% 12%",
    popover: "230 22% 14%",
    muted: "230 20% 16%",
    border: "230 15% 22%",
    foreground: "220 30% 96%",
    "muted-foreground": "225 12% 60%",
    primary: "210 100% 60%",
    secondary: "280 70% 60%",
    accent: "35 90% 55%",
  },
];

const sidebarItems = [
  { icon: Home, label: "Dashboard" },
  { icon: User, label: "Clienti" },
  { icon: Calendar, label: "Calendario" },
  { icon: Settings, label: "Impostazioni" },
];

const tableData = [
  { name: "Marco Rossi", role: "Consulente", status: "Attivo", date: "15/02/2026" },
  { name: "Laura Bianchi", role: "Cliente", status: "In attesa", date: "14/02/2026" },
  { name: "Giuseppe Verdi", role: "Admin", status: "Attivo", date: "13/02/2026" },
  { name: "Anna Neri", role: "Consulente", status: "Inattivo", date: "12/02/2026" },
  { name: "Paolo Conte", role: "Cliente", status: "Attivo", date: "11/02/2026" },
];

export default function ThemePreview() {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const p = palettes[selected];
  const paletteStyles = {
    "--background": p.background,
    "--foreground": p.foreground,
    "--card": p.card,
    "--card-foreground": p.foreground,
    "--popover": p.popover,
    "--popover-foreground": p.foreground,
    "--primary": p.primary,
    "--primary-foreground": "0 0% 100%",
    "--secondary": p.secondary,
    "--secondary-foreground": "0 0% 100%",
    "--muted": p.muted,
    "--muted-foreground": p["muted-foreground"],
    "--accent": p.accent,
    "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 55%",
    "--destructive-foreground": "0 0% 100%",
    "--border": p.border,
    "--input": p.border,
    "--ring": p.primary,
  } as React.CSSProperties;

  return (
    <div
      className="dark min-h-screen bg-background text-foreground"
      style={paletteStyles}
    >
      {/* Top bar - Palette Selector */}
      <div className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">Anteprima Tema Dark</h1>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {palettes.map((pal, i) => (
              <button
                key={pal.name}
                onClick={() => setSelected(i)}
                className={`flex-shrink-0 rounded-xl border-2 p-3 transition-all ${
                  selected === i
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-muted-foreground/30"
                } bg-card`}
              >
                <div className="text-sm font-semibold text-foreground">{pal.name}</div>
                <div className="text-xs text-muted-foreground mb-2">{pal.subtitle}</div>
                <div className="flex gap-1.5">
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: `hsl(${pal.background})` }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: `hsl(${pal.card})` }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: `hsl(${pal.primary})` }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: `hsl(${pal.accent})` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content - Two column layout */}
      <div className="mx-auto max-w-7xl px-4 py-6 flex gap-6">
        {/* Left - Sidebar mockup */}
        <div className="w-56 flex-shrink-0 hidden lg:block">
          <div className="rounded-xl border border-border bg-card p-4 sticky top-[180px]">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">Piattaforma</span>
            </div>
            <nav className="space-y-1">
              {sidebarItems.map((item, i) => (
                <button
                  key={item.label}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    i === 0
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {i === 0 && <ChevronRight className="h-3 w-3 ml-auto" />}
                </button>
              ))}
            </nav>
            <Separator className="my-4" />
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" />
                Email Hub
              </button>
              <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Star className="h-4 w-4" />
                Preferiti
              </button>
            </div>
          </div>
        </div>

        {/* Right - Showcase */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* Header bar mockup */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cerca..." className="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Moon className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>

          {/* Cards section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Card</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Clienti Totali</CardDescription>
                  <CardTitle className="text-3xl">128</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">+12%</span> rispetto al mese scorso
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Profilo Utente</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Marco Rossi</p>
                      <p className="text-xs text-muted-foreground">Consulente Senior</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Notifiche</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Nuova consulenza prenotata</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span>Task in scadenza</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    <span>Report settimanale pronto</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Buttons section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Bottoni</h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Predefinito
                  </Button>
                  <Button variant="secondary">
                    <Star className="h-4 w-4" />
                    Secondario
                  </Button>
                  <Button variant="outline">
                    <Settings className="h-4 w-4" />
                    Outline
                  </Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">
                    <X className="h-4 w-4" />
                    Distruttivo
                  </Button>
                  <Button variant="link">Link</Button>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-3">
                  <Button size="sm">
                    <Check className="h-3 w-3" />
                    Piccolo
                  </Button>
                  <Button size="sm" variant="secondary">Piccolo</Button>
                  <Button size="sm" variant="outline">Piccolo</Button>
                  <Button size="sm" variant="ghost">Piccolo</Button>
                  <Button size="sm" variant="destructive">Piccolo</Button>
                  <Button size="sm" variant="link">Piccolo</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form elements */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Elementi Form</h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input placeholder="Inserisci il nome..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" placeholder="email@esempio.it" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ruolo</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un ruolo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulente">Consulente</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Scrivi le tue note qui..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Badges */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Badge</h3>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3">
                  <Badge>Predefinito</Badge>
                  <Badge variant="secondary">Secondario</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Distruttivo</Badge>
                  <Badge className="bg-green-600 text-white border-transparent">Successo</Badge>
                  <Badge className="bg-accent text-accent-foreground border-transparent">Accento</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Tabella</h3>
            <Card>
              <CardContent className="pt-6 p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ruolo</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stato</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">{row.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{row.role}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                row.status === "Attivo"
                                  ? "default"
                                  : row.status === "In attesa"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {row.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer note */}
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Seleziona la palette che preferisci. Una volta scelta, verrà applicata a tutta la piattaforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
