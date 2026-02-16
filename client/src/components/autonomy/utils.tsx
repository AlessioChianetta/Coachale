import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Brain, CheckCircle, AlertCircle, Phone, Mail, BarChart3,
  Activity, XCircle, Loader2, Minus
} from "lucide-react";
import type { AITask } from "./types";

export function getAutonomyLabel(level: number): { label: string; color: string; description: string } {
  if (level === 0) return { label: "Disattivato", color: "text-muted-foreground", description: "Il dipendente AI è completamente disattivato. Non eseguirà alcuna azione." };
  if (level === 1) return { label: "Solo manuale", color: "text-emerald-600", description: "Modalità manuale: puoi creare task per l'AI, che li eseguirà solo quando programmati. Nessuna azione autonoma." };
  if (level <= 3) return { label: "Proposte", color: "text-emerald-600", description: "L'AI può eseguire task programmati autonomamente durante l'orario di lavoro, ma solo nelle categorie abilitate. Ti notifica ogni azione." };
  if (level <= 6) return { label: "Semi-autonomo", color: "text-amber-600", description: "L'AI esegue task di routine autonomamente e può proporre nuove azioni. Chiede approvazione per decisioni importanti come chiamate e email." };
  if (level <= 9) return { label: "Quasi autonomo", color: "text-orange-600", description: "L'AI opera in modo indipendente: analizza, decide e agisce. Ti notifica solo per situazioni critiche o fuori dalla norma." };
  return { label: "Autonomia completa", color: "text-red-600", description: "L'AI gestisce tutto autonomamente entro i limiti configurati. Agisce senza approvazione su tutte le categorie e canali abilitati." };
}

export function getAutonomyBadgeColor(level: number): string {
  if (level === 0) return "bg-muted text-muted-foreground";
  if (level <= 3) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
  if (level <= 6) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
  if (level <= 9) return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800";
}

export function getActivityIcon(icon: string) {
  const iconMap: Record<string, React.ReactNode> = {
    brain: <Brain className="h-4 w-4" />,
    check: <CheckCircle className="h-4 w-4" />,
    alert: <AlertCircle className="h-4 w-4" />,
    phone: <Phone className="h-4 w-4" />,
    mail: <Mail className="h-4 w-4" />,
    chart: <BarChart3 className="h-4 w-4" />,
  };
  return iconMap[icon] || <Activity className="h-4 w-4" />;
}

export function getSeverityBadge(severity: string) {
  const config: Record<string, { className: string; label: string }> = {
    info: { className: "bg-primary/10 text-primary border-primary/20", label: "Info" },
    success: { className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400", label: "Successo" },
    warning: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400", label: "Avviso" },
    error: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400", label: "Errore" },
  };
  const c = config[severity];
  if (c) return <Badge className={c.className}>{c.label}</Badge>;
  return <Badge variant="secondary">{severity}</Badge>;
}

export function getTaskStatusBadge(status: string) {
  const config: Record<string, { className: string; label: string }> = {
    scheduled: { className: "bg-primary/10 text-primary border-primary/20", label: "Attivo" },
    in_progress: { className: "bg-primary/10 text-primary border-primary/20", label: "Attivo" },
    approved: { className: "bg-primary/10 text-primary border-primary/20", label: "Attivo" },
    completed: { className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400", label: "Completato" },
    failed: { className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400", label: "Fallito" },
    paused: { className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400", label: "In pausa" },
    draft: { className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400", label: "Bozza" },
    waiting_approval: { className: "bg-primary/10 text-primary border-primary/20", label: "Da approvare" },
    deferred: { className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400", label: "Rimandato" },
  };
  const c = config[status];
  if (c) return <Badge className={c.className}>{c.label}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    outreach: "Contatto",
    analysis: "Analisi",
    report: "Report",
    followup: "Follow-up",
    research: "Ricerca",
    preparation: "Preparazione",
    monitoring: "Monitoraggio",
    reminder: "Promemoria",
  };
  return map[category] || category;
}

export function getCategoryBadge(category: string) {
  return <Badge variant="outline" className="text-xs">{getCategoryLabel(category)}</Badge>;
}

export function getPriorityIndicator(priority: number) {
  if (priority === 1) return <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 text-xs">Alta</Badge>;
  if (priority === 2) return <Badge className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 text-xs">Media-Alta</Badge>;
  if (priority === 3) return <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 text-xs">Media</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-xs">Bassa</Badge>;
}

export function getStepStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "skipped":
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

export function getStepActionLabel(action: string): string {
  const labels: Record<string, string> = {
    fetch_client_data: "📊 Raccolta dati cliente",
    analyze_patterns: "🔍 Analisi pattern e trend",
    generate_report: "📝 Generazione report",
    prepare_call: "📞 Preparazione chiamata",
    voice_call: "🗣️ Chiamata vocale",
    send_email: "📧 Invio email",
    send_whatsapp: "💬 Invio WhatsApp",
    web_search: "🌐 Ricerca web",
    search_private_stores: "🔒 Ricerca documenti privati",
  };
  return labels[action] || action;
}

export function tryParseJSON(value: any): any {
  if (typeof value !== 'string') return value;
  let cleaned = value.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return value;
  }
}

export function renderFormattedText(text: any): React.ReactNode {
  if (typeof text !== 'string') return text;
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const processItalicAndBreaks = (str: string, keyPrefix: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const italicRegex = /\*(.+?)\*/g;
    let iLastIndex = 0;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = italicRegex.exec(str)) !== null) {
      if (iMatch.index > iLastIndex) {
        const before = str.slice(iLastIndex, iMatch.index);
        before.split('\n').forEach((line, li, arr) => {
          result.push(<React.Fragment key={`${keyPrefix}-t-${iLastIndex}-${li}`}>{line}</React.Fragment>);
          if (li < arr.length - 1) result.push(<br key={`${keyPrefix}-br-${iLastIndex}-${li}`} />);
        });
      }
      result.push(<em key={`${keyPrefix}-em-${iMatch.index}`}>{iMatch[1]}</em>);
      iLastIndex = iMatch.index + iMatch[0].length;
    }
    if (iLastIndex < str.length) {
      const remaining = str.slice(iLastIndex);
      remaining.split('\n').forEach((line, li, arr) => {
        result.push(<React.Fragment key={`${keyPrefix}-t-${iLastIndex}-${li}`}>{line}</React.Fragment>);
        if (li < arr.length - 1) result.push(<br key={`${keyPrefix}-br-${iLastIndex}-${li}`} />);
      });
    }
    return result;
  };
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processItalicAndBreaks(text.slice(lastIndex, match.index), `p-${lastIndex}`));
    }
    parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(...processItalicAndBreaks(text.slice(lastIndex), `p-${lastIndex}`));
  }
  return <>{parts}</>;
}

export function cleanBoldMarkers(text: string): string {
  if (typeof text !== 'string') return String(text || '');
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

export function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
  return date.toLocaleDateString("it-IT");
}

export function getRoleBadgeClass(role: string): string {
  const roleColors: Record<string, string> = {
    alessia: "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400",
    millie: "border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400",
    echo: "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400",
    nova: "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400",
    stella: "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400",
    iris: "border-teal-300 text-teal-600 dark:border-teal-700 dark:text-teal-400",
    marco: "border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400",
  };
  return roleColors[role] || "border-muted-foreground/30 text-muted-foreground";
}

export async function generateTaskPDF(task: AITask) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNum = 1;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 25) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.addPage();
      pageNum++;
      y = margin;
    }
  };

  const addText = (text: string, fontSize: number, options?: { bold?: boolean; color?: [number, number, number]; maxWidth?: number; lineHeight?: number }) => {
    const cleaned = cleanBoldMarkers(text);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    if (options?.color) doc.setTextColor(...options.color);
    else doc.setTextColor(40, 40, 40);
    const w = options?.maxWidth || contentWidth;
    const lines = doc.splitTextToSize(cleaned, w);
    const lh = options?.lineHeight || fontSize * 0.5;
    for (const line of lines) {
      checkPageBreak(lh);
      doc.text(line, margin, y);
      y += lh;
    }
  };

  const addSpacer = (h: number) => { y += h; };

  const parsedResults: Record<string, any> = {};
  if (task.result_data?.results) {
    for (const key of Object.keys(task.result_data.results)) {
      parsedResults[key] = tryParseJSON(task.result_data.results[key]);
    }
  }

  const report = parsedResults.generate_report;
  const analysis = parsedResults.analyze_patterns;
  const webSearch = parsedResults.web_search;

  const title = report?.title || task.ai_instruction || 'Report AI';
  const contactName = task.contact_name || '';
  const dateStr = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(cleanBoldMarkers(title), contentWidth);
  let titleY = 18;
  for (const line of titleLines) {
    doc.text(line, margin, titleY);
    titleY += 8;
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 220);
  const headerInfo = [contactName && `Cliente: ${contactName}`, `Data: ${dateStr}`].filter(Boolean).join('  |  ');
  doc.text(headerInfo, margin, Math.max(titleY + 2, 38));
  y = 55;

  if (report && typeof report === 'object') {
    if (report.summary) {
      addText('Riepilogo', 13, { bold: true, color: [30, 30, 30] });
      addSpacer(2);
      addText(report.summary, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(6);
    }
    if (report.sections && Array.isArray(report.sections)) {
      for (const section of report.sections) {
        checkPageBreak(15);
        addText(section.heading, 12, { bold: true, color: [30, 30, 30] });
        addSpacer(2);
        addText(section.content, 10, { color: [80, 80, 80], lineHeight: 4.5 });
        addSpacer(6);
      }
    }
    if (report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0) {
      checkPageBreak(15);
      addText('Risultati Chiave', 13, { bold: true, color: [30, 100, 30] });
      addSpacer(2);
      for (const finding of report.key_findings) {
        checkPageBreak(8);
        addText(`• ${finding}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(2);
      }
      addSpacer(4);
    }
    if (report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0) {
      checkPageBreak(15);
      addText('Raccomandazioni', 13, { bold: true, color: [30, 30, 130] });
      addSpacer(2);
      for (const rec of report.recommendations) {
        checkPageBreak(12);
        const priorityLabel = rec.priority === 'high' ? '[ALTA]' : rec.priority === 'medium' ? '[MEDIA]' : '[BASSA]';
        addText(`${priorityLabel} ${rec.action}`, 10, { bold: true, color: [40, 40, 40] });
        if (rec.rationale) {
          addText(rec.rationale, 9, { color: [100, 100, 100], lineHeight: 4 });
        }
        addSpacer(3);
      }
      addSpacer(4);
    }
    if (report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0) {
      checkPageBreak(15);
      addText('Prossimi Passi', 13, { bold: true, color: [30, 80, 130] });
      addSpacer(2);
      report.next_steps.forEach((step: string, i: number) => {
        checkPageBreak(8);
        addText(`${i + 1}. ${step}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(2);
      });
      addSpacer(4);
    }
  }

  if (webSearch && typeof webSearch === 'object') {
    checkPageBreak(15);
    doc.setFillColor(240, 245, 255);
    const boxHeight = (webSearch.findings ? 25 : 8) + (webSearch.sources?.length || 0) * 8;
    doc.rect(margin - 2, y - 3, contentWidth + 4, boxHeight, 'F');
    addText('Ricerca Web', 13, { bold: true, color: [30, 30, 130] });
    addSpacer(3);
    if (webSearch.findings) {
      addText(webSearch.findings, 10.5, { color: [80, 80, 80], lineHeight: 5 });
      addSpacer(5);
    }
    if (webSearch.sources && Array.isArray(webSearch.sources) && webSearch.sources.length > 0) {
      addText('Fonti:', 11, { bold: true, color: [40, 40, 40] });
      addSpacer(2);
      for (const source of webSearch.sources) {
        checkPageBreak(6);
        addText(`• ${source.title || source.url}`, 10, { color: [40, 80, 160] });
        if (source.url && source.title) {
          addText(`  ${source.url}`, 9, { color: [120, 120, 120] });
        }
        addSpacer(3);
      }
      addSpacer(4);
    }
  }

  if (analysis && typeof analysis === 'object' && !report) {
    checkPageBreak(15);
    addText('Analisi', 13, { bold: true, color: [30, 30, 30] });
    addSpacer(2);
    if (analysis.client_profile_summary) {
      addText('Profilo Cliente', 11, { bold: true });
      addSpacer(2);
      addText(analysis.client_profile_summary, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }
    const listSections: Array<{ label: string; items: string[]; color: [number, number, number] }> = [];
    if (analysis.strengths?.length) listSections.push({ label: 'Punti di Forza', items: analysis.strengths, color: [30, 120, 30] });
    if (analysis.weaknesses?.length) listSections.push({ label: 'Aree di Miglioramento', items: analysis.weaknesses, color: [180, 100, 30] });
    if (analysis.opportunities?.length) listSections.push({ label: 'Opportunità', items: analysis.opportunities, color: [30, 80, 160] });
    if (analysis.behavioral_patterns?.length) listSections.push({ label: 'Pattern Comportamentali', items: analysis.behavioral_patterns, color: [80, 80, 80] });
    if (analysis.insights?.length) listSections.push({ label: 'Insight', items: analysis.insights, color: [130, 100, 30] });
    for (const sec of listSections) {
      checkPageBreak(12);
      addText(sec.label, 11, { bold: true, color: sec.color });
      addSpacer(2);
      for (const item of sec.items) {
        checkPageBreak(8);
        addText(`• ${item}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(1);
      }
      addSpacer(4);
    }
    if (analysis.risk_assessment) {
      checkPageBreak(12);
      const riskLabel = analysis.risk_assessment.level === 'high' ? 'Alto' : analysis.risk_assessment.level === 'medium' ? 'Medio' : 'Basso';
      addText(`Valutazione Rischio: ${riskLabel}`, 11, { bold: true, color: analysis.risk_assessment.level === 'high' ? [180, 30, 30] : analysis.risk_assessment.level === 'medium' ? [180, 150, 30] : [30, 130, 30] });
      addSpacer(2);
      addText(analysis.risk_assessment.description, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }
    if (analysis.suggested_approach) {
      checkPageBreak(12);
      addText('Approccio Suggerito', 11, { bold: true });
      addSpacer(2);
      addText(analysis.suggested_approach, 10, { color: [80, 80, 80], lineHeight: 4.5 });
      addSpacer(4);
    }
    if (analysis.recommendations?.length) {
      checkPageBreak(12);
      addText('Raccomandazioni', 11, { bold: true, color: [30, 30, 130] });
      addSpacer(2);
      for (const rec of analysis.recommendations) {
        checkPageBreak(6);
        addText(`• ${typeof rec === 'string' ? rec : rec.action || JSON.stringify(rec)}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        addSpacer(1);
      }
      addSpacer(4);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  const safeName = (contactName || 'task').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileDate = task.completed_at
    ? new Date(task.completed_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  doc.save(`report_${safeName}_${fileDate}.pdf`);
}
