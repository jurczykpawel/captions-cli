/**
 * ASS / SSA format helpers. Reference:
 *   https://aegisub.org/docs/latest/ASS_Tags/
 *
 * Quirks worth knowing:
 *   - Colour format is `&H<AA><BB><GG><RR>&` — alpha + BGR, NOT RGB.
 *     Web `#RRGGBB` is reversed to `&H00<BB><GG><RR>&` (alpha 0 = opaque).
 *   - Times in dialogue events use `H:MM:SS.cc` (centiseconds).
 *   - Transition tag `\t(t1,t2,...)` uses MILLISECONDS relative to the
 *     dialogue start, not absolute movie time.
 *   - The tag block lives inside `{...}` braces. Inside text content,
 *     literal `{` / `}` / `\` need backslash-escaping.
 */

/** Convert `#RRGGBB` → `&H00<BB><GG><RR>&` (libass colour literal). */
export function hexToAss(hex: string): string {
  const cleaned = hex.replace('#', '').toUpperCase();
  if (cleaned.length !== 6) {
    throw new Error(`hexToAss expects #RRGGBB, got "${hex}"`);
  }
  const rr = cleaned.slice(0, 2);
  const gg = cleaned.slice(2, 4);
  const bb = cleaned.slice(4, 6);
  return `&H00${bb}${gg}${rr}&`;
}

/** Seconds → `H:MM:SS.cc` for ASS dialogue Start/End. */
export function secondsToAssTime(s: number): string {
  if (s < 0) s = 0;
  const totalCs = Math.floor(s * 100);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Escape a word for safe inclusion in an ASS dialogue event. Backslash,
 * curly braces, and newline-equivalents need handling so they don't get
 * parsed as tags or line breaks.
 */
export function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}
