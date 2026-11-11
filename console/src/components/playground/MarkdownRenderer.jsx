import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Fenced code block with copy-to-clipboard button and syntax styling.
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div style={{
      margin: '0.75rem 0',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-canvas)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.35rem 0.75rem',
        background: 'var(--bg-card-hover)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '0.7rem'
      }}>
        <span className="font-mono" style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'lowercase' }}>
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-sm btn-outline font-mono"
          style={{
            padding: '0.15rem 0.45rem',
            height: 22,
            fontSize: '0.65rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
          title="Copy code"
        >
          {copied ? <Check size={11} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '0.75rem 1rem',
        overflowX: 'auto',
        fontSize: '0.8125rem',
        lineHeight: 1.5,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-code)'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Parses inline tokens: code, bold, italic, and links.
 */
function parseInline(text) {
  if (!text) return null;
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={i} 
          className="font-mono" 
          style={{ 
            background: 'var(--bg-card-hover)', 
            padding: '0.15rem 0.35rem', 
            borderRadius: 4, 
            fontSize: '0.85em', 
            border: '1px solid var(--border-subtle)', 
            color: 'var(--text-code)' 
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a 
          key={i} 
          href={linkMatch[2]} 
          target="_blank" 
          rel="noreferrer" 
          style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

/**
 * High-performance, zero-dependency Markdown renderer for LLM responses.
 * Parses code blocks, headers, lists, quotes, tables, and typography safely.
 */
export default function MarkdownRenderer({ content, executing }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const language = match ? match[1] : '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // If code block was closed, advance past the closing fence
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      elements.push(
        <CodeBlock 
          key={`code-${elements.length}`} 
          language={language} 
          code={codeLines.join('\n')} 
        />
      );
      continue;
    }

    // Headings: #, ##, ###, ####
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${elements.length}`} style={{ fontSize: '1.25rem', fontWeight: 800, margin: '1rem 0 0.4rem', color: 'var(--text-primary)' }}>
          {parseInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${elements.length}`} style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.85rem 0 0.35rem', color: 'var(--text-primary)' }}>
          {parseInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${elements.length}`} style={{ fontSize: '0.98rem', fontWeight: 600, margin: '0.75rem 0 0.3rem', color: 'var(--text-primary)' }}>
          {parseInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${elements.length}`} style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0.65rem 0 0.25rem', color: 'var(--text-secondary)' }}>
          {parseInline(line.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote 
          key={`quote-${elements.length}`}
          style={{
            borderLeft: '3px solid var(--accent-lime)',
            paddingLeft: '0.85rem',
            margin: '0.65rem 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic'
          }}
        >
          {quoteLines.map((ql, qIdx) => (
            <div key={qIdx}>{parseInline(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      elements.push(
        <hr 
          key={`hr-${elements.length}`} 
          style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '1rem 0' }} 
        />
      );
      i++;
      continue;
    }

    // Tables: | Header | Header |
    if (line.trim().startsWith('|') && line.trim().endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = line.split('|').slice(1, -1).map(s => s.trim());
      i += 2; // skip header and separator row
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map(s => s.trim());
        rows.push(cells);
        i++;
      }
      elements.push(
        <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: 'var(--bg-card-hover)' }}>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} style={{ padding: '0.4rem 0.65rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {parseInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '0.4rem 0.65rem', color: 'var(--text-primary)' }}>
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Lists: - , * , or 1.
    const isUnordered = /^[-*]\s+/.test(line.trim());
    const isOrdered = /^\d+\.\s+/.test(line.trim());

    if (isUnordered || isOrdered) {
      const listItems = [];
      const ordered = isOrdered;
      while (i < lines.length) {
        const currentLine = lines[i].trim();
        const itemUnordered = /^[-*]\s+/.test(currentLine);
        const itemOrdered = /^\d+\.\s+/.test(currentLine);

        if (ordered && itemOrdered) {
          listItems.push(currentLine.replace(/^\d+\.\s+/, ''));
          i++;
        } else if (!ordered && itemUnordered) {
          listItems.push(currentLine.replace(/^[-*]\s+/, ''));
          i++;
        } else {
          break;
        }
      }

      const ListTag = ordered ? 'ol' : 'ul';
      elements.push(
        <ListTag 
          key={`list-${elements.length}`}
          style={{
            margin: '0.5rem 0',
            paddingLeft: '1.4rem',
            lineHeight: 1.6
          }}
        >
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} style={{ marginBottom: '0.2rem' }}>
              {parseInline(item)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Regular text paragraph
    if (line.trim().length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} style={{ margin: '0.35rem 0', lineHeight: 1.65 }}>
          {parseInline(line)}
        </p>
      );
    } else {
      // Empty line spacing
      elements.push(<div key={`spacer-${elements.length}`} style={{ height: '0.5rem' }} />);
    }

    i++;
  }

  return (
    <div className="markdown-content" style={{ color: 'var(--text-primary)' }}>
      {elements}
      {executing && (
        <span 
          style={{
            display: 'inline-block',
            width: 7,
            height: 15,
            backgroundColor: 'var(--accent-primary)',
            marginLeft: 4,
            verticalAlign: 'middle',
            animation: 'pulse 1s infinite'
          }} 
        />
      )}
    </div>
  );
}
