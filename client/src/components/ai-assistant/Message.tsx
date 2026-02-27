import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { ThinkingBubble } from "./ThinkingBubble";
import { CodeExecutionBlock } from "./CodeExecutionBlock";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface CodeExecution {
  language: string;
  code: string;
  outcome?: string;
  output?: string;
}

interface ChatAttachment {
  name: string;
  mimeType: string;
  base64Data: string;
  type: "image" | "document";
  preview?: string;
}

interface GeneratedFile {
  fileName: string;
  mimeType: string;
  data: string;
}

interface MessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "processing" | "completed" | "error";
    thinking?: string;
    isThinking?: boolean;
    modelName?: string;
    thinkingLevel?: string;
    attachments?: ChatAttachment[];
    generatedFiles?: GeneratedFile[];
    suggestedActions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
    codeExecutions?: CodeExecution[];
  };
  onActionClick?: (actionType?: string, actionData?: any) => void;
  assistantName?: string;
  assistantSubtitle?: string;
  assistantAvatarSrc?: string;
  assistantAvatarFallbackIcon?: React.ReactNode;
  compact?: boolean;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function isHtmlContent(text: string): boolean {
  const htmlTagsPattern = /<(p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|strong|em|br|hr)[^>]*>/gi;
  const matches = text.match(htmlTagsPattern);
  return matches !== null && matches.length > 3;
}

function sanitizeAndFormatHtml(html: string): string {
  let cleaned = html.replace(/<!--StartFragment-->|<!--EndFragment-->/g, '');
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6">$1</h1>');
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 mt-5">$1</h2>');
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-4">$1</h3>');
  cleaned = cleaned.replace(/<p[^>]*>/gi, '<p class="text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">');
  cleaned = cleaned.replace(/<strong[^>]*>/gi, '<strong class="font-bold text-gray-900 dark:text-white">');
  cleaned = cleaned.replace(/<em[^>]*>/gi, '<em class="italic text-gray-700 dark:text-gray-300">');
  cleaned = cleaned.replace(/<ul[^>]*>/gi, '<ul class="list-disc list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<ol[^>]*>/gi, '<ol class="list-decimal list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<li[^>]*>/gi, '<li class="text-gray-800 dark:text-gray-200">');
  cleaned = cleaned.replace(/<a\s+href="([^"]+)"[^>]*>/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">');
  return cleaned;
}

function preprocessContent(content: string): string {
  let processed = content
    .replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '')
    .replace(/\[\/ACTIONS\]/gi, '');

  processed = processed.replace(
    /^(💡|⚠️|ℹ️|✅|📊)\s*(.+)$/gm,
    (_, emoji, text) => `> ${emoji} ${text}`
  );

  return processed.trim();
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return '';
}

// ─── CUSTOM MARKDOWN COMPONENTS ──────────────────────────────────────────────

const INFO_BOX_CONFIG: Record<string, { bg: string; border: string; textColor: string; label: string }> = {
  '💡': { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-400', textColor: 'text-amber-900 dark:text-amber-100', label: 'Suggerimento' },
  '⚠️': { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-400', textColor: 'text-red-900 dark:text-red-100', label: 'Attenzione' },
  'ℹ️': { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-400', textColor: 'text-blue-900 dark:text-blue-100', label: 'Informazione' },
  '✅': { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-400', textColor: 'text-green-900 dark:text-green-100', label: 'Completato' },
  '📊': { bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-400', textColor: 'text-slate-700 dark:text-slate-300', label: 'Nota Analitica' },
};

const InfoBoxRenderer: Components['blockquote'] = ({ children }) => {
  const textContent = extractText(children).trim();
  const matchedEmoji = Object.keys(INFO_BOX_CONFIG).find(emoji => textContent.startsWith(emoji));

  if (matchedEmoji) {
    const config = INFO_BOX_CONFIG[matchedEmoji];
    const bodyText = textContent.slice(matchedEmoji.length).trim();
    return (
      <div className={`my-3 p-3.5 ${config.bg} border-l-4 ${config.border} rounded-r-lg`}>
        <div className="flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0">{matchedEmoji}</span>
          <div>
            <div className={`font-semibold text-xs uppercase tracking-wide mb-0.5 opacity-60 ${config.textColor}`}>
              {config.label}
            </div>
            <div className={`text-sm leading-relaxed ${config.textColor}`}>{bodyText}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-3 text-gray-600 dark:text-gray-400">
      {children}
    </blockquote>
  );
};

const LinkRenderer: Components['a'] = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 font-medium"
  >
    {children}
  </a>
);

const CodeRenderer: Components['code'] = ({ className, children }) => {
  const isBlock = !!className;
  if (isBlock) {
    return <code className="text-slate-100 font-mono text-sm">{children}</code>;
  }
  return (
    <code className="px-1.5 py-0.5 mx-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-sm font-mono text-indigo-700 dark:text-indigo-300">
      {children}
    </code>
  );
};

const PreRenderer: Components['pre'] = ({ children }) => (
  <pre className="my-3 p-4 bg-slate-900 dark:bg-slate-950 rounded-lg overflow-x-auto text-sm leading-relaxed">
    {children}
  </pre>
);

const MARKDOWN_COMPONENTS: Components = {
  blockquote: InfoBoxRenderer,
  a: LinkRenderer,
  code: CodeRenderer,
  pre: PreRenderer,
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function Message({ message, onActionClick, assistantName, assistantSubtitle, assistantAvatarSrc, assistantAvatarFallbackIcon, compact }: MessageProps) {
  const [, setLocation] = useLocation();
  const [taskStates, setTaskStates] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

  const handleCreateTask = async (action: { type: string; label: string; data?: any }, index: number) => {
    setTaskStates(prev => ({ ...prev, [index]: 'loading' }));
    try {
      const { clientId, title, description, priority, category, dueDate } = action.data || {};
      const endpoint = clientId ? '/api/consultation-tasks' : '/api/consultant-personal-tasks';
      const body: any = { title, description, priority: priority || 'medium', category: category || (clientId ? 'follow-up' : 'other') };
      if (clientId) body.clientId = clientId;
      if (dueDate) body.dueDate = dueDate;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Errore ${res.status}`);
      }
      setTaskStates(prev => ({ ...prev, [index]: 'success' }));
    } catch (e: any) {
      console.error('[create_task] Error:', e.message);
      setTaskStates(prev => ({ ...prev, [index]: 'error' }));
    }
  };

  const handleAction = (action: { type: string; label: string; data?: any }, index?: number) => {
    if (action.type === 'create_task') {
      handleCreateTask(action, index ?? 0);
      return;
    }
    switch (action.type) {
      case "navigate":
        if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "open_exercise":
        if (action.data?.exerciseId) {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.data.exerciseId);
          if (isValidUUID) {
            const route = action.data.assignmentId
              ? `/exercise/${action.data.exerciseId}?assignment=${action.data.assignmentId}`
              : `/exercise/${action.data.exerciseId}`;
            setLocation(route);
            if (onActionClick) onActionClick();
          } else {
            console.warn('⚠️ L\'AI ha fornito un exerciseId nel vecchio formato:', action.data.exerciseId);
            setLocation('/client/exercises');
            if (onActionClick) onActionClick();
          }
        } else if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "book_consultation":
        if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "open_document":
        if (action.data?.documentId) {
          setLocation(`/client/library/${action.data.documentId}`);
          if (onActionClick) onActionClick();
        } else if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "open_lesson":
        if (action.data?.libraryDocumentId) {
          setLocation(`/client/library/${action.data.libraryDocumentId}`);
          if (onActionClick) onActionClick();
        } else if (action.data?.lessonId) {
          setLocation(`/client/university?lesson=${action.data.lessonId}`);
          if (onActionClick) onActionClick();
        } else if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "external_link":
        if (action.data?.url) {
          window.open(action.data.url, '_blank');
        }
        break;

      case "view_blocked":
      case "view_results":
        if (onActionClick) onActionClick(action.type, action.data);
        break;

      default:
        console.warn('Unknown action type:', action.type);
        if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        } else if (onActionClick) {
          onActionClick(action.type, action.data);
        }
    }
  };

  if (message.role === "user") {
    const hasAttachments = message.attachments && message.attachments.length > 0;

    if (compact) {
      return (
        <div className="flex gap-2 max-w-[90%] ml-auto flex-row-reverse">
          <div className="shrink-0 mt-1">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-primary text-primary-foreground rounded-tr-sm">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] flex items-end gap-2.5">
          <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-br-md px-4 py-3 shadow-sm border border-slate-200/50 dark:border-slate-600/30">
            {hasAttachments && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.attachments!.map((att, i) => (
                  att.type === "image" && (att.preview || att.base64Data) ? (
                    <div key={i} className="relative group">
                      <img
                        src={att.preview || `data:${att.mimeType};base64,${att.base64Data}`}
                        alt={att.name}
                        className="max-w-[120px] max-h-[90px] rounded-lg object-cover border border-slate-200/50 dark:border-slate-600/30 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`<img src="${att.preview || `data:${att.mimeType};base64,${att.base64Data}`}" style="max-width:100%;height:auto"/>`);
                          }
                        }}
                      />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded truncate max-w-[100px]">{att.name}</span>
                    </div>
                  ) : (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/60 dark:bg-slate-600/40 border border-slate-200/50 dark:border-slate-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span className="text-xs font-medium truncate max-w-[100px]">{att.name}</span>
                    </div>
                  )
                ))}
              </div>
            )}
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}
          </div>
          <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden shadow-sm ring-2 ring-white dark:ring-slate-800">
            <img
              src="/avatars/user-avatar.png"
              alt="Tu"
              className="h-full w-full object-cover"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = 'none';
                t.parentElement!.classList.add('bg-gradient-to-br', 'from-slate-400', 'to-slate-500', 'flex', 'items-center', 'justify-center');
                t.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const isProcessing = message.status === "processing";
  const isPlaceholder = message.content.includes("💭 Sto pensando");
  const content = message.content || '';

  const resolvedName = assistantName ?? "Simone";
  const resolvedSubtitle = assistantSubtitle ?? "AI Advisor";
  const resolvedAvatar = assistantAvatarSrc ?? "/avatars/simone-avatar.png";

  if (compact) {
    return (
      <div className="flex gap-2 max-w-[90%]">
        <div className="shrink-0 mt-1">
          {assistantAvatarFallbackIcon ? (
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              {assistantAvatarFallbackIcon}
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/><path d="M2 21a10 10 0 0 1 20 0"/></svg>
            </div>
          )}
        </div>
        <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-muted rounded-tl-sm">
          <div className="ai-content">
            {isHtmlContent(content) ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeAndFormatHtml(content) }} />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={MARKDOWN_COMPONENTS}
              >
                {preprocessContent(content)}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden shadow-md ring-2 ring-violet-200 dark:ring-violet-800">
          <img
            src={resolvedAvatar}
            alt={resolvedName}
            className="h-full w-full object-cover"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = 'none';
              const parent = t.parentElement!;
              parent.classList.remove('overflow-hidden');
              parent.classList.add('bg-gradient-to-br', 'from-violet-500', 'to-purple-600', 'flex', 'items-center', 'justify-center');
              parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/><path d="M2 21a10 10 0 0 1 20 0"/></svg>';
            }}
          />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{resolvedName}</p>
          <p className="text-xs text-violet-500 dark:text-violet-400 leading-tight">{resolvedSubtitle}</p>
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-hidden flex flex-col">
        {(message.thinking || message.isThinking || isProcessing) && (
          <ThinkingBubble
            thinking={message.thinking}
            isThinking={message.isThinking || (isProcessing && !message.thinking)}
            modelName={message.modelName}
            thinkingLevel={message.thinkingLevel}
            className="mb-3"
          />
        )}

        {message.codeExecutions && message.codeExecutions.length > 0 && (
          <CodeExecutionBlock codeExecutions={message.codeExecutions} />
        )}

        {message.generatedFiles && message.generatedFiles.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {message.generatedFiles.map((file, idx) => {
              const isPdf = file.mimeType === 'application/pdf';
              const isImage = file.mimeType.startsWith('image/');
              const iconColor = isPdf ? 'text-red-500' : isImage ? 'text-blue-500' : 'text-gray-500';
              const bgColor = isPdf ? 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20' : isImage ? 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20' : 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20';
              const borderColor = isPdf ? 'border-red-200 dark:border-red-800/40' : isImage ? 'border-blue-200 dark:border-blue-800/40' : 'border-gray-200 dark:border-gray-700/40';

              const handleDownload = () => {
                try {
                  const byteChars = atob(file.data);
                  const byteNumbers = new Array(byteChars.length);
                  for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: file.mimeType });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = file.fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download failed:', err);
                }
              };

              return (
                <div
                  key={`${message.id}-genfile-${idx}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${bgColor} border ${borderColor} shadow-sm`}
                >
                  {isPdf ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 flex-shrink-0 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <path d="M9 15v-2h2a1 1 0 1 0 0-2H9v6"/>
                    </svg>
                  ) : isImage ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 flex-shrink-0 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 flex-shrink-0 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{file.fileName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{file.mimeType.split('/')[1] || 'file'}</p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownload}
                    className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg shadow-sm text-xs px-3 py-1.5 h-auto"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Scarica
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!isPlaceholder && (
          <div className="ai-content">
            {isHtmlContent(content) ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeAndFormatHtml(content) }} />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={MARKDOWN_COMPONENTS}
              >
                {preprocessContent(content)}
              </ReactMarkdown>
            )}
          </div>
        )}

        {message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5 max-w-3xl">
            {message.suggestedActions.map((action, index) => {
              const taskState = action.type === 'create_task' ? (taskStates[index] || 'idle') : null;
              const isLoading = taskState === 'loading';
              const isSuccess = taskState === 'success';
              const isError = taskState === 'error';

              const label = isLoading ? '⏳ Creazione...'
                : isSuccess ? `✅ ${action.data?.title || 'Task creato!'}`
                : isError ? `❌ Errore — riprova`
                : action.label;

              const className = isSuccess
                ? "text-sm h-auto min-h-[2.5rem] py-2 px-4 bg-green-50 border-green-400 text-green-700 rounded-xl shadow-sm font-medium whitespace-normal text-left break-words cursor-default"
                : isError
                ? "text-sm h-auto min-h-[2.5rem] py-2 px-4 bg-red-50 border-red-400 text-red-700 rounded-xl shadow-sm font-medium whitespace-normal text-left break-words"
                : "text-sm h-auto min-h-[2.5rem] py-2 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl transition-all shadow-sm hover:shadow-md font-medium hover:scale-105 whitespace-normal text-left break-words";

              return (
                <Button
                  key={`${message.id}-action-${index}`}
                  variant="outline"
                  size="sm"
                  onClick={() => !isSuccess && !isLoading && handleAction(action, index)}
                  disabled={isLoading}
                  className={className}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
