# Design System — Mobile + Dark Mode Standard

Pattern di riferimento per tutte le pagine della piattaforma. Ogni nuova pagina o componente deve rispettare queste regole.

---

## 1. CSS Utility Classes (`client/src/index.css`)

| Classe | Uso |
|---|---|
| `.page-container` | Wrapper pagina standard: `px-5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8` |
| `.flat-card` | Card senza ombra: `bg-background border border-border/60 rounded-2xl` |
| `.flat-card-muted` | Card sfondo muted: `bg-muted/40 border border-border/40 rounded-2xl` |
| `.touch-item` | List item mobile: `min-h-[44px] flex items-center gap-3` |
| `.section-label` | Label sezione: `text-[11px] font-semibold uppercase tracking-widest text-muted-foreground` |
| `.mobile-hero` | Hero section: `p-5 sm:p-8 rounded-2xl` |
| `.pb-safe` | Safe area iOS: `padding-bottom: max(1.5rem, env(safe-area-inset-bottom))` |
| `.no-scrollbar` | Nasconde scrollbar visiva (mobile) |

---

## 2. Dark Mode — Regole Fondamentali

### VIETATO
```tsx
// MAI colori hardcoded senza dark: counterpart
<div className="bg-white">           // SBAGLIATO
<div className="bg-gray-100">        // SBAGLIATO
<div className="bg-slate-50">        // SBAGLIATO
<div className="text-gray-900">      // SBAGLIATO
```

### CORRETTO — CSS Variables
```tsx
<div className="bg-background">      // sfondo pagina
<div className="bg-card">            // card/panel
<div className="bg-muted">           // sfondo muted
<div className="text-foreground">    // testo principale
<div className="text-muted-foreground"> // testo secondario
<div className="border-border">      // bordi
```

### OK — Overlay Trasparenti
```tsx
<div className="bg-primary/10">      // overlay brand color — funziona in entrambi i temi
<div className="bg-emerald-500/10">  // overlay colore semantico
<div className="bg-card/80">         // card semi-trasparente (backdrop blur)
```

### Eccezione
Colori hardcoded **SOLO** dentro sezioni con sfondo a gradiente fisso (es. sezione hero con gradient string-to-teal):
```tsx
<div className="bg-gradient-to-br from-cyan-500 to-teal-600">
  <span className="text-white">OK qui</span> // sfondo fisso, colore sicuro
</div>
```

---

## 3. Componenti Condivisi

### `PageLayout` — `client/src/components/layout/PageLayout.tsx`

Wrapper universale per ogni pagina. Gestisce Navbar (mobile), Sidebar, e layout base.

```tsx
import { PageLayout } from "@/components/layout/PageLayout";

// Uso standard
<PageLayout role="consultant">
  <div className="page-container">
    {/* contenuto */}
  </div>
</PageLayout>

// Full-bleed (mappe, chat, video)
<PageLayout role="client" noPadding>
  {/* contenuto senza padding */}
</PageLayout>
```

**Elimina il boilerplate:**
- `isMobile` check per Navbar/Sidebar
- `sidebarOpen` state e gestione open/close
- Wrapper `min-h-screen bg-background`

### `KPICard` — `client/src/components/ui/kpi-card.tsx`

```tsx
import { KPICard } from "@/components/ui/kpi-card";

<KPICard
  title="Clienti Attivi"
  value={42}
  icon={Users}
  iconColor="text-blue-500"
  iconBg="bg-blue-500/10"
  delta="+12%"
  deltaPositive={true}
  onClick={() => navigate("/clients")}
/>
```

### `SectionHeader` — `client/src/components/ui/section-header.tsx`

```tsx
import { SectionHeader } from "@/components/ui/section-header";

<SectionHeader
  icon={Bell}
  iconColor="text-orange-500"
  iconBg="bg-orange-500/10"
  title="Notifiche"
  badge={3}
  action={{ label: "Vedi tutte", onClick: () => navigate("/notifications") }}
/>
```

---

## 4. Mobile Standard

| Proprietà | Valore |
|---|---|
| Touch target minimo | `min-h-[44px]` (usa `.touch-item`) |
| Padding pagina | `px-5` (20px) su mobile → `.page-container` |
| Gap sezioni | `space-y-6` mobile, `sm:space-y-8` desktop |
| Padding card | `p-4` mobile, `sm:p-5` desktop |
| Titolo hero | `text-2xl font-bold sm:text-3xl` |
| Border radius | `rounded-2xl` (card), `rounded-xl` (button) |
| Animazioni | `duration-200` max, `ease-out` — niente bounce |

---

## 5. Pattern Layout — Refactor Dashboard

Per aggiungere una nuova pagina o refactorare una esistente:

### Prima (boilerplate ripetuto)
```tsx
export default function MyPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // ...10 righe di setup layout...

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900"> // SBAGLIATO
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} ... />
      <main>{/* contenuto */}</main>
    </div>
  );
}
```

### Dopo (standard)
```tsx
export default function MyPage() {
  return (
    <PageLayout role="consultant">
      <div className="page-container pb-safe">
        <SectionHeader title="Titolo Pagina" icon={MyIcon} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard ... />
        </div>
        {/* altri contenuti */}
      </div>
    </PageLayout>
  );
}
```

---

## 6. Pagine Speciali — Layout Chat (AI Assistant)

Le pagine AI assistant usano un layout a 3 pannelli speciale (nav sidebar + conversation list + chat).
**Non usare PageLayout** per queste — gestiscono il proprio Sidebar.

Regole per queste pagine:
- Outer wrapper: `bg-background` (NO gradient)
- Conversation list overlay mobile: `bg-background`
- Header mobile chat: `h-14 border-b border-border bg-background/98` con menu button per aprire conversation list
- Agent header: `border-b border-border bg-background/80 backdrop-blur-sm`
- SelectTrigger: `bg-card border-border`
- Input area: `bg-background`

---

## 7. Pagine Implementate con lo Standard

| Pagina | Componenti | Status |
|---|---|---|
| `consultant-dashboard.tsx` | PageLayout, KPICard, SectionHeader | ✅ |
| `client-dashboard.tsx` | PageLayout, KPICard | ✅ |
| `consultant-ai-assistant.tsx` | Layout custom + CSS vars | ✅ |
| `client-ai-assistant.tsx` | Layout custom + CSS vars | ✅ |
| `components/navbar.tsx` | CSS vars completo | ✅ |
| `components/sidebar.tsx` | CSS vars completo | ✅ |
| `consultant-clients.tsx` | Card list mobile, filter bar ottimizzata, paginazione mobile | ✅ |
| `components/ai-assistant/ConversationSidebar.tsx` | CSS vars completo | ✅ |
