import React from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Target, BarChart3, Phone, CheckCircle, AlertTriangle,
  ArrowRight, Lightbulb, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tryParseJSON, renderFormattedText } from "./utils";

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
    sections.push(
      <div key="report" className="space-y-8">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          {report.title || "Report"}
        </h3>
        {report.summary && (
          <p className="text-sm text-muted-foreground bg-primary/5 border border-primary/10 rounded-xl p-5 leading-[1.8] mb-4">
            {renderFormattedText(report.summary)}
          </p>
        )}
        {report.sections && Array.isArray(report.sections) && report.sections.map((section: any, i: number) => (
          <div key={i} className="space-y-3 mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">{section.heading}</h4>
            <p className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap mb-4">{renderFormattedText(section.content)}</p>
          </div>
        ))}
        {report.key_findings && Array.isArray(report.key_findings) && report.key_findings.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5 mt-6">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-4">🔑 Risultati Chiave</p>
            <ul className="space-y-3">
              {report.key_findings.map((finding: string, i: number) => (
                <li key={i} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-[1.8]">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{renderFormattedText(finding)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.recommendations && Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
          <div className="space-y-4 mt-6">
            <p className="text-sm font-semibold mb-3">💡 Raccomandazioni</p>
            {report.recommendations.map((rec: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5",
                  rec.priority === 'high' ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                  rec.priority === 'medium' ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                )}>
                  {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                </div>
                <div>
                  <p className="text-sm font-medium leading-[1.8]">{renderFormattedText(rec.action)}</p>
                  {rec.rationale && <p className="text-xs text-muted-foreground mt-2 leading-[1.75]">{renderFormattedText(rec.rationale)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {report.next_steps && Array.isArray(report.next_steps) && report.next_steps.length > 0 && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 mt-6">
            <p className="text-sm font-semibold text-primary mb-4">➡️ Prossimi Passi</p>
            <ol className="space-y-3 list-decimal list-inside">
              {report.next_steps.map((step: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground leading-[1.8]">{renderFormattedText(step)}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (analysis && typeof analysis === 'object' && !report) {
    sections.push(
      <div key="analysis" className="space-y-8">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analisi
        </h3>
        {analysis.client_profile_summary && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
            <p className="text-sm font-semibold mb-3">Profilo Cliente</p>
            <p className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap mb-4">{renderFormattedText(analysis.client_profile_summary)}</p>
          </div>
        )}
        {analysis.strengths && Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3">💪 Punti di Forza</p>
            <ul className="space-y-3">
              {analysis.strengths.map((s: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  <span>{renderFormattedText(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknesses && Array.isArray(analysis.weaknesses) && analysis.weaknesses.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">⚠️ Aree di Miglioramento</p>
            <ul className="space-y-3">
              {analysis.weaknesses.map((w: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{renderFormattedText(w)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.opportunities && Array.isArray(analysis.opportunities) && analysis.opportunities.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary mb-3">🚀 Opportunità</p>
            <ul className="space-y-3">
              {analysis.opportunities.map((o: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>{renderFormattedText(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.behavioral_patterns && Array.isArray(analysis.behavioral_patterns) && analysis.behavioral_patterns.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">📊 Pattern Comportamentali</p>
            <ul className="space-y-3">
              {analysis.behavioral_patterns.map((p: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <span className="text-muted-foreground/60">•</span>
                  <span>{renderFormattedText(p)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.past_consultation_insights && Array.isArray(analysis.past_consultation_insights) && analysis.past_consultation_insights.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">📋 Insight dalle Consulenze Passate</p>
            <ul className="space-y-3">
              {analysis.past_consultation_insights.map((ins: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
                  <span>{renderFormattedText(ins)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.insights && Array.isArray(analysis.insights) && (
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-3">💡 Insight</p>
            <ul className="space-y-3">
              {analysis.insights.map((insight: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-[1.8]">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{renderFormattedText(insight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.risk_assessment && (
          <div className={cn(
            "rounded-xl p-5 border",
            analysis.risk_assessment.level === 'high' ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50" :
            analysis.risk_assessment.level === 'medium' ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50" :
            "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
          )}>
            <p className="text-sm font-semibold mb-3">
              {analysis.risk_assessment.level === 'high' ? '🔴' : analysis.risk_assessment.level === 'medium' ? '🟡' : '🟢'} Valutazione Rischio: {analysis.risk_assessment.level === 'high' ? 'Alto' : analysis.risk_assessment.level === 'medium' ? 'Medio' : 'Basso'}
            </p>
            <p className="text-sm text-muted-foreground leading-[1.8]">{renderFormattedText(analysis.risk_assessment.description)}</p>
          </div>
        )}
        {analysis.suggested_approach && (
          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <p className="text-sm font-semibold mb-3">Approccio Suggerito</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-[1.85]">{renderFormattedText(analysis.suggested_approach)}</p>
          </div>
        )}
      </div>
    );
  }

  if (webSearch && typeof webSearch === 'object') {
    sections.push(
      <div key="websearch" className="space-y-7">
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
          🌐 Ricerca Web
        </h3>
        {webSearch.findings && (
          <div className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap bg-muted/30 rounded-xl p-5 border border-border mb-4">
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
        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
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
    <div className="space-y-8">
      <Separator />
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Risultati Deep Research
      </h3>
      {sections}
    </div>
  );
}

export default DeepResearchResults;
