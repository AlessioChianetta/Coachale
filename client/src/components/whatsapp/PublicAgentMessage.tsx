import { Bot } from "lucide-react";

interface PublicAgentMessageProps {
  message: {
    id: string;
    role: 'user' | 'agent';
    content: string;
    createdAt: Date;
  };
  agentName?: string;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

function formatContent(content: string): string {
  let cleanContent = content
    .replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '')
    .replace(/\[\/ACTIONS\]/gi, '');

  if (isHtmlContent(cleanContent)) {
    return sanitizeAndFormatHtml(cleanContent);
  }

  const escapedContent = escapeHtml(cleanContent);

  let processed = escapedContent
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-2 py-0.5 mx-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-sm font-mono text-indigo-700 dark:text-indigo-300">$1</code>')
    .replace(/^###\s+(.+)$/gm, '<h3 class="mt-4 mb-2 text-lg font-bold text-gray-900 dark:text-white">$1</h3>')
    .replace(/^---$/gm, '<hr class="my-4 border-t border-gray-300 dark:border-gray-600" />')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic text-gray-700 dark:text-gray-300">$1</em>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline inline-flex items-center gap-1 font-medium">$1<svg class="h-3 w-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>');

  const lines = processed.split('\n');
  let result: string[] = [];
  let sectionCounter = 0;
  let subsectionCounter = 0;
  let inTable = false;
  let tableRows: string[] = [];

  const processTable = (rows: string[]) => {
    if (rows.length < 2) return rows.join('\n');

    const isMarkdownTable = rows.every(row => row.includes('|'));
    if (!isMarkdownTable) return rows.join('\n');

    const parseRow = (row: string) => {
      return row.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
    };

    const headerCells = parseRow(rows[0]);

    let dataStartIndex = 1;
    if (rows[1] && rows[1].includes('---')) {
      dataStartIndex = 2;
    }

    const dataRows = rows.slice(dataStartIndex).map(parseRow);

    let tableHtml = '<div class="my-6 overflow-x-auto"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">';

    tableHtml += '<thead class="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40"><tr>';
    headerCells.forEach(cell => {
      tableHtml += `<th class="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">${cell}</th>`;
    });
    tableHtml += '</tr></thead>';

    tableHtml += '<tbody>';
    dataRows.forEach((row, idx) => {
      const bgClass = idx % 2 === 0 
        ? 'bg-white dark:bg-gray-800' 
        : 'bg-gray-50 dark:bg-gray-800/50';
      tableHtml += `<tr class="${bgClass} hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">`;
      row.forEach(cell => {
        tableHtml += `<td class="border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';

    return tableHtml;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.includes('|') && trimmedLine.split('|').filter(s => s.trim()).length > 1) {
      if (!inTable) {
        inTable = true;
        tableRows = [trimmedLine];
      } else {
        tableRows.push(trimmedLine);
      }
      continue;
    } else if (inTable) {
      result.push(processTable(tableRows));
      inTable = false;
      tableRows = [];
    }

    if (trimmedLine === '') {
      result.push('<div class="h-3"></div>');
      continue;
    }

    if (trimmedLine.startsWith('```')) {
      continue;
    }

    if (trimmedLine.startsWith('💡')) {
      const text = trimmedLine.replace(/^💡\s*/, '');
      result.push(`<div class="my-4 p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-r-lg">
        <div class="flex items-start gap-3">
          <span class="text-xl flex-shrink-0">💡</span>
          <div>
            <div class="font-bold text-amber-900 dark:text-amber-100 mb-1 text-sm uppercase tracking-wide">Suggerimento</div>
            <div class="text-amber-800 dark:text-amber-200 text-sm leading-relaxed">${text}</div>
          </div>
        </div>
      </div>`);
      continue;
    }

    if (trimmedLine.startsWith('⚠️')) {
      const text = trimmedLine.replace(/^⚠️\s*/, '');
      result.push(`<div class="my-4 p-4 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded-r-lg">
        <div class="flex items-start gap-3">
          <span class="text-xl flex-shrink-0">⚠️</span>
          <div>
            <div class="font-bold text-red-900 dark:text-red-100 mb-1 text-sm uppercase tracking-wide">Attenzione</div>
            <div class="text-red-800 dark:text-red-200 text-sm leading-relaxed">${text}</div>
          </div>
        </div>
      </div>`);
      continue;
    }

    if (trimmedLine.startsWith('ℹ️')) {
      const text = trimmedLine.replace(/^ℹ️\s*/, '');
      result.push(`<div class="my-4 p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-r-lg">
        <div class="flex items-start gap-3">
          <span class="text-xl flex-shrink-0">ℹ️</span>
          <div>
            <div class="font-bold text-blue-900 dark:text-blue-100 mb-1 text-sm uppercase tracking-wide">Informazione</div>
            <div class="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">${text}</div>
          </div>
        </div>
      </div>`);
      continue;
    }

    if (trimmedLine.startsWith('✅')) {
      const text = trimmedLine.replace(/^✅\s*/, '');
      result.push(`<div class="my-4 p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-r-lg">
        <div class="flex items-start gap-3">
          <span class="text-xl flex-shrink-0">✅</span>
          <div>
            <div class="font-bold text-green-900 dark:text-green-100 mb-1 text-sm uppercase tracking-wide">Completato</div>
            <div class="text-green-800 dark:text-green-200 text-sm leading-relaxed">${text}</div>
          </div>
        </div>
      </div>`);
      continue;
    }

    if (trimmedLine.startsWith('>')) {
      const quoteText = trimmedLine.substring(1).trim();
      result.push(`<div class="border-l-4 border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 pl-5 pr-4 py-3 my-4 italic text-gray-700 dark:text-gray-300 rounded-r-lg leading-relaxed">${quoteText}</div>`);
      continue;
    }

    if (trimmedLine.endsWith(':') && trimmedLine.length < 100 && !trimmedLine.includes('🔹') && !/^\d+\./.test(trimmedLine)) {
      sectionCounter++;
      subsectionCounter = 0;
      result.push(`<div class="mt-6 mb-3 pb-2 border-b border-gray-300 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <span class="flex-shrink-0 w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center">${sectionCounter}</span>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">${line.replace(':', '')}</h3>
        </div>
      </div>`);
      continue;
    }

    if (/^\d+\.\d+\.?\s/.test(trimmedLine)) {
      const match = trimmedLine.match(/^(\d+\.\d+)\.?\s(.+)$/);
      if (match) {
        result.push(`<div class="mt-4 mb-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded">${match[1]}</span>
            <h4 class="text-base font-semibold text-gray-800 dark:text-gray-200">${match[2]}</h4>
          </div>
        </div>`);
        continue;
      }
    }

    if (/^[\s]*[•\*\-☐✓][\s]+/.test(line) || line.includes('☐') || line.includes('✓')) {
      const bulletText = line.replace(/^[\s]*[•\*\-☐✓][\s]+/, '');
      const isIndented = line.startsWith('  ');
      const marginLeft = isIndented ? 'ml-8' : 'ml-0';
      const isCheckbox = line.includes('☐') || line.includes('✓');
      const isChecked = line.includes('✓');

      if (isCheckbox) {
        result.push(`<div class="flex items-start gap-3 ${marginLeft} mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <span class="flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 ${isChecked ? 'text-green-500' : 'text-gray-400'}" fill="${isChecked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
              ${isChecked ? '<path d="M9 12l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
            </svg>
          </span>
          <span class="flex-1 text-gray-800 dark:text-gray-200 leading-relaxed text-sm ${isChecked ? 'line-through opacity-60' : ''}">${bulletText}</span>
        </div>`);
      } else {
        result.push(`<div class="flex items-start gap-2.5 ${marginLeft} mb-2">
          <span class="text-purple-500 dark:text-purple-400 flex-shrink-0 mt-1.5 text-xs">●</span>
          <span class="flex-1 text-gray-800 dark:text-gray-200 leading-relaxed text-sm">${bulletText}</span>
        </div>`);
      }
      continue;
    }

    if (/^\d+[\.)]\s/.test(trimmedLine)) {
      const number = trimmedLine.match(/^(\d+)/)![1];
      const text = trimmedLine.replace(/^\d+[\.)]\s/, '');
      subsectionCounter++;
      result.push(`<div class="flex items-start gap-3 ml-0 mb-3">
        <span class="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 flex items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-300 shadow-sm">${number}</span>
        <span class="flex-1 text-gray-800 dark:text-gray-200 pt-0.5 leading-relaxed text-sm">${text}</span>
      </div>`);
      continue;
    }

    result.push(`<div class="text-gray-800 dark:text-gray-200 mb-2 leading-relaxed text-sm">${line}</div>`);
  }

  return result.join('');
}

export function PublicAgentMessage({ message, agentName = "AI Assistant" }: PublicAgentMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl px-4 py-3">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content || ''}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-white text-sm">{agentName}</span>
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-hidden flex flex-col">
        <div 
          className="documentation-content prose prose-sm max-w-none break-words overflow-wrap-anywhere word-break-break-word overflow-hidden text-gray-700 dark:text-gray-300"
          style={{ 
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}
          dangerouslySetInnerHTML={{ 
            __html: formatContent(message.content || '')
          }} 
        />
      </div>
    </div>
  );
}

export default PublicAgentMessage;
