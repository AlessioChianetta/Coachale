import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database, Search, BookOpen, Brain, FileText, PhoneCall,
  Phone, Mail, MessageSquare, Globe, Table2, Sparkles,
  Activity, Info
} from "lucide-react";
import { motion } from "framer-motion";

interface DataCatalogTabProps {
  showArchDetails: boolean;
  setShowArchDetails: (show: boolean) => void;
}

function DataCatalogTab({ showArchDetails, setShowArchDetails }: DataCatalogTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-5"
    >
      <Card className="rounded-xl shadow-sm border-l-4 border-l-teal-500 bg-teal-50 dark:bg-teal-950/20">
        <CardContent className="py-5 px-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-teal-500 shadow-sm">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">Catalogo Dati Accessibili</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tutte le query e operazioni che il Dipendente AI esegue internamente, step per step
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <Table2 className="h-3 w-3 text-teal-500" />
                  3 tabelle
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  9 operazioni
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border-l-4 border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-500/15 shrink-0">
            <Search className="h-5 w-5 text-teal-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              1. Recupero Dati Cliente
              <Badge className="bg-teal-500/20 text-teal-500 border-teal-500/30 text-xs">fetch_client_data</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cerca le informazioni del contatto nel database. Se il task ha un <span className="font-medium text-foreground">ID contatto</span>, lo usa direttamente.
              Altrimenti cerca per <span className="font-medium text-foreground">numero di telefono</span>.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                <Table2 className="h-3.5 w-3.5" />
                Query 1 — Tabella: users
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Campi letti:</span> id, first_name, last_name, email, phone_number, role, level, consultant_id, is_active, enrolled_at, created_at</p>
                <p><span className="font-medium text-foreground">Filtro:</span> per ID contatto oppure per numero di telefono</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Recuperare l'anagrafica completa del contatto associato al task</p>
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                <Table2 className="h-3.5 w-3.5" />
                Query 2 — Tabella: ai_scheduled_tasks
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Campi letti:</span> id, task_type, task_category, status, ai_instruction, scheduled_at, result_summary, priority</p>
                <p><span className="font-medium text-foreground">Filtro:</span> per contact_id, ordine cronologico (ultimi 10)</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Vedere i task precedenti per quel contatto ed evitare azioni duplicate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 shrink-0">
            <BookOpen className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              2. Ricerca Documenti Privati
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">search_private_stores</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cerca esclusivamente nei <span className="font-medium text-foreground">documenti privati del cliente</span> usando
              <span className="font-medium text-foreground"> ricerca semantica AI</span> (Gemini File Search).
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Search className="h-3.5 w-3.5" />
                Store Privato del Cliente
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Fonti:</span> Note consulenze, risposte esercizi, documenti caricati, storico interazioni</p>
                <p><span className="font-medium text-foreground">Metodo:</span> Ricerca semantica nei documenti indicizzati del contatto</p>
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                Output AI
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Produce:</span> Riassunto documenti trovati, citazioni con fonti, conteggio documenti per categoria</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Arricchire il contesto con dati reali dal fascicolo privato del cliente</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/15 shrink-0">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              3. Analisi Pattern
              <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-xs">analyze_patterns</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Prende i dati recuperati negli step precedenti (anagrafica + task recenti + documenti privati)
              e li passa a <span className="font-medium text-foreground">Gemini AI</span> per un'analisi dettagliata.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <Sparkles className="h-3.5 w-3.5" />
                Output AI
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Input:</span> Dati contatto + storico task recenti + documenti privati (se trovati)</p>
                <p><span className="font-medium text-foreground">Produce:</span> Punteggio engagement, argomenti chiave, frequenza contatti, rischi identificati, raccomandazioni</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Capire la situazione del cliente prima di agire</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-500/15 shrink-0">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              4. Generazione Report
              <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">generate_report</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Usa i dati di fetch + analisi per generare un
              <span className="font-medium text-foreground"> documento strutturato</span> tramite Gemini AI.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <FileText className="h-3.5 w-3.5" />
                Output AI
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Input:</span> Dati contatto + analisi pattern + documenti privati + istruzione originale</p>
                <p><span className="font-medium text-foreground">Produce:</span> Titolo, sommario, sezioni dettagliate, risultati chiave, raccomandazioni, prossimi passi</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Creare un report scritto e strutturato da consultare</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-green-500 bg-green-50/50 dark:bg-green-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-green-500/15 shrink-0">
            <PhoneCall className="h-5 w-5 text-green-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              5. Preparazione Chiamata
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">prepare_call</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Non fa query dirette al DB.</span> Usa i dati raccolti per generare uno
              <span className="font-medium text-foreground"> script di chiamata</span> personalizzato tramite Gemini AI.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                <Sparkles className="h-3.5 w-3.5" />
                Output AI
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Input:</span> Analisi pattern + report + dati contatto</p>
                <p><span className="font-medium text-foreground">Produce:</span> Punti chiave, frase di apertura, frase di chiusura, risposte a obiezioni, durata stimata, priorità</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Preparare l'AI per una chiamata vocale efficace</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 shrink-0">
            <Phone className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              6. Chiamata Vocale
              <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">voice_call</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Scrive nel DB</span> per programmare una chiamata vocale AI.
              Crea un record nella tabella delle chiamate e un task figlio.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Table2 className="h-3.5 w-3.5" />
                INSERT — Tabella: scheduled_voice_calls
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Campi scritti:</span> id, consultant_id, target_phone, scheduled_at, status, ai_mode, custom_prompt, call_instruction, instruction_type, attempts, max_attempts, priority, source_task_id, attempts_log, use_default_template, created_at, updated_at</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Programmare la chiamata nel sistema vocale FreeSWITCH</p>
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Table2 className="h-3.5 w-3.5" />
                INSERT — Tabella: ai_scheduled_tasks
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Campi scritti:</span> id, consultant_id, contact_phone, contact_name, task_type, ai_instruction, scheduled_at, timezone, status, priority, parent_task_id, contact_id, task_category, voice_call_id, max_attempts, current_attempt, retry_delay_minutes, created_at, updated_at</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Creare un task figlio collegato alla chiamata per il tracciamento</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-sky-500/15 shrink-0">
            <Mail className="h-5 w-5 text-sky-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              7. Invio Email
              <Badge className="bg-sky-500/20 text-sky-500 border-sky-500/30 text-xs">send_email</Badge>
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">In arrivo</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Attualmente <span className="font-medium text-foreground">registra l'intenzione nel feed attività</span> ma non invia email reali.
              L'integrazione completa è prevista in una fase futura.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <Activity className="h-3.5 w-3.5" />
                Azione attuale
              </div>
              <div className="text-xs text-muted-foreground pl-5">
                <p>Registra un evento di tipo "send_email" nel feed attività con nome contatto, categoria task e dati del report</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-green-600 bg-green-50/50 dark:bg-green-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-green-600/15 shrink-0">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              8. Invio WhatsApp
              <Badge className="bg-green-600/20 text-green-600 border-green-600/30 text-xs">send_whatsapp</Badge>
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">In arrivo</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Attualmente <span className="font-medium text-foreground">registra l'intenzione nel feed attività</span> ma non invia messaggi reali.
              L'integrazione completa è prevista in una fase futura.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-400">
                <Activity className="h-3.5 w-3.5" />
                Azione attuale
              </div>
              <div className="text-xs text-muted-foreground pl-5">
                <p>Registra un evento di tipo "send_whatsapp" nel feed attività con nome contatto, telefono e dati del report</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 shrink-0">
            <Globe className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              9. Ricerca Web
              <Badge className="bg-cyan-500/20 text-cyan-500 border-cyan-500/30 text-xs">web_search</Badge>
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Non interroga il DB.</span> Usa Gemini AI con
              <span className="font-medium text-foreground"> Google Search integrato</span> per cercare informazioni aggiornate su internet.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 dark:bg-muted/20 border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                <Globe className="h-3.5 w-3.5" />
                Ricerca esterna
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pl-5">
                <p><span className="font-medium text-foreground">Input:</span> Query di ricerca (dall'istruzione del task o parametri)</p>
                <p><span className="font-medium text-foreground">Produce:</span> Risultati di ricerca, fonti web con URL, query utilizzate, metadati di grounding</p>
                <p><span className="font-medium text-foreground">Scopo:</span> Trovare normative, tendenze, notizie e dati di settore aggiornati</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Riepilogo accessi al database</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Table2 className="h-3 w-3 text-teal-500" />
                  users — Lettura
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Table2 className="h-3 w-3 text-teal-500" />
                  ai_scheduled_tasks — Lettura + Scrittura
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Table2 className="h-3 w-3 text-emerald-500" />
                  scheduled_voice_calls — Scrittura
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  Gemini AI — 5 step
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Search className="h-3 w-3 text-amber-500" />
                  File Search — Ricerca semantica
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Globe className="h-3 w-3 text-cyan-500" />
                  Google Search — 1 step
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default DataCatalogTab;
