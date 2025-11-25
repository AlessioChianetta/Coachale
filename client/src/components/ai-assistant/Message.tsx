import { Bot, User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface MessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "processing" | "completed" | "error";
    suggestedActions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
  };
  onActionClick?: () => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtmlFragment(htmlFragment: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlFragment;

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map(processNode).join('');

    switch (tagName) {
      case 'strong':
      case 'b':
        return `<strong>${children}</strong>`;
      case 'em':
      case 'i':
        return `<em>${children}</em>`;
      case 'code':
        return `<code>${children}</code>`;
      case 'a':
        const href = element.getAttribute('href');
        return `<a href="${href || ''}">${children}</a>`;
      case 'ul':
        return `<ul>${children}</ul>`;
      case 'ol':
        return `<ol>${children}</ol>`;
      case 'li':
        return `<li>${children}</li>`;
      case 'h1':
        return `<h1>${children}</h1>`;
      case 'h2':
        return `<h2>${children}</h2>`;
      case 'h3':
      case 'h4':
        return `<h3>${children}</h3>`;
      case 'p':
        return `<p>${children}</p>`;
      case 'br':
        return '<br>';
      case 'div':
      case 'span':
        if (element.querySelector('ul, ol, li')) {
          return children;
        }
        const hasBlockContent = element.querySelector('p, h1, h2, h3, div');
        return hasBlockContent ? children : `<p>${children}</p>`;
      default:
        return children;
    }
  };

  return Array.from(tempDiv.childNodes).map(processNode).join('');
}

function buildCleanFormattedHtml(htmlFragment: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlFragment;

  // Helper function to check if a div is a bullet point
  const isBulletPoint = (element: HTMLElement): boolean => {
    if (element.tagName.toLowerCase() !== 'div') return false;

    // Check if div has flex class
    if (!element.classList.contains('flex') && !element.className.includes('flex')) {
      return false;
    }

    const spans = element.querySelectorAll('span');
    if (spans.length < 1) return false;

    const firstSpan = spans[0];
    const text = firstSpan.textContent || '';

    // Check for bullet characters (●, •, *, -)
    return /[●•\*\-]/.test(text.trim());
  };

  // Helper function to check if a div is a numbered list item
  const isNumberedListItem = (element: HTMLElement): boolean => {
    if (element.tagName.toLowerCase() !== 'div') return false;

    // Check if div has flex class
    if (!element.classList.contains('flex') && !element.className.includes('flex')) {
      return false;
    }

    const spans = element.querySelectorAll('span');
    if (spans.length < 1) return false;

    const firstSpan = spans[0];

    // Check if first span has rounded-full class (indicates numbered bubble)
    return firstSpan.classList.contains('rounded-full') || 
           firstSpan.className.includes('rounded-full');
  };

  // Helper function to extract text from list item div
  const extractListItemText = (element: HTMLElement): string => {
    const spans = element.querySelectorAll('span');
    if (spans.length < 2) {
      // Fallback: get all text except first span
      const firstSpan = spans[0];
      const fullText = element.textContent || '';
      const firstSpanText = firstSpan?.textContent || '';
      return fullText.replace(firstSpanText, '').trim();
    }

    // Process spans starting from the second one (skip the bullet/number)
    let text = '';
    for (let i = 1; i < spans.length; i++) {
      text += processInlineNode(spans[i]);
    }
    return text.trim();
  };

  // Process inline elements (for use inside list items, paragraphs, etc.)
  const processInlineNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map(processInlineNode).join('');

    switch (tagName) {
      case 'strong':
      case 'b':
        return `<strong>${children}</strong>`;
      case 'em':
      case 'i':
        return `<em>${children}</em>`;
      case 'code':
        return `<code>${children}</code>`;
      case 'a':
        const href = element.getAttribute('href');
        return `<a href="${href || ''}">${children}</a>`;
      case 'br':
        return '<br>';
      case 'span':
      case 'div':
        return children;
      default:
        return children;
    }
  };

  // Process block-level elements
  const processBlockNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return text.trim() ? `<p style="margin: 0 0 12px 0; line-height: 1.6;">${text}</p>` : '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // Handle existing semantic lists
    if (tagName === 'ul') {
      const children = Array.from(element.childNodes).map(processBlockNode).join('');
      return `<ul style="margin: 0 0 16px 0; padding-left: 40px; list-style-type: disc;">${children}</ul>`;
    }

    if (tagName === 'ol') {
      const children = Array.from(element.childNodes).map(processBlockNode).join('');
      return `<ol style="margin: 0 0 16px 0; padding-left: 40px; list-style-type: decimal;">${children}</ol>`;
    }

    if (tagName === 'li') {
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      return `<li style="margin-bottom: 4px;">${children}</li>`;
    }

    // Handle headings
    if (tagName === 'h1') {
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      return `<h1 style="margin: 16px 0 8px 0; font-size: 24px; font-weight: bold;">${children}</h1>`;
    }

    if (tagName === 'h2') {
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      return `<h2 style="margin: 14px 0 7px 0; font-size: 20px; font-weight: bold;">${children}</h2>`;
    }

    if (tagName === 'h3' || tagName === 'h4') {
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      return `<h3 style="margin: 12px 0 6px 0; font-size: 18px; font-weight: bold;">${children}</h3>`;
    }

    // Handle paragraphs
    if (tagName === 'p') {
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      return `<p style="margin: 0 0 12px 0; line-height: 1.6;">${children}</p>`;
    }

    // Handle divs and spans
    if (tagName === 'div' || tagName === 'span') {
      // If it contains semantic lists, just return children
      if (element.querySelector('ul, ol, li')) {
        return Array.from(element.childNodes).map(processBlockNode).join('');
      }

      // If it has block content, return children
      const hasBlockContent = element.querySelector('p, h1, h2, h3, div');
      if (hasBlockContent) {
        return Array.from(element.childNodes).map(processBlockNode).join('');
      }

      // Otherwise treat as paragraph
      const children = Array.from(element.childNodes).map(processInlineNode).join('');
      if (!children.trim()) {
        return '<p style="margin: 0 0 12px 0;"></p>';
      }
      return `<p style="margin: 0 0 12px 0; line-height: 1.6;">${children}</p>`;
    }

    // Default: process children as inline
    const children = Array.from(element.childNodes).map(processInlineNode).join('');
    return children;
  };

  // Main processing with list grouping
  const result: string[] = [];
  const nodes = Array.from(tempDiv.childNodes);
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      // Check for bullet point pattern
      if (isBulletPoint(element)) {
        const listItems: string[] = [];

        // Collect consecutive bullet points
        while (i < nodes.length) {
          const currentNode = nodes[i];
          if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const currentElement = currentNode as HTMLElement;
            if (isBulletPoint(currentElement)) {
              const itemText = extractListItemText(currentElement);
              listItems.push(`<li style="margin-bottom: 4px;">${itemText}</li>`);
              i++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        // Create ul with all items
        result.push(`<ul style="margin: 0 0 16px 0; padding-left: 40px; list-style-type: disc;">${listItems.join('')}</ul>`);
        continue;
      }

      // Check for numbered list pattern
      if (isNumberedListItem(element)) {
        const listItems: string[] = [];

        // Collect consecutive numbered items
        while (i < nodes.length) {
          const currentNode = nodes[i];
          if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const currentElement = currentNode as HTMLElement;
            if (isNumberedListItem(currentElement)) {
              const itemText = extractListItemText(currentElement);
              listItems.push(`<li style="margin-bottom: 4px;">${itemText}</li>`);
              i++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        // Create ol with all items
        result.push(`<ol style="margin: 0 0 16px 0; padding-left: 40px; list-style-type: decimal;">${listItems.join('')}</ol>`);
        continue;
      }
    }

    // Process as normal block node
    result.push(processBlockNode(node));
    i++;
  }

  return result.join('');
}

function formatContentForClipboard(content: string): string {
  let cleanContent = content
    .replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
    .replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '')
    .replace(/\[\/ACTIONS\]/gi, '');

  if (isHtmlContent(cleanContent)) {
    return cleanContent
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<h1>$1</h1>')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<h2>$1</h2>')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<h3>$1</h3>')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '<p>$1</p>')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<strong>$1</strong>')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '<em>$1</em>')
      .replace(/<ul[^>]*>/gi, '<ul>')
      .replace(/<ol[^>]*>/gi, '<ol>')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '<li>$1</li>');
  }

  const escapedContent = escapeHtml(cleanContent);

  let processed = escapedContent
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

  const lines = processed.split('\n');
  let result: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      result.push('<br>');
      continue;
    }

    if (/^[\s]*[•\*\-][\s]+/.test(line)) {
      const bulletText = line.replace(/^[\s]*[•\*\-][\s]+/, '');
      if (!inList || listType !== 'ul') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${bulletText}</li>`);
      continue;
    }

    if (/^\d+[\.)]\s/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^\d+[\.)]\s/, '');
      if (!inList || listType !== 'ol') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${text}</li>`);
      continue;
    }

    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }

    if (trimmedLine.endsWith(':') && trimmedLine.length < 100 && !/^\d+\./.test(trimmedLine)) {
      result.push(`<h3>${line.replace(':', '')}</h3>`);
      continue;
    }

    result.push(`<p>${line}</p>`);
  }

  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  return result.join('');
}

// Funzione per rilevare se il contenuto è principalmente HTML (come contenuti lezioni)
function isHtmlContent(text: string): boolean {
  const htmlTagsPattern = /<(p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|strong|em|br|hr)[^>]*>/gi;
  const matches = text.match(htmlTagsPattern);
  return matches !== null && matches.length > 3; // Se ci sono più di 3 tag HTML, consideralo HTML
}

// Funzione per pulire e sanitizzare HTML delle lezioni
function sanitizeAndFormatHtml(html: string): string {
  // Rimuovi StartFragment/EndFragment di Office
  let cleaned = html.replace(/<!--StartFragment-->|<!--EndFragment-->/g, '');

  // Converti heading HTML in heading styled con Tailwind
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6">$1</h1>');
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 mt-5">$1</h2>');
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-4">$1</h3>');

  // Converti paragrafi
  cleaned = cleaned.replace(/<p[^>]*>/gi, '<p class="text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">');

  // Converti strong/bold
  cleaned = cleaned.replace(/<strong[^>]*>/gi, '<strong class="font-bold text-gray-900 dark:text-white">');

  // Converti em/italic
  cleaned = cleaned.replace(/<em[^>]*>/gi, '<em class="italic text-gray-700 dark:text-gray-300">');

  // Converti liste
  cleaned = cleaned.replace(/<ul[^>]*>/gi, '<ul class="list-disc list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<ol[^>]*>/gi, '<ol class="list-decimal list-inside mb-3 space-y-1 ml-4">');
  cleaned = cleaned.replace(/<li[^>]*>/gi, '<li class="text-gray-800 dark:text-gray-200">');

  // Converti links
  cleaned = cleaned.replace(/<a\s+href="([^"]+)"[^>]*>/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">');

  return cleaned;
}

export function Message({ message, onActionClick }: MessageProps) {
  const [, setLocation] = useLocation();

  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const clonedFragment = range.cloneContents();

    const tempContainer = document.createElement('div');
    tempContainer.appendChild(clonedFragment);

    const rawHtml = tempContainer.innerHTML;
    if (!rawHtml.trim()) return;

    const formattedHtml = buildCleanFormattedHtml(rawHtml);

    const htmlWithFragmentMarkers = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="generator" content="AI Assistant">
</head>
<body>
<!--StartFragment-->${formattedHtml}<!--EndFragment-->
</body>
</html>`;

    const plainTextDiv = document.createElement('div');
    plainTextDiv.innerHTML = formattedHtml;
    const plainText = plainTextDiv.textContent || plainTextDiv.innerText || '';

    event.preventDefault();
    event.clipboardData.setData('text/html', htmlWithFragmentMarkers);
    event.clipboardData.setData('text/plain', plainText);
  };

  const handleAction = (action: { type: string; label: string; data?: any }) => {
    switch (action.type) {
      case "navigate":
        if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "open_exercise":
        if (action.data?.exerciseId) {
          // Verifica che l'exerciseId sia un UUID valido (formato nuovo)
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.data.exerciseId);

          if (isValidUUID) {
            const route = action.data.assignmentId
              ? `/exercise/${action.data.exerciseId}?assignment=${action.data.assignmentId}`
              : `/exercise/${action.data.exerciseId}`;
            setLocation(route);
            if (onActionClick) onActionClick();
          } else {
            console.warn('⚠️ L\'AI ha fornito un exerciseId nel vecchio formato:', action.data.exerciseId);
            // Fallback: prova a navigare alla pagina esercizi generica
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
          // Naviga direttamente al documento usando il path
          setLocation(`/client/library/${action.data.documentId}`);
          if (onActionClick) onActionClick();
        } else if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
        break;

      case "open_lesson":
        if (action.data?.libraryDocumentId) {
          // Se la lezione ha un documento della libreria associato, vai direttamente alla libreria
          setLocation(`/client/library/${action.data.libraryDocumentId}`);
          if (onActionClick) onActionClick();
        } else if (action.data?.lessonId) {
          // Altrimenti naviga alla pagina università con il parametro lesson
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

      default:
        console.warn('Unknown action type:', action.type);
        if (action.data?.route) {
          setLocation(action.data.route);
          if (onActionClick) onActionClick();
        }
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex gap-3 justify-end items-start">
        <div className="flex-1 text-right">
          <div className="inline-block max-w-[85%] rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white px-5 py-3.5 shadow-lg">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content || ''}</p>
          </div>
        </div>
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-lg ring-2 ring-blue-200 dark:ring-blue-800">
          <User className="h-5 w-5 text-white" />
        </div>
      </div>
    );
  }

  const isProcessing = message.status === "processing";
  const isPlaceholder = message.content.includes("💭 Sto pensando");

  const formatContent = (content: string): string => {
    let cleanContent = content
      .replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
      .replace(/\[\/ACTIONS\][\s\S]*?\[\/ACTIONS\]/gi, '')
      .replace(/\{"actions":\s*\[[\s\S]*?\]\}/gi, '')
      .replace(/\[\/ACTIONS\]/gi, '');

    // Se il contenuto è principalmente HTML (lezioni), sanitizzalo direttamente senza escape
    if (isHtmlContent(cleanContent)) {
      return sanitizeAndFormatHtml(cleanContent);
    }

    const escapedContent = escapeHtml(cleanContent);

    // Detect special boxes (💡 TIP, ⚠️ WARNING, ℹ️ INFO, ✅ SUCCESS)
    let processed = escapedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-2 py-0.5 mx-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-sm font-mono text-indigo-700 dark:text-indigo-300">$1</code>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline inline-flex items-center gap-1 font-medium">$1<svg class="h-3 w-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>');

    const lines = processed.split('\n');
    let result: string[] = [];
    let sectionCounter = 0;
    let subsectionCounter = 0;
    let inTable = false;
      let tableRows: string[] = [];

      const processTable = (rows: string[]) => {
        if (rows.length < 2) return rows.join('\n');

        // Detect if it's a markdown table with | separators
        const isMarkdownTable = rows.every(row => row.includes('|'));
        if (!isMarkdownTable) return rows.join('\n');

        const parseRow = (row: string) => {
          return row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
        };

        const headerCells = parseRow(rows[0]);

        // Skip separator row if exists (e.g., |---|---|---|)
        let dataStartIndex = 1;
        if (rows[1] && rows[1].includes('---')) {
          dataStartIndex = 2;
        }

        const dataRows = rows.slice(dataStartIndex).map(parseRow);

        let tableHtml = '<div class="my-6 overflow-x-auto"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">';

        // Header
        tableHtml += '<thead class="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40"><tr>';
        headerCells.forEach(cell => {
          tableHtml += `<th class="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">${cell}</th>`;
        });
        tableHtml += '</tr></thead>';

        // Body
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

      // Detect table start
      if (trimmedLine.includes('|') && trimmedLine.split('|').filter(s => s.trim()).length > 1) {
        if (!inTable) {
          inTable = true;
          tableRows = [trimmedLine];
        } else {
          tableRows.push(trimmedLine);
        }
        continue;
      } else if (inTable) {
        // End of table
        result.push(processTable(tableRows));
        inTable = false;
        tableRows = [];
        // Process current line normally
      }



      if (trimmedLine === '') {
        result.push('<div class="h-3"></div>');
        continue;
      }

      // Code blocks
      if (trimmedLine.startsWith('```')) {
        continue;
      }

      // Special boxes: 💡 TIP / ⚠️ WARNING / ℹ️ INFO / ✅ SUCCESS
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

      // Quotes
      if (trimmedLine.startsWith('>')) {
        const quoteText = trimmedLine.substring(1).trim();
        result.push(`<div class="border-l-4 border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 pl-5 pr-4 py-3 my-4 italic text-gray-700 dark:text-gray-300 rounded-r-lg leading-relaxed">${quoteText}</div>`);
        continue;
      }

      // Main sections (Title ending with :)
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

      // Subsections (1.1, 1.2 style)
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

      // Bullet points (including checkboxes)
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

      // Numbered lists with styled bubbles
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

      // Regular paragraphs
      result.push(`<div class="text-gray-800 dark:text-gray-200 mb-2 leading-relaxed text-sm">${line}</div>`);
    }

    return result.join('');
  };

  return (
    <div className="flex gap-3 justify-start items-start">
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg ring-2 ring-purple-200 dark:ring-purple-800">
        <Bot className="h-5 w-5 text-white" />
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-hidden flex flex-col">
        <div className="inline-block max-w-full rounded-xl bg-white dark:bg-gray-800 px-6 py-6 shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden break-words">
          {isProcessing && (
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Sto organizzando la risposta...</span>
            </div>
          )}
          {!isPlaceholder && (
            <div 
              className="documentation-content prose prose-sm max-w-none break-words overflow-wrap-anywhere word-break-break-word overflow-hidden"
              style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                maxWidth: '100%'
              }}
              onCopy={handleCopy}
              dangerouslySetInnerHTML={{ 
                __html: formatContent(message.content || '')
              }} 
            />
          )}
        </div>

        {message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5 max-w-3xl">
            {message.suggestedActions.map((action, index) => (
              <Button
                key={`${message.id}-action-${index}`}
                variant="outline"
                size="sm"
                onClick={() => handleAction(action)}
                className="text-sm h-auto min-h-[2.5rem] py-2 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl transition-all shadow-sm hover:shadow-md font-medium hover:scale-105 whitespace-normal text-left break-words"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
