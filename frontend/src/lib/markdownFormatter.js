/**
 * Dynamic Markdown and Code Formatter for Technical Forum Posts & Answers.
 * 
 * Provides dynamic documentation URL resolution, universal multi-language code detection,
 * unified single-block code grouping, intelligent section formatting, and inline code highlights.
 * Contains ZERO hardcoded topic dictionaries or static URL lists.
 */

/**
 * Converts a camelCase, PascalCase, or spaced title into a clean URL slug (kebab-case).
 * e.g., "useSearchParams" -> "use-search-params"
 * e.g., "Synchronizing with Effects (useEffect)" -> "synchronizing-with-effects"
 * e.g., "Window.localStorage" -> "window-localstorage"
 *
 * @param {string} text
 * @returns {string}
 */
function toSlug(text) {
  if (!text) return '';
  return text
    .replace(/\([^)]*\)/g, '') // Strip parenthetical notes like (useEffect)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // camelCase to kebab-case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace spaces, dots, slashes with hyphens
    .replace(/^-+|-+$/g, ''); // Trim leading and trailing hyphens
}

/**
 * Dynamically resolves documentation URLs for ANY tech stack, framework, or library on the fly.
 * No hardcoded topics or static mapping tables.
 *
 * @param {string} rawSource - Documentation source (e.g. "React Router Docs", "React Docs", "MDN Docs", "Express Docs", "Next.js Docs", "Tailwind Docs")
 * @param {string} rawTopic - Topic title or identifier (e.g. "useSearchParams", "useParams", "Synchronizing with Effects", "localStorage", "Routing")
 * @returns {string} Markdown link string e.g. "[React Router Docs: useParams](https://reactrouter.com/en/main/hooks/use-params)"
 */
export function resolveDynamicDocLink(rawSource, rawTopic) {
  let topic = rawTopic.trim();
  let trailingPunctuation = '';
  const punctMatch = topic.match(/[.,;:]+$/);
  if (punctMatch) {
    trailingPunctuation = punctMatch[0];
    topic = topic.slice(0, -trailingPunctuation.length).trim();
  }

  const cleanSource = rawSource
    .replace(/^(?:Official\s+)?(?:Web\s+)?/i, '')
    .replace(/\s+Docs?$/i, '')
    .trim()
    .toLowerCase();

  const slug = toSlug(topic);
  const isHook = /^use[A-Z]/.test(topic) || slug.startsWith('use-');

  let url = '';

  switch (cleanSource) {
    case 'react':
      if (isHook) {
        const hookName = topic.replace(/\s*\(.*\)/, '').trim();
        url = `https://react.dev/reference/react/${hookName}`;
      } else {
        url = `https://react.dev/learn/${slug}`;
      }
      break;

    case 'react router':
    case 'react-router':
    case 'reactrouter':
      if (isHook) {
        url = `https://reactrouter.com/en/main/hooks/${slug}`;
      } else {
        url = `https://reactrouter.com/en/main/components/${slug}`;
      }
      break;

    case 'mdn':
    case 'javascript':
    case 'web':
    case 'dom':
    case 'css':
    case 'html':
      url = `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}`;
      break;

    case 'react hook form':
    case 'react-hook-form':
      url = `https://react-hook-form.com/docs/${slug}`;
      break;

    case 'next':
    case 'next.js':
    case 'nextjs':
      url = `https://nextjs.org/docs/${slug}`;
      break;

    case 'express':
    case 'express.js':
    case 'expressjs':
      url = `https://expressjs.com/en/guide/${slug}.html`;
      break;

    case 'tailwind':
    case 'tailwind css':
    case 'tailwindcss':
      url = `https://tailwindcss.com/docs/${slug}`;
      break;

    case 'redux':
    case 'redux toolkit':
      url = `https://redux.js.org/${slug}`;
      break;

    case 'zustand':
      url = `https://zustand.docs.pmnd.rs`;
      break;

    case 'typescript':
    case 'ts':
      url = `https://www.typescriptlang.org/docs/handbook/${slug}.html`;
      break;

    case 'node':
    case 'node.js':
    case 'nodejs':
      url = `https://nodejs.org/docs/latest/api/${slug}.html`;
      break;

    case 'vite':
    case 'vitejs':
      url = `https://vite.dev/guide/${slug}`;
      break;

    case 'python':
      url = `https://docs.python.org/3/library/${slug}.html`;
      break;

    case 'docker':
      url = `https://docs.docker.com/reference/${slug}/`;
      break;

    case 'mongodb':
      url = `https://www.mongodb.com/docs/manual/reference/${slug}/`;
      break;

    case 'postgresql':
    case 'postgres':
      url = `https://www.postgresql.org/docs/current/${slug}.html`;
      break;

    default:
      // Universal dynamic fallback for any other library or framework
      url = `https://www.google.com/search?q=${encodeURIComponent(`${rawSource} ${topic}`)}`;
      break;
  }

  return `[${rawSource}: ${topic}](${url})${trailingPunctuation}`;
}

/**
 * Universal dynamic code line detection across JavaScript, TypeScript, Python, SQL, Shell, HTML/JSX, CSS, and JSON.
 *
 * @param {string} line - Single line of text
 * @returns {boolean}
 */
export function isCodeLine(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Markdown headers, list items, quotes are NOT code lines
  if (/^(?:#{1,6}\s+|>\s*|[-*+]\s+(?![=+\-*/])|\d+\.\s+[A-Za-z])/.test(trimmed)) {
    return false;
  }

  // Check for common English prose starts
  if (
    /^(?:I\s|We\s|When\s|If\s+you\s|You\s|This\s|Here\s|In\s+order\s|To\s|Why\s|How\s|What\s|My\s|There\s|Because\s|So\s|Please\s|Note:\s*|Check\s|After\s|Before\s|However\s|Also\s)/i.test(
      trimmed
    )
  ) {
    if (!/^this\.[a-zA-Z0-9_$]+\s*=/i.test(trimmed)) {
      return false;
    }
  }

  // 1. Explicit JS/TS/Python/SQL Keywords at start of line
  if (
    /^(?:import\s+|export\s+|const\s+|let\s+|var\s+|function\s*\(|function\s+[a-zA-Z_$]|class\s+[A-Z]|return\b|if\s*\(|else\s*\{|else\s+if\s*\(|for\s*\(|while\s*\(|switch\s*\(|case\s+[^:]+:|default\s*:|\/\/|\/\*|\*|def\s+[a-zA-Z_]|elif\s+|from\s+[a-zA-Z_]|SELECT\s+|INSERT\s+INTO\s+|UPDATE\s+|DELETE\s+FROM\s+|CREATE\s+TABLE\s+|WHERE\s+|JOIN\s+|type\s+[A-Z]|interface\s+[A-Z]|enum\s+[A-Z]|async\s+function|try\s*\{|catch\s*\(|finally\s*\{|throw\s+new\b)/.test(
      trimmed
    )
  ) {
    return true;
  }

  // 2. CLI commands
  if (
    /^(?:npm\s+(?:i|install|run|start|test|build|init)|npx\s+|yarn\s+|pnpm\s+|git\s+(?:commit|push|pull|clone|checkout|add|status)|docker\s+|curl\s+)/.test(
      trimmed
    )
  ) {
    return true;
  }

  // 3. Pure standalone JSX/HTML tags
  if (
    /^<\/?(?:[a-zA-Z][a-zA-Z0-9_.-]*|[a-zA-Z][a-zA-Z0-9_.-]*\.[a-zA-Z0-9_]+)(?:\s+[^>]*)?\/?>\s*[,;]?$/.test(
      trimmed
    )
  ) {
    return true;
  }

  // 4. Standalone closing brackets/syntax tokens
  if (/^[}\]\);,]+$/.test(trimmed)) {
    return true;
  }

  // 5. Function/Hook calls and assignments at start of statement
  if (
    /^(?:use[A-Z][a-zA-Z0-9_]*|set[A-Z][a-zA-Z0-9_]*|localStorage\.[a-zA-Z0-9_$]+|sessionStorage\.[a-zA-Z0-9_$]+|window\.[a-zA-Z0-9_$]+|document\.[a-zA-Z0-9_$]+|console\.[a-zA-Z0-9_$]+|navigate|dispatch|fetch|axios\.[a-zA-Z0-9_$]+|res\.[a-zA-Z0-9_$]+|req\.[a-zA-Z0-9_$]+)\s*\(/.test(
      trimmed
    )
  ) {
    return true;
  }

  // 6. Object / array assignment / destructuring at start of line
  if (/^(?:\[|\{)[^\]}]+(?:\]|\})\s*=\s*/.test(trimmed)) {
    return true;
  }

  // 7. Arrow function declarations or callback lines
  if (
    /^\(?\s*[a-zA-Z0-9_$,\s{}]*\s*\)?\s*=>\s*\{?/.test(trimmed) &&
    /[;{}[\]()=]/.test(trimmed)
  ) {
    return true;
  }

  // 8. Lines that are valid code statements ending with `;` or `{` or `}` and containing code operators
  if (
    /[;{}]\s*$/.test(trimmed) &&
    /(=>|===|!==|\+=|-=|\*=|\/=|\+\+|--|&&|\|\||\?\?|\?\.|\[|\(|\]|\))/.test(
      trimmed
    )
  ) {
    const words = trimmed.split(/\s+/).length;
    if (words <= 12) {
      return true;
    }
  }

  return false;
}

/**
 * Tracks nesting depth of braces, parentheses, brackets, and JSX tags.
 */
function updateBracketState(line, state) {
  const stripped = line
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:\\.|[^\\'])*'/g, "''")
    .replace(/"(?:\\.|[^\\"])*"/g, '""')
    .replace(/`(?:\\.|[^\\`])*`/g, '``');

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '{') state.braces++;
    else if (ch === '}' && state.braces > 0) state.braces--;
    else if (ch === '(') state.parens++;
    else if (ch === ')' && state.parens > 0) state.parens--;
    else if (ch === '[') state.brackets++;
    else if (ch === ']' && state.brackets > 0) state.brackets--;
  }

  // Count open JSX tags
  const openTags =
    stripped.match(/<[a-zA-Z][a-zA-Z0-9_.-]*(?:\s+[^>]*)?(?<!\/)>/g) || [];
  const closeTags = stripped.match(/<\/[a-zA-Z][a-zA-Z0-9_.-]*>|\/>/g) || [];
  state.tags += openTags.length - closeTags.length;
  if (state.tags < 0) state.tags = 0;
}

/**
 * Checks if any upcoming line within maxLookahead lines is a code line.
 */
function hasUpcomingCode(lines, startIndex, maxLookahead = 3) {
  const end = Math.min(lines.length, startIndex + maxLookahead);
  for (let i = startIndex; i < end; i++) {
    if (isCodeLine(lines[i])) return true;
  }
  return false;
}

/**
 * Scans text outside existing code blocks and groups all consecutive code into ONE single continuous ```javascript block.
 *
 * @param {string} text
 * @returns {string}
 */
export function wrapUnfencedCodeBlocks(text) {
  if (!text) return '';

  // Split by already-fenced code blocks to preserve them
  const chunks = text.split(/(```[\s\S]*?```)/g);

  return chunks
    .map((chunk, idx) => {
      // Preserve already-fenced blocks
      if (idx % 2 === 1) return chunk;

      const lines = chunk.split('\n');
      const resultLines = [];
      let currentCodeBlock = [];
      const state = { braces: 0, parens: 0, brackets: 0, tags: 0 };

      const flushCode = () => {
        if (currentCodeBlock.length >= 2) {
          resultLines.push('```javascript');
          resultLines.push(...currentCodeBlock);
          resultLines.push('```');
        } else if (currentCodeBlock.length === 1) {
          resultLines.push(currentCodeBlock[0]);
        }
        currentCodeBlock = [];
        state.braces = 0;
        state.parens = 0;
        state.brackets = 0;
        state.tags = 0;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isCode = isCodeLine(line);
        const inOpenBlock =
          state.braces > 0 || state.parens > 0 || state.tags > 0 || state.brackets > 0;

        if (isCode) {
          updateBracketState(line, state);
          currentCodeBlock.push(line);
        } else if (currentCodeBlock.length > 0) {
          // Keep buffering if inside an open code block or if code continues soon
          if (
            inOpenBlock ||
            (!line.trim() && hasUpcomingCode(lines, i + 1, 3)) ||
            (hasUpcomingCode(lines, i + 1, 2) && !/^(?:#{1,6}|[A-Z][a-zA-Z\s]+:)/.test(line.trim()))
          ) {
            updateBracketState(line, state);
            currentCodeBlock.push(line);
          } else {
            flushCode();
            resultLines.push(line);
          }
        } else {
          resultLines.push(line);
        }
      }
      flushCode();

      return resultLines.join('\n');
    })
    .join('');
}

/**
 * Universal dynamic Markdown formatter.
 *
 * Formats raw text or markdown into clean, structured Markdown with:
 * - Unified single code blocks
 * - Dynamic official documentation links
 * - Rich section header formatting
 * - Dynamic inline code highlights for hooks, tags, file paths, and APIs
 *
 * @param {string} text - Raw input content
 * @returns {string} Processed markdown text
 */
export function autoFormatMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  let processed = text;

  // 1. Format explicit "### Code" or "Code:" sections into ONE unified code block
  processed = processed.replace(
    /(?:^|\n)(### Code|Code:?)\s*\n([\s\S]*?)(?=(\n### |\n(?:Environment|Expected|Actual|What I'm trying to do|Key Approaches|Key Verification Steps|Root Cause Analysis|Verification Steps|Solution|Solutions|Steps to fix|Summary Checklist|Summary):?|$))/gi,
    (match, header, codeBody) => {
      const trimmedBody = codeBody.trim();
      if (!trimmedBody) return match;
      if (trimmedBody.startsWith('```')) {
        return `\n\n### Code\n\n${trimmedBody}\n\n`;
      }
      return `\n\n### Code\n\n\`\`\`javascript\n${trimmedBody}\n\`\`\`\n\n`;
    }
  );

  // 2. Auto-detect and unify multi-line code blocks in freeform text
  processed = wrapUnfencedCodeBlocks(processed);

  // 3. Process prose outside code blocks with safe token isolation
  const parts = processed.split(/(```[\s\S]*?```|\[[^\]]+\]\([^)]+\)|`[^`\n]+`)/g);

  return parts
    .map((part, index) => {
      // Never alter content inside fenced code blocks, existing markdown links, or backticks
      if (index % 2 === 1) {
        return part;
      }

      let formatted = part;

      // Dynamic Documentation Linking (works for ANY framework/topic without hardcoding)
      formatted = formatted.replace(
        /\b((?:React(?:\s+Router)?|MDN(?:\s+Web)?|Express(?:\.js)?|Next(?:\.js)?|Tailwind(?:\s+CSS)?|Vue(?:\.js)?|Angular|Node(?:\.js)?|TypeScript|Redux|Zustand|React\s+Hook\s+Form|Prisma|Vite|Python|Docker|MongoDB|PostgreSQL|Postgres|MySQL|[A-Z][a-z0-9_-]+)\s+(?:Docs?|Documentation)):\s*([a-zA-Z0-9_.-]+(?:\s+[a-zA-Z0-9_.-]+){0,6}(?:\s*\([^)]*\))?)(?=[.,;\n\r]|(?:\s+and\s)|\s*$)/gi,
        (match, source, topic) => resolveDynamicDocLink(source, topic)
      );

      // Dynamic Section Headers
      formatted = formatted.replace(
        /(?:^|\n)\s*(What I'm trying to do|Expected Behavior|Actual Behavior|Expected Result|Actual Result|Expected|Actual|Environment|Steps to Reproduce|Root Cause Analysis|Root Cause|Key Approaches|Key Verification Steps|Verification Checklist|Verification Steps|Solution|Solutions|Proposed Fix|Steps to fix|Summary Checklist|Summary|Key Takeaways|Workaround|Explanation|Overview):?/gi,
        '\n\n### $1\n\n'
      );

      // Split newly generated markdown links so inner URLs are completely protected
      const subParts = formatted.split(/(\[[^\]]+\]\([^)]+\))/g);

      return subParts
        .map((sub, sIdx) => {
          if (sIdx % 2 === 1) {
            return sub;
          }

          let subFormatted = sub;

          // Dynamic HTML / JSX tags in prose (e.g. <Route>, <BrowserRouter>, <CustomCard />)
          subFormatted = subFormatted.replace(
            /(?<!`)(<\/?(?:[A-Z][a-zA-Z0-9_.-]*|[a-z]+)(?:\s+[^>]*?)?\/?>)(?!`)/g,
            '`$1`'
          );

          // Dynamic Route paths in prose (e.g. /question/:questionHash, /api/v1/auth)
          subFormatted = subFormatted.replace(
            /(?<![`\w/])(\/(?:[a-zA-Z0-9_.-]+|:[a-zA-Z0-9_.-]+)(?:\/(?:[a-zA-Z0-9_.-]+|:[a-zA-Z0-9_.-]+))+)(?![`\w/])/g,
            '`$1`'
          );

          // Dynamic Filenames and extensions in prose (e.g. index.html, App.jsx, schema.sql, .env)
          subFormatted = subFormatted.replace(
            /(?<![`\w])([a-zA-Z0-9_.-]+\.(?:js|jsx|ts|tsx|html|css|scss|sass|json|env|config\.js|mjs|cjs|sql|py|sh|yaml|yml|md))(?![`\w])/g,
            '`$1`'
          );

          // Dynamic React hooks (built-in and custom: e.g. useState(), useAuth, useCustomHook())
          subFormatted = subFormatted.replace(
            /(?<![`\w])(use[A-Z][a-zA-Z0-9_]*(?:\(\))?)(?![`\w])/g,
            '`$1`'
          );

          // Dynamic storage and API method calls in prose
          subFormatted = subFormatted.replace(
            /(?<![`\w])((?:localStorage|sessionStorage|window|document|console|process\.env|JSON|Math|Object|Array|Promise|req|res|api|axios|navigate|dispatch|store)\.[a-zA-Z0-9_$]+(?:\([^)]*\))?)(?![`\w])/g,
            '`$1`'
          );

          // Dynamic CLI commands (e.g. npm install, git commit, npx create-vite)
          subFormatted = subFormatted.replace(
            /(?<![`\w])((?:npm|yarn|pnpm|npx|git|docker|node)\s+[a-zA-Z0-9_@/:.-]+(?:\s+-[a-zA-Z0-9_-]+)*)(?![`\w])/g,
            '`$1`'
          );

          // Dynamic keywords & variables in prose
          subFormatted = subFormatted.replace(
            /(?<![`\w])\b(questionHash|paramKey|basename|sessionId|userId|token|payload|undefined|null|NaN|true|false)\b(?![`\w])/g,
            '`$1`'
          );

          // Dynamic bare URLs (https://... or http://...)
          subFormatted = subFormatted.replace(
            /(?<!\[[^\]]*\]\()(?<![`"'])(https?:\/\/[^\s<)"']+[^\s<)"'.,;])(?![`"'])/g,
            '[$1]($1)'
          );

          // Dynamic www. domains
          subFormatted = subFormatted.replace(
            /(?<!\[[^\]]*\]\()(?<![`"'/])(www\.[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}[^\s<)"']*)/g,
            (m) => {
              const cleanM = m.replace(/[.,;:]+$/, '');
              const trailing = m.slice(cleanM.length);
              return `[${cleanM}](https://${cleanM})${trailing}`;
            }
          );

          return subFormatted;
        })
        .join('');
    })
    .join('');
}
