import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

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

export function preprocessContent(content: string): string {
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

export function isHtmlContent(text: string): boolean {
  const htmlTagsPattern = /<(p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|strong|em|br|hr)[^>]*>/gi;
  const matches = text.match(htmlTagsPattern);
  return matches !== null && matches.length > 3;
}

export function sanitizeAndFormatHtml(html: string): string {
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

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  if (!content) return null;

  if (isHtmlContent(content)) {
    return (
      <div
        className={className || "ai-content"}
        dangerouslySetInnerHTML={{ __html: sanitizeAndFormatHtml(content) }}
      />
    );
  }

  return (
    <div className={className || "ai-content"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={MARKDOWN_COMPONENTS}
      >
        {preprocessContent(content)}
      </ReactMarkdown>
    </div>
  );
}
