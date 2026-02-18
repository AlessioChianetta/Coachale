import React from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Target, BarChart3, Phone, CheckCircle, AlertTriangle,
  ArrowRight, Lightbulb, Sparkles, Square, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tryParseJSON, renderFormattedText } from "./utils";

function extractMetrics(findings: string[]): Array<{ value: string; label: string }> {
  const metrics: Array<{ value: string; label: string }> = [];
  for (const finding of findings) {
    const matches = finding.match(/(\d+[\.,]?\d*\s*%|\€\s*\d+[\.,]?\d*[kKmM]?|\d+[\.,]?\d*\s*(?:euro|EUR|clienti|mesi|giorni|ore|vendite|ordini|contatti|leads|chiamate|email|sessioni|utenti))/gi);
    if (matches && matches.length > 0) {
      const value = matches[0].trim();
      const label = finding.length > 60 ? finding.substring(0, 57) + '...' : finding;
      metrics.push({ value, label });
    }
  }
  return metrics.slice(0, 4);
}

function DeepResearchResults({ results }: { results: Record<string, any> }) {
  const sections: React.ReactNode[] = [];

  const parsedResults = { ...results };
  for (const key of Object.keys(parsedResults)) {
    parsedResults[key] = tryParseJSON(parsedResults[key]);
  }
  const report = parsedResults.generate_report;
  const analysis = parsedResults.analyze_patterns;
  const webSearch = parsedResults.web_search;
  const callPrep = parsedResults.prepare_call;

  if (report && typeof report === 'object') {
    const metrics = report.key_findings && Array.isArray(report.key_findings)
      ? extractMetrics(report.key_findings)
      : [];

    sections.push(
      <div key="report" className="space-y-10">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4 leading-tight">
            {report.title || "Report"}
          </h3>
          {report.summary && (
            <div className="bg-muted/40 border border-border rounded-xl p-5">
              <p className="text-sm text-muted-foreground leading-[1.9] line-clamp-5">
                {renderFormattedText(report.summary)}
              </p>
            </div>
          )}
        </div>

        {(report.sections || metrics.length > 0) && (
          <div className={cn(
            metrics.length > 0
              ? "grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6"
              : ""
          )}>
            <div className="space-y-4">
              {report.sections && Array.isArray(report.sections) && report.sections.map((section: any, i: number) => (
                <details key={i} className="group rounded-xl border border-border bg-card overflow-hidden">
                  <summary className="cursor-pointer select-none flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <h4 className="text-sm font-semibold text-foreground">{section.heading}</h4>
                    <span className="text-xs text-primary font-medium opacity-0 group-open:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Approfondisci
                    </span>
                  </summary>
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-sm text-muted-foreground leading-[1.9] whitespace-pre-wrap">
                      {renderFormattedText(section.content)}
                    </p>
                  </div>
                </details>
              ))}
            </div>

            {metrics.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Metriche Chiave</p>
                {metrics.map((m, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-1">
                    <p className="text-lg font-bold text-primary leading-tight">{m.value}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{m.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">🔑 Risultati Chiave</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.key_findings.map((finding: string, i: number) => (
                <div key={i} className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-foreground/90 leading-[1.8]">{renderFormattedText(finding)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">💡 Raccomandazioni</p>
            <div className="space-y-4">
              {report.recommendations.map((rec: any, i: number) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3 relative">
                  <div className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide",
                    rec.priority === 'high' ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                    rec.priority === 'medium' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  )}>
                    {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-[1.8]">{renderFormattedText(rec.action)}</p>
                  {rec.rationale && (
                    <p className="text-sm text-muted-foreground leading-[1.8]">{renderFormattedText(rec.rationale)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">➡️ Prossimi Passi</p>
            <div className="space-y-2">
              {report.next_steps.map((step: string, i: number) => (
                <div key={i} className="flex items-start gap-3 py-3 px-4 rounded-xl border-l-2 border-l-primary/30 bg-muted/20">
                  <Square className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                  <span className="text-xs font-bold text-muted-foreground/60 mt-0.5 shrink-0 w-5">{i + 1}.</span>
                  <span className="text-sm text-foreground/90 leading-[1.8]">{renderFormattedText(step)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (analysis && typeof analysis === 'object' && !report) {
    sections.push(
      <div key="analysis" className="space-y-10">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analisi
        </h3>
        {analysis.client_profile_summary && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
            <p className="text-sm font-semibold mb-3">Profilo Cliente</p>
            <p className="text-sm text-muted-foreground leading-[1.9] whitespace-pre-wrap">{renderFormattedText(analysis.client_profile_summary)}</p>
          </div>
        )}
        {analysis.strengths && Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">💪 Punti di Forza</p>
            <ul className="space-y-3">
              {analysis.strengths.map((s: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  <span>{renderFormattedText(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknesses && Array.isArray(analysis.weaknesses) && analysis.weaknesses.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Aree di Miglioramento</p>
            <ul className="space-y-3">
              {analysis.weaknesses.map((w: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{renderFormattedText(w)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.opportunities && Array.isArray(analysis.opportunities) && analysis.opportunities.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary">🚀 Opportunità</p>
            <ul className="space-y-3">
              {analysis.opportunities.map((o: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>{renderFormattedText(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.behavioral_patterns && Array.isArray(analysis.behavioral_patterns) && analysis.behavioral_patterns.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">📊 Pattern Comportamentali</p>
            <ul className="space-y-3">
              {analysis.behavioral_patterns.map((p: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{renderFormattedText(p)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.past_consultation_insights && Array.isArray(analysis.past_consultation_insights) && analysis.past_consultation_insights.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">📋 Insight dalle Consulenze Passate</p>
            <ul className="space-y-3">
              {analysis.past_consultation_insights.map((ins: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
                  <span>{renderFormattedText(ins)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.insights && Array.isArray(analysis.insights) && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">💡 Insight</p>
            <ul className="space-y-3">
              {analysis.insights.map((insight: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.9]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{renderFormattedText(insight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.risk_assessment && (
          <div className={cn(
            "rounded-xl p-6 border-2",
            analysis.risk_assessment.level === 'high' ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800/60" :
            analysis.risk_assessment.level === 'medium' ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60" :
            "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60"
          )}>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold",
                analysis.risk_assessment.level === 'high' ? "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                analysis.risk_assessment.level === 'medium' ? "bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" :
                "bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
              )}>
                {analysis.risk_assessment.level === 'high' ? '🔴 Rischio Alto' :
                 analysis.risk_assessment.level === 'medium' ? '🟡 Rischio Medio' :
                 '🟢 Rischio Basso'}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-[1.9]">{renderFormattedText(analysis.risk_assessment.description)}</p>
          </div>
        )}
        {analysis.suggested_approach && (
          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <p className="text-sm font-semibold mb-3">Approccio Suggerito</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-[1.9]">{renderFormattedText(analysis.suggested_approach)}</p>
          </div>
        )}
      </div>
    );
  }

  if (webSearch && typeof webSearch === 'object') {
    sections.push(
      <div key="websearch" className="space-y-7">
        <h3 className="text-lg font-bold flex items-center gap-2">
          🌐 Ricerca Web
        </h3>
        {webSearch.findings && (
          <div className="text-sm text-muted-foreground leading-[1.9] whitespace-pre-wrap bg-muted/30 rounded-xl p-5 border border-border">
            {renderFormattedText(webSearch.findings)}
          </div>
        )}
        {webSearch.sources && Array.isArray(webSearch.sources) && webSearch.sources.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3">Fonti</p>
            <div className="space-y-2">
              {webSearch.sources.map((source: any, i: number) => (
                <a key={i} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <ArrowRight className="h-3 w-3" />
                  {source.title || source.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (callPrep && typeof callPrep === 'object') {
    sections.push(
      <div key="callprep" className="space-y-7">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Preparazione Chiamata
        </h3>
        {callPrep.opening_script && (
          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Apertura</p>
            <p className="text-sm italic leading-[1.8]">"{renderFormattedText(callPrep.opening_script)}"</p>
          </div>
        )}
        {callPrep.talking_points && Array.isArray(callPrep.talking_points) && (
          <div className="space-y-4">
            <p className="text-sm font-semibold mb-3">Punti di Discussione</p>
            {callPrep.talking_points.map((tp: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm font-medium leading-[1.8]">{renderFormattedText(tp.topic)}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-[1.75]">{renderFormattedText(tp.key_message)}</p>
                {tp.supporting_details && <p className="text-xs text-muted-foreground mt-2 italic leading-[1.75]">{renderFormattedText(tp.supporting_details)}</p>}
              </div>
            ))}
          </div>
        )}
        {callPrep.closing_script && (
          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Chiusura</p>
            <p className="text-sm italic leading-[1.8]">"{renderFormattedText(callPrep.closing_script)}"</p>
          </div>
        )}
      </div>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-10">
      {sections}
    </div>
  );
}

export default DeepResearchResults;
