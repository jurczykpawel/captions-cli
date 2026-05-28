/**
 * Variable injector for the HF composition. Replaces `{{key}}` slots
 * with values from `vars`. Keys ending in `Block`/`Html` pass through
 * verbatim (HTML/JS blocks); keys matching `url` or `src$` are
 * URL-validated; everything else gets HTML-escaped.
 *
 * Empty URL is allowed (composition treats it as "no asset").
 */
const SAFE_URL = /^https?:\/\/[^\s'"<>]+$/;

function htmlEscape(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(raw: unknown): string {
  const s = String(raw);
  if (s === '') return '';
  if (!SAFE_URL.test(s)) {
    throw new Error(
      `Unsafe URL value "${s.substring(0, 60)}" — only http(s) URLs allowed in template vars.`,
    );
  }
  return s;
}

function isUrlKey(key: string): boolean {
  return /url|src$/i.test(key);
}

function isHtmlBlockKey(key: string): boolean {
  return /(Block|Html)$/.test(key);
}

export function injectVariables(source: string, vars: Record<string, unknown>): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Template variable "${key}" is not defined.`);
    }
    const value = vars[key];
    if (isUrlKey(key)) return sanitizeUrl(value);
    if (isHtmlBlockKey(key)) return String(value);
    return htmlEscape(value);
  });
}
