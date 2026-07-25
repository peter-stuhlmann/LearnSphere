/**
 * Sicherer Renderer + Validierung für HTML/CSS/JS-Lektionsblöcke.
 *
 * Ausgeführt wird ein Block AUSSCHLIESSLICH in einem <iframe sandbox srcdoc>.
 * JavaScript ist optional: liegt im eigenen `script`-Feld Code vor, läuft er in
 * einer opaque Origin – `sandbox="allow-scripts"` OHNE `allow-same-origin`
 * (die Kombination wäre unsicher) – plus strikter CSP im srcdoc, die u. a.
 * `connect-src 'none'` setzt und damit Daten-Exfiltration unterbindet. Wer JS
 * einträgt, will es ausführen; eine separate Freigabe gibt es bewusst nicht.
 */

export interface HtmlBlockInput {
  html: string;
  css: string;
  /** JavaScript des Blocks (leer = kein Skript, Sandbox ohne allow-scripts) */
  script: string;
}

/** Enthält der Block ausführbares JavaScript? */
export function htmlBlockHasScript(script: string): boolean {
  return Boolean(script && script.trim());
}

/**
 * Wert des sandbox-Attributs. NIEMALS `allow-same-origin` zu `allow-scripts`
 * ergänzen – sonst könnte der Block-Code aus der Sandbox ausbrechen.
 */
export function htmlBlockSandbox(script: string): string {
  return htmlBlockHasScript(script) ? "allow-scripts" : "";
}

/** CSP fürs srcdoc: keine Skripte (bzw. nur inline mit Code), kein Netz. */
export function htmlBlockCsp(hasScript: boolean): string {
  return [
    "default-src 'none'",
    `script-src ${hasScript ? "'unsafe-inline'" : "'none'"}`,
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "font-src data: https:",
    "media-src data: https:",
    // blockt fetch/XHR/WebSocket/sendBeacon → keine Exfiltration
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/** `</script>` im Code darf den injizierten Skript-Kontext nicht schließen. */
function escapeScriptEnd(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * Vollständiges HTML-Dokument fürs srcdoc. Standard-Hintergrund ist dunkel
 * (passend zur Plattform); wer Weiß will, setzt es per eigenem CSS. Der String
 * wird als Attributwert gesetzt (React escaped ihn).
 */
export function buildHtmlBlockSrcDoc(input: HtmlBlockInput): string {
  const run = htmlBlockHasScript(input.script);
  const csp = htmlBlockCsp(run);
  const scriptTag = run
    ? `<script>${escapeScriptEnd(input.script)}</script>`
    : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<style>body{font-family:system-ui,sans-serif;margin:16px;` +
    `background:#0B0C15;color:#EDEDF2}` +
    `${input.css ?? ""}</style></head><body>` +
    `${input.html ?? ""}${scriptTag}</body></html>`
  );
}

/* ---------------------------- Validierung ---------------------------- */

export interface CodeIssue {
  message: string;
}

export interface BlockValidation {
  html: CodeIssue[];
  css: CodeIssue[];
  js: CodeIssue[];
  get ok(): boolean;
}

/** Kommentare/Strings aus CSS entfernen, damit Klammern darin nicht zählen. */
function stripCss(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const two = css.slice(i, i + 2);
    if (two === "/*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) {
        if (css[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** CSS-Syntax grob prüfen: ausgeglichene {} und () (Strings/Kommentare raus). */
export function validateCss(css: string): CodeIssue[] {
  if (!css || !css.trim()) return [];
  const cleaned = stripCss(css);
  const issues: CodeIssue[] = [];
  let curly = 0;
  let paren = 0;
  for (const ch of cleaned) {
    if (ch === "{") curly++;
    else if (ch === "}") {
      curly--;
      if (curly < 0) {
        issues.push({ message: "Unerwartete schließende geschweifte Klammer }" });
        curly = 0;
      }
    } else if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);
  }
  if (curly > 0) {
    issues.push({ message: "Nicht geschlossene geschweifte Klammer {" });
  }
  if (paren !== 0) {
    issues.push({ message: "Unausgeglichene runde Klammern ()" });
  }
  return issues;
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * HTML grob prüfen: ausgeglichene Tags. Kommentare, Doctype, Void-Elemente und
 * selbstschließende Tags werden korrekt übersprungen; `<script>`/`<style>`
 * werden als Rohtext behandelt (Klammern darin zählen nicht als Tags).
 */
export function validateHtml(html: string): CodeIssue[] {
  if (!html || !html.trim()) return [];
  const issues: CodeIssue[] = [];
  const stack: string[] = [];
  const tagRe = /<!--[\s\S]*?-->|<!\w[\s\S]*?>|<\/?([a-zA-Z][\w-]*)([^>]*)>/g;
  let match: RegExpExecArray | null;
  let raw: string | null = null; // innerhalb <script>/<style>

  while ((match = tagRe.exec(html)) !== null) {
    const full = match[0];
    const name = match[1]?.toLowerCase();
    if (!name) continue; // Kommentar oder Doctype

    // Rohtext-Modus: nur das passende End-Tag beendet ihn
    if (raw) {
      if (full.startsWith("</") && name === raw) raw = null;
      continue;
    }

    if (full.startsWith("</")) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) {
        issues.push({ message: `Schließendes </${name}> ohne passendes Öffnen` });
      } else {
        if (idx !== stack.length - 1) {
          issues.push({ message: `Falsch verschachteltes </${name}>` });
        }
        stack.length = idx;
      }
    } else if (!VOID_ELEMENTS.has(name) && !match[2].trimEnd().endsWith("/")) {
      if (name === "script" || name === "style") raw = name;
      else stack.push(name);
    }
  }

  for (const name of stack) {
    issues.push({ message: `Nicht geschlossenes <${name}>` });
  }
  return issues;
}

/** JavaScript-Syntax prüfen, OHNE den Code auszuführen. */
export function validateJs(code: string): CodeIssue[] {
  if (!code || !code.trim()) return [];
  try {
    // Function-Konstruktor parst den Body, führt ihn aber nicht aus
    new Function(code);
    return [];
  } catch (err) {
    // new Function wirft ausschließlich einen SyntaxError (also ein Error)
    return [{ message: (err as Error).message }];
  }
}

/** Kompletten Block validieren (HTML, CSS und das JS-Feld). */
export function validateHtmlBlock(input: {
  html: string;
  css: string;
  script: string;
}): BlockValidation {
  const html = validateHtml(input.html);
  const css = validateCss(input.css);
  const js = validateJs(input.script);
  return {
    html,
    css,
    js,
    get ok() {
      return this.html.length === 0 && this.css.length === 0 && this.js.length === 0;
    },
  };
}
