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
    waiting_input: { className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs", label: "⏸️ In Attesa Input" },
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
  if (priority === 2) return <Badge className="bg-orange-50/60 text-orange-600/80 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400/70 text-[11px]">Media-Alta</Badge>;
  if (priority === 3) return <Badge className="bg-muted/50 text-muted-foreground/70 border-border/40 text-[11px]">Media</Badge>;
  return <Badge className="bg-muted/30 text-muted-foreground/50 border-border/30 text-[11px]">Bassa</Badge>;
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

function parseTaskResults(task: AITask): Record<string, any> {
  const parsedResults: Record<string, any> = {};
  if (task.result_data?.results) {
    for (const key of Object.keys(task.result_data.results)) {
      parsedResults[key] = tryParseJSON(task.result_data.results[key]);
    }
  }
  return parsedResults;
}

function getFilePrefix(docType: string): string {
  const prefixMap: Record<string, string> = {
    contract: 'contratto_',
    market_research: 'ricerca_',
    guide: 'guida_',
    strategic_report: 'report_',
    dossier: 'dossier_',
    brief: 'brief_',
    analysis: 'analisi_',
  };
  return prefixMap[docType] || 'report_';
}

export async function generateTaskPDF(task: AITask) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 22;
  const marginRight = 22;
  const marginBottom = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  const parsedResults = parseTaskResults(task);
  const report = parsedResults.generate_report;
  const analysis = parsedResults.analyze_patterns;
  const webSearch = parsedResults.web_search;
  const formalDoc = report?.formal_document;
  const docType: string = report?.document_type || formalDoc?.type || 'strategic_report';

  const contactName = task.contact_name || '';
  const dateStr = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const title = formalDoc?.header?.title || report?.title || task.ai_instruction || 'Report AI';
  const subtitle = formalDoc?.header?.subtitle || '';
  const parties = formalDoc?.header?.parties || '';
  const refNumber = formalDoc?.header?.reference || '';

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = 20;
    }
  };

  const addText = (text: string, fontSize: number, options?: {
    bold?: boolean; italic?: boolean; color?: [number, number, number];
    maxWidth?: number; lineHeight?: number; x?: number;
  }) => {
    const cleaned = cleanBoldMarkers(text);
    doc.setFontSize(fontSize);
    const fontStyle = options?.bold && options?.italic ? 'bolditalic' : options?.bold ? 'bold' : options?.italic ? 'italic' : 'normal';
    doc.setFont('helvetica', fontStyle);
    if (options?.color) doc.setTextColor(...options.color);
    else doc.setTextColor(40, 40, 40);
    const xPos = options?.x || marginLeft;
    const w = options?.maxWidth || (contentWidth - (xPos - marginLeft));
    const lines = doc.splitTextToSize(cleaned, w);
    const lh = options?.lineHeight || 5;
    for (const line of lines) {
      checkPageBreak(lh);
      doc.text(line, xPos, y);
      y += lh;
    }
  };

  const addSpacer = (h: number) => { y += h; };

  const drawHeader = () => {
    const cleanTitle = cleanBoldMarkers(title);
    const titleLines = doc.splitTextToSize(cleanTitle, contentWidth - 40);
    const headerHeight = Math.max(48, 20 + titleLines.length * 8 + (subtitle ? 8 : 0) + (parties || contactName ? 8 : 0));

    doc.setFillColor(20, 30, 50);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let titleY = 18;
    for (const line of titleLines) {
      doc.text(line, marginLeft, titleY);
      titleY += 8;
    }

    if (subtitle) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 185, 200);
      doc.text(cleanBoldMarkers(subtitle), marginLeft, titleY);
      titleY += 7;
    }

    const infoLine = [parties, contactName && `Cliente: ${contactName}`].filter(Boolean).join('  |  ');
    if (infoLine) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 185, 200);
      doc.text(infoLine, marginLeft, titleY);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 165, 180);
    doc.text(dateStr, pageWidth - marginRight, 18, { align: 'right' });
    if (refNumber) {
      doc.text(`Rif. ${refNumber}`, pageWidth - marginRight, 25, { align: 'right' });
    }

    y = headerHeight + 10;
  };

  const addPageNumbers = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('Riservato e Confidenziale', marginLeft, pageHeight - 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Pagina ${i} di ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      doc.text(dateStr, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
    }
  };

  const renderContract = (fd: any) => {
    const body = fd.body || [];
    for (let idx = 0; idx < body.length; idx++) {
      const item = body[idx];
      checkPageBreak(20);

      if (idx > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        addSpacer(6);
      }

      if (item.type === 'article') {
        const artTitle = `Art. ${item.number || idx + 1} - ${cleanBoldMarkers(item.title || '')}`;
        addText(artTitle, 12, { bold: true, color: [20, 40, 100] });
        addSpacer(3);
        if (item.content) {
          addText(item.content, 10.5, { color: [40, 40, 40], lineHeight: 5, x: marginLeft + 5 });
          addSpacer(3);
        }
        if (item.subsections && Array.isArray(item.subsections)) {
          for (const sub of item.subsections) {
            checkPageBreak(12);
            const subTitle = `${sub.number || ''} ${cleanBoldMarkers(sub.title || '')}`.trim();
            addText(subTitle, 11, { bold: true, color: [40, 50, 80], x: marginLeft + 5 });
            addSpacer(2);
            if (sub.content) {
              addText(sub.content, 10.5, { color: [40, 40, 40], lineHeight: 5, x: marginLeft + 5 });
              addSpacer(3);
            }
          }
        }
      } else {
        if (item.title) {
          addText(cleanBoldMarkers(item.title), 12, { bold: true, color: [20, 40, 100] });
          addSpacer(3);
        }
        if (item.content) {
          addText(item.content, 10.5, { color: [40, 40, 40], lineHeight: 5 });
          addSpacer(3);
        }
      }
      addSpacer(4);
    }
  };

  const renderSignatures = (footer: any) => {
    checkPageBreak(40);
    addSpacer(10);
    addText('FIRME', 13, { bold: true, color: [20, 30, 50] });
    addSpacer(8);

    const signatures = footer.signatures || [];
    for (const sig of signatures) {
      checkPageBreak(25);
      addText(sig.role || '', 10, { bold: true, color: [60, 60, 60] });
      addSpacer(2);
      addText(sig.name || '', 10, { color: [40, 40, 40] });
      addSpacer(3);
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, y, marginLeft + 60, y);
      addSpacer(8);
    }

    checkPageBreak(12);
    addSpacer(4);
    addText('Luogo e data: ____________________', 10, { color: [60, 60, 60] });
    addSpacer(6);
  };

  const renderNotes = (notes: string | string[]) => {
    checkPageBreak(15);
    addSpacer(6);
    const noteList = Array.isArray(notes) ? notes : [notes];
    for (const note of noteList) {
      addText(note, 8, { italic: true, color: [130, 130, 130], lineHeight: 3.5 });
      addSpacer(2);
    }
  };

  const renderMarketResearch = (fd: any) => {
    if (fd.executive_summary) {
      checkPageBreak(25);
      doc.setFillColor(235, 242, 255);
      const summaryLines = doc.splitTextToSize(cleanBoldMarkers(fd.executive_summary), contentWidth - 10);
      const boxH = summaryLines.length * 5 + 14;
      doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
      addText('Executive Summary', 12, { bold: true, color: [20, 50, 130] });
      addSpacer(3);
      addText(fd.executive_summary, 10.5, { color: [40, 40, 40], lineHeight: 5 });
      addSpacer(8);
    }

    const body = fd.body || [];
    body.forEach((item: any, idx: number) => {
      checkPageBreak(15);
      const heading = `${idx + 1}. ${cleanBoldMarkers(item.title || item.heading || '')}`;
      addText(heading, 13, { bold: true, color: [20, 50, 130] });
      addSpacer(3);
      if (item.content) {
        addText(item.content, 10.5, { color: [40, 40, 40], lineHeight: 5 });
        addSpacer(3);
      }
      if (item.key_data) {
        addText(item.key_data, 11, { bold: true, color: [30, 30, 30], lineHeight: 5 });
        addSpacer(3);
      }
      addSpacer(5);
    });

    if (fd.sources && Array.isArray(fd.sources) && fd.sources.length > 0) {
      checkPageBreak(15);
      addText('Fonti', 13, { bold: true, color: [20, 50, 130] });
      addSpacer(3);
      for (const source of fd.sources) {
        checkPageBreak(8);
        const srcText = typeof source === 'string' ? source : (source.title || source.url || JSON.stringify(source));
        addText(`• ${srcText}`, 9.5, { color: [40, 80, 160], lineHeight: 4.5 });
        if (typeof source === 'object' && source.url && source.title) {
          addText(`  ${source.url}`, 8.5, { color: [120, 120, 120], lineHeight: 3.5 });
        }
        addSpacer(2);
      }
    }
  };

  const renderGuide = (fd: any) => {
    if (fd.prerequisites) {
      checkPageBreak(20);
      doc.setFillColor(255, 252, 235);
      const prereqText = Array.isArray(fd.prerequisites) ? fd.prerequisites.join('\n') : String(fd.prerequisites);
      const prereqLines = doc.splitTextToSize(cleanBoldMarkers(prereqText), contentWidth - 10);
      const boxH = prereqLines.length * 5 + 14;
      doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
      addText('Prerequisiti', 12, { bold: true, color: [130, 100, 20] });
      addSpacer(3);
      addText(prereqText, 10.5, { color: [40, 40, 40], lineHeight: 5 });
      addSpacer(8);
    }

    const body = fd.body || [];
    body.forEach((item: any, idx: number) => {
      checkPageBreak(20);
      const stepNum = item.number || idx + 1;

      doc.setFillColor(20, 80, 160);
      doc.circle(marginLeft + 4, y - 1, 4, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(stepNum), marginLeft + 4, y + 0.5, { align: 'center' });

      const stepTitle = cleanBoldMarkers(item.title || '');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(stepTitle, marginLeft + 12, y);
      addSpacer(7);

      if (item.content) {
        addText(item.content, 10.5, { color: [40, 40, 40], lineHeight: 5, x: marginLeft + 12 });
        addSpacer(3);
      }
      addSpacer(5);
    });

    if (fd.tips || fd.notes) {
      const tipText = fd.tips || fd.notes;
      const tipContent = Array.isArray(tipText) ? tipText.join('\n') : String(tipText);
      checkPageBreak(20);
      doc.setFillColor(255, 250, 230);
      const tipLines = doc.splitTextToSize(cleanBoldMarkers(tipContent), contentWidth - 10);
      const boxH = tipLines.length * 5 + 14;
      doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
      addText('Note e Suggerimenti', 11, { bold: true, color: [130, 100, 20] });
      addSpacer(3);
      addText(tipContent, 10, { color: [60, 60, 40], lineHeight: 4.5 });
      addSpacer(6);
    }
  };

  const renderReport = (fd: any) => {
    if (fd.summary) {
      checkPageBreak(20);
      doc.setFillColor(245, 245, 248);
      const summaryLines = doc.splitTextToSize(cleanBoldMarkers(fd.summary), contentWidth - 10);
      const boxH = summaryLines.length * 5 + 14;
      doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
      addText('Riepilogo', 13, { bold: true, color: [30, 30, 30] });
      addSpacer(3);
      addText(fd.summary, 10.5, { color: [60, 60, 60], lineHeight: 5 });
      addSpacer(8);
    }

    const isDossierLike = ['dossier', 'brief', 'analysis'].includes(docType);
    const body = fd.body || [];
    body.forEach((item: any, idx: number) => {
      checkPageBreak(15);

      if (!isDossierLike) {
        doc.setFillColor(20, 80, 160);
        doc.rect(marginLeft - 1, y - 4, 1, 7, 'F');
      }

      const headingText = isDossierLike
        ? `${idx + 1}. ${cleanBoldMarkers(item.title || item.heading || '')}`
        : cleanBoldMarkers(item.title || item.heading || '');

      addText(headingText, 13, { bold: true, color: isDossierLike ? [20, 30, 60] : [30, 30, 30], x: isDossierLike ? marginLeft : marginLeft + 3 });
      addSpacer(3);
      if (item.content) {
        addText(item.content, 10.5, { color: [40, 40, 40], lineHeight: 5 });
        addSpacer(3);
      }
      addSpacer(5);
    });

    if (fd.key_findings && Array.isArray(fd.key_findings) && fd.key_findings.length > 0) {
      checkPageBreak(15);
      addText('Risultati Chiave', 13, { bold: true, color: [30, 100, 30] });
      addSpacer(3);
      for (const finding of fd.key_findings) {
        checkPageBreak(8);
        const findingText = typeof finding === 'string' ? finding : (finding.text || JSON.stringify(finding));
        doc.setFillColor(40, 160, 60);
        doc.circle(marginLeft + 1.5, y - 1.5, 1, 'F');
        addText(findingText, 10.5, { color: [40, 40, 40], lineHeight: 5, x: marginLeft + 6 });
        addSpacer(2);
      }
      addSpacer(5);
    }

    if (fd.recommendations && Array.isArray(fd.recommendations) && fd.recommendations.length > 0) {
      checkPageBreak(15);
      addText('Raccomandazioni', 13, { bold: true, color: [30, 30, 130] });
      addSpacer(3);
      fd.recommendations.forEach((rec: any, i: number) => {
        checkPageBreak(12);
        const recText = typeof rec === 'string' ? rec : (rec.action || rec.text || JSON.stringify(rec));
        const priority = typeof rec === 'object' ? rec.priority : '';
        const badge = priority === 'high' ? '[ALTA] ' : priority === 'medium' ? '[MEDIA] ' : priority === 'low' ? '[BASSA] ' : '';
        addText(`${i + 1}. ${badge}${cleanBoldMarkers(recText)}`, 10.5, { bold: !!badge, color: [40, 40, 40], lineHeight: 5 });
        if (typeof rec === 'object' && rec.rationale) {
          addText(rec.rationale, 9.5, { color: [100, 100, 100], lineHeight: 4.5 });
        }
        addSpacer(3);
      });
      addSpacer(5);
    }

    if (fd.next_steps && Array.isArray(fd.next_steps) && fd.next_steps.length > 0) {
      checkPageBreak(15);
      addText('Prossimi Passi', 13, { bold: true, color: [30, 80, 130] });
      addSpacer(3);
      fd.next_steps.forEach((step: any, i: number) => {
        checkPageBreak(8);
        const stepText = typeof step === 'string' ? step : (step.text || step.action || JSON.stringify(step));
        addText(`☐ ${cleanBoldMarkers(stepText)}`, 10.5, { color: [40, 40, 40], lineHeight: 5 });
        addSpacer(2);
      });
      addSpacer(5);
    }
  };

  const renderLegacyReport = (rep: any, allResults: Record<string, any>) => {
    const ws = allResults.web_search;
    const anal = allResults.analyze_patterns;

    if (rep && typeof rep === 'object') {
      if (rep.summary) {
        checkPageBreak(20);
        doc.setFillColor(245, 245, 248);
        const summaryLines = doc.splitTextToSize(cleanBoldMarkers(rep.summary), contentWidth - 10);
        const boxH = summaryLines.length * 5 + 14;
        doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
        addText('Riepilogo', 13, { bold: true, color: [30, 30, 30] });
        addSpacer(3);
        addText(rep.summary, 10.5, { color: [60, 60, 60], lineHeight: 5 });
        addSpacer(8);
      }
      if (rep.sections && Array.isArray(rep.sections)) {
        for (const section of rep.sections) {
          checkPageBreak(15);
          doc.setFillColor(20, 80, 160);
          doc.rect(marginLeft - 1, y - 4, 1, 7, 'F');
          addText(cleanBoldMarkers(section.heading || ''), 13, { bold: true, color: [30, 30, 30], x: marginLeft + 3 });
          addSpacer(3);
          if (section.content) {
            addText(section.content, 10.5, { color: [60, 60, 60], lineHeight: 5 });
          }
          addSpacer(6);
        }
      }
      if (rep.key_findings && Array.isArray(rep.key_findings) && rep.key_findings.length > 0) {
        checkPageBreak(15);
        addText('Risultati Chiave', 13, { bold: true, color: [30, 100, 30] });
        addSpacer(3);
        for (const finding of rep.key_findings) {
          checkPageBreak(8);
          doc.setFillColor(40, 160, 60);
          doc.circle(marginLeft + 1.5, y - 1.5, 1, 'F');
          addText(typeof finding === 'string' ? finding : JSON.stringify(finding), 10.5, { color: [40, 40, 40], lineHeight: 5, x: marginLeft + 6 });
          addSpacer(2);
        }
        addSpacer(5);
      }
      if (rep.recommendations && Array.isArray(rep.recommendations) && rep.recommendations.length > 0) {
        checkPageBreak(15);
        addText('Raccomandazioni', 13, { bold: true, color: [30, 30, 130] });
        addSpacer(3);
        for (const rec of rep.recommendations) {
          checkPageBreak(12);
          const priorityLabel = rec.priority === 'high' ? '[ALTA] ' : rec.priority === 'medium' ? '[MEDIA] ' : '[BASSA] ';
          const recAction = typeof rec === 'string' ? rec : (rec.action || JSON.stringify(rec));
          addText(`${priorityLabel}${cleanBoldMarkers(recAction)}`, 10.5, { bold: true, color: [40, 40, 40], lineHeight: 5 });
          if (typeof rec === 'object' && rec.rationale) {
            addText(rec.rationale, 9.5, { color: [100, 100, 100], lineHeight: 4.5 });
          }
          addSpacer(3);
        }
        addSpacer(5);
      }
      if (rep.next_steps && Array.isArray(rep.next_steps) && rep.next_steps.length > 0) {
        checkPageBreak(15);
        addText('Prossimi Passi', 13, { bold: true, color: [30, 80, 130] });
        addSpacer(3);
        rep.next_steps.forEach((step: string, i: number) => {
          checkPageBreak(8);
          addText(`${i + 1}. ${step}`, 10.5, { color: [40, 40, 40], lineHeight: 5 });
          addSpacer(2);
        });
        addSpacer(5);
      }
    }

    if (ws && typeof ws === 'object') {
      checkPageBreak(15);
      doc.setFillColor(240, 245, 255);
      const wsText = ws.findings || '';
      const wsLines = wsText ? doc.splitTextToSize(cleanBoldMarkers(wsText), contentWidth - 6) : [];
      const boxH = Math.max(15, wsLines.length * 5 + 14 + (ws.sources?.length || 0) * 8);
      doc.rect(marginLeft - 2, y - 3, contentWidth + 4, boxH, 'F');
      addText('Ricerca Web', 13, { bold: true, color: [30, 30, 130] });
      addSpacer(3);
      if (ws.findings) {
        addText(ws.findings, 10.5, { color: [60, 60, 60], lineHeight: 5 });
        addSpacer(5);
      }
      if (ws.sources && Array.isArray(ws.sources) && ws.sources.length > 0) {
        addText('Fonti:', 11, { bold: true, color: [40, 40, 40] });
        addSpacer(2);
        for (const source of ws.sources) {
          checkPageBreak(8);
          addText(`• ${source.title || source.url}`, 10, { color: [40, 80, 160] });
          if (source.url && source.title) {
            addText(`  ${source.url}`, 8.5, { color: [120, 120, 120], lineHeight: 3.5 });
          }
          addSpacer(3);
        }
      }
      addSpacer(5);
    }

    if (anal && typeof anal === 'object' && !rep) {
      checkPageBreak(15);
      addText('Analisi', 13, { bold: true, color: [30, 30, 30] });
      addSpacer(3);
      if (anal.client_profile_summary) {
        addText('Profilo Cliente', 11, { bold: true });
        addSpacer(2);
        addText(anal.client_profile_summary, 10.5, { color: [60, 60, 60], lineHeight: 5 });
        addSpacer(5);
      }
      const listSections: Array<{ label: string; items: string[]; color: [number, number, number] }> = [];
      if (anal.strengths?.length) listSections.push({ label: 'Punti di Forza', items: anal.strengths, color: [30, 120, 30] });
      if (anal.weaknesses?.length) listSections.push({ label: 'Aree di Miglioramento', items: anal.weaknesses, color: [180, 100, 30] });
      if (anal.opportunities?.length) listSections.push({ label: 'Opportunità', items: anal.opportunities, color: [30, 80, 160] });
      if (anal.behavioral_patterns?.length) listSections.push({ label: 'Pattern Comportamentali', items: anal.behavioral_patterns, color: [80, 80, 80] });
      if (anal.insights?.length) listSections.push({ label: 'Insight', items: anal.insights, color: [130, 100, 30] });
      for (const sec of listSections) {
        checkPageBreak(12);
        addText(sec.label, 11, { bold: true, color: sec.color });
        addSpacer(2);
        for (const item of sec.items) {
          checkPageBreak(8);
          addText(`• ${item}`, 10.5, { color: [40, 40, 40], lineHeight: 5 });
          addSpacer(1);
        }
        addSpacer(5);
      }
      if (anal.risk_assessment) {
        checkPageBreak(12);
        const riskLabel = anal.risk_assessment.level === 'high' ? 'Alto' : anal.risk_assessment.level === 'medium' ? 'Medio' : 'Basso';
        const riskColor: [number, number, number] = anal.risk_assessment.level === 'high' ? [180, 30, 30] : anal.risk_assessment.level === 'medium' ? [180, 150, 30] : [30, 130, 30];
        addText(`Valutazione Rischio: ${riskLabel}`, 11, { bold: true, color: riskColor });
        addSpacer(2);
        addText(anal.risk_assessment.description, 10.5, { color: [60, 60, 60], lineHeight: 5 });
        addSpacer(5);
      }
      if (anal.suggested_approach) {
        checkPageBreak(12);
        addText('Approccio Suggerito', 11, { bold: true });
        addSpacer(2);
        addText(anal.suggested_approach, 10.5, { color: [60, 60, 60], lineHeight: 5 });
        addSpacer(5);
      }
      if (anal.recommendations?.length) {
        checkPageBreak(12);
        addText('Raccomandazioni', 11, { bold: true, color: [30, 30, 130] });
        addSpacer(2);
        for (const rec of anal.recommendations) {
          checkPageBreak(6);
          addText(`• ${typeof rec === 'string' ? rec : rec.action || JSON.stringify(rec)}`, 10.5, { color: [40, 40, 40], lineHeight: 5 });
          addSpacer(1);
        }
        addSpacer(5);
      }
    }
  };

  drawHeader();

  if (formalDoc?.body) {
    switch (docType) {
      case 'contract':
        renderContract(formalDoc);
        break;
      case 'market_research':
        renderMarketResearch(formalDoc);
        break;
      case 'guide':
        renderGuide(formalDoc);
        break;
      default:
        renderReport(formalDoc);
        break;
    }
    if (formalDoc.footer?.signatures) {
      renderSignatures(formalDoc.footer);
    }
    if (formalDoc.footer?.notes) {
      renderNotes(formalDoc.footer.notes);
    }
  } else {
    renderLegacyReport(report, parsedResults);
  }

  addPageNumbers();

  const safeName = (contactName || 'task').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileDate = task.completed_at
    ? new Date(task.completed_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const prefix = getFilePrefix(docType);
  doc.save(`${prefix}${safeName}_${fileDate}.pdf`);
}
