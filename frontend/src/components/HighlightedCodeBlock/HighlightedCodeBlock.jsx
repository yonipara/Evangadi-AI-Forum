import React, { useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import styles from './HighlightedCodeBlock.module.css';

/**
 * Tokenizes a single line of source code into syntax elements.
 *
 * @param {string} line - Single line of code
 * @returns {Array<{ type: string, value: string }>}
 */
function tokenizeLine(line) {
  if (!line) return [{ type: 'text', value: ' ' }];

  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^\\'])*'|"(?:\\.|[^\\"])*"|`(?:\\.|[^\\`])*`|\b(?:import|export|default|function|const|let|var|return|from|if|else|switch|case|break|for|while|try|catch|finally|throw|new|typeof|instanceof|async|await|class|extends|super|this|in|of|yield)\b|\b(?:true|false|null|undefined|NaN|Infinity)\b|\b\d+(?:\.\d+)?\b|\b[A-Z][a-zA-Z0-9_]*\b|\b(?:use[A-Z][a-zA-Z0-9_]*)\b|\b(?:localStorage|sessionStorage|JSON|window|document|console)\.[a-zA-Z0-9_$]+\b|<\/?[a-zA-Z0-9_]+(?:\s+[^>]*)?\/?>|[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()|[{}\[\](),;.:=+\-*/%&|^!~<>?])/g;

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: line.slice(lastIndex, match.index),
      });
    }

    const token = match[0];
    let type = 'text';

    if (token.startsWith('//') || token.startsWith('/*')) {
      type = 'comment';
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
      type = 'string';
    } else if (
      /^(?:import|export|default|function|const|let|var|return|from|if|else|switch|case|break|for|while|try|catch|finally|throw|new|typeof|instanceof|async|await|class|extends|super|this|in|of|yield)$/.test(
        token
      )
    ) {
      type = 'keyword';
    } else if (
      /^(?:true|false|null|undefined|NaN|Infinity)$/.test(token) ||
      /^\d+(?:\.\d+)?$/.test(token)
    ) {
      type = 'constant';
    } else if (/^(?:localStorage|sessionStorage|JSON|window|document|console)\./.test(token)) {
      type = 'builtin';
    } else if (/^use[A-Z]/.test(token)) {
      type = 'hook';
    } else if (/^[A-Z]/.test(token)) {
      type = 'component';
    } else if (
      match.index + token.length < line.length &&
      /\s*\(/.test(line.slice(match.index + token.length, match.index + token.length + 5))
    ) {
      type = 'function';
    } else if (token.startsWith('<') && token.endsWith('>')) {
      type = 'tag';
    } else if (/[{}\[\](),;.:]/.test(token)) {
      type = 'punctuation';
    } else if (/[=+\-*/%&|^!~<>]/.test(token)) {
      type = 'operator';
    }

    tokens.push({ type, value: token });
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'text', value: line.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Maps token types to CSS module class names.
 */
function getTokenClass(type) {
  switch (type) {
    case 'comment':
      return styles.tokenComment;
    case 'keyword':
      return styles.tokenKeyword;
    case 'string':
      return styles.tokenString;
    case 'hook':
      return styles.tokenHook;
    case 'component':
      return styles.tokenComponent;
    case 'function':
      return styles.tokenFunction;
    case 'builtin':
      return styles.tokenBuiltin;
    case 'constant':
      return styles.tokenConstant;
    case 'tag':
      return styles.tokenTag;
    case 'operator':
      return styles.tokenOperator;
    case 'punctuation':
      return styles.tokenPunctuation;
    default:
      return styles.tokenText;
  }
}

/**
 * Formats unformatted or condensed code with clean line breaks and indentation.
 *
 * @param {string} code
 * @returns {string}
 */
function beautifyCode(code) {
  if (!code || typeof code !== 'string') return '';
  const trimmed = code.trim();

  // If code already contains clean multiple lines, preserve its formatting
  if (trimmed.includes('\n')) {
    return trimmed;
  }

  // Format single-line condensed blocks
  let formatted = trimmed
    .replace(/;\s*(?!\s*\})/g, ';\n')
    .replace(/\{\s*/g, '{\n  ')
    .replace(/\s*\}\s*/g, '\n}\n')
    .replace(/\/\/\s*([^\n]+)/g, '// $1\n');

  return formatted.trim();
}

function extractText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return String(node || '');
}

/**
 * Professional IDE-grade Syntax-Highlighted Code Block with Line Numbers & Copy.
 */
export default function HighlightedCodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);

  // Extract raw text from children
  const rawCode = useMemo(() => {
    return extractText(children);
  }, [children]);

  // Extract language from className (e.g. "language-javascript")
  const langMatch =
    typeof className === 'string'
      ? className.match(/language-([\w+#.-]+)/)
      : children?.props?.className?.match(/language-([\w+#.-]+)/);
  const langLabel = langMatch ? langMatch[1] : 'javascript';

  // Beautify and split into lines
  const lines = useMemo(() => {
    const formatted = beautifyCode(rawCode);
    return formatted.split('\n');
  }, [rawCode]);

  const tokenizedLines = useMemo(() => {
    return lines.map((line) => tokenizeLine(line));
  }, [lines]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawCode.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [rawCode]);

  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeToolbar}>
        <div className={styles.codeHeaderLeft}>
          <div className={styles.codeDotGroup} aria-hidden="true">
            <span className={styles.dotRed} />
            <span className={styles.dotYellow} />
            <span className={styles.dotGreen} />
          </div>
          <span className={styles.codeLang}>{langLabel}</span>
        </div>

        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden />
              Copied!
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>

      <pre className={styles.pre}>
        <div className={styles.codeContainer}>
          {tokenizedLines.map((tokens, lineIdx) => (
            <div key={lineIdx} className={styles.codeRow}>
              <span className={styles.lineNumber}>{lineIdx + 1}</span>
              <span className={styles.lineContent}>
                {tokens.map((token, tokenIdx) => (
                  <span key={tokenIdx} className={getTokenClass(token.type)}>
                    {token.value}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </pre>
    </div>
  );
}
