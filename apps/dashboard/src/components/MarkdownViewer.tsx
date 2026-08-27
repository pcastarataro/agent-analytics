import { useMemo } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(
          `<pre class="bg-gray-100 rounded p-3 my-2 overflow-x-auto text-sm"><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`,
        );
        codeLines = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '') {
      htmlParts.push('');
      continue;
    }

    let html = escapeHtml(trimmed);

    // Headers
    if (html.startsWith('###### ')) {
      html = `<h6 class="text-sm font-semibold mt-3 mb-1">${html.slice(7)}</h6>`;
    } else if (html.startsWith('##### ')) {
      html = `<h5 class="text-sm font-semibold mt-3 mb-1">${html.slice(6)}</h5>`;
    } else if (html.startsWith('#### ')) {
      html = `<h4 class="text-base font-semibold mt-4 mb-2">${html.slice(5)}</h4>`;
    } else if (html.startsWith('### ')) {
      html = `<h3 class="text-lg font-semibold mt-4 mb-2">${html.slice(4)}</h3>`;
    } else if (html.startsWith('## ')) {
      html = `<h2 class="text-xl font-bold mt-5 mb-2">${html.slice(3)}</h2>`;
    } else if (html.startsWith('# ')) {
      html = `<h1 class="text-2xl font-bold mt-6 mb-3">${html.slice(2)}</h1>`;
    }
    // List items
    else if (html.startsWith('- ') || html.startsWith('* ')) {
      html = `<li class="ml-4 list-disc">${inlineMarkdown(html.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(html)) {
      const content = html.replace(/^\d+\.\s/, '');
      html = `<li class="ml-4 list-decimal">${inlineMarkdown(content)}</li>`;
    }
    // Blockquote
    else if (html.startsWith('&gt; ')) {
      html = `<blockquote class="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">${inlineMarkdown(html.slice(5))}</blockquote>`;
    }
    // Horizontal rule
    else if (html === '---' || html === '***' || html === '___') {
      html = '<hr class="my-4 border-gray-200" />';
    }
    // Paragraph
    else {
      html = `<p class="my-1">${inlineMarkdown(html)}</p>`;
    }

    htmlParts.push(html);
  }

  if (inCodeBlock && codeLines.length > 0) {
    htmlParts.push(
      `<pre class="bg-gray-100 rounded p-3 my-2 overflow-x-auto text-sm"><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`,
    );
  }

  return htmlParts.join('\n');
}

function inlineMarkdown(text: string): string {
  // Bold
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  // Inline code
  result = result.replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
  // Links
  result = result.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return result;
}

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`prose prose-sm max-w-none text-gray-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
