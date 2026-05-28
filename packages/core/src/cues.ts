/**
 * Cue grouping — pure, environment-agnostic. No node/browser APIs, so it is
 * shared verbatim by the CLI (node) and the web app (browser).
 */
import type { Word, Cue } from './types';

/**
 * Group flat word stream into caption cues. Splits on:
 *  1. Punctuation at the end of a word (`.`, `!`, `?`, `,`).
 *  2. Long silence (>0.7s) between consecutive words.
 *  3. Cue size cap: max 5 words OR max 3 seconds of duration.
 */
export function groupWordsIntoCues(words: Word[]): Cue[] {
  const cues: Cue[] = [];
  let current: Word[] = [];
  let cueStart = 0;
  const MAX_WORDS = 5;
  const MAX_DURATION = 3;
  const SILENCE_THRESHOLD = 0.7;

  const flush = () => {
    if (current.length === 0) return;
    const last = current[current.length - 1];
    cues.push({
      id: `cue-${cues.length}`,
      text: current.map((w) => w.text).join(' '),
      startTime: cueStart,
      endTime: last.endTime,
      words: [...current],
    });
    current = [];
  };

  words.forEach((w) => {
    if (current.length === 0) {
      cueStart = w.startTime;
      current.push(w);
      return;
    }
    const prev = current[current.length - 1];
    const silence = w.startTime - prev.endTime;
    const duration = w.endTime - cueStart;
    const tooLong = current.length >= MAX_WORDS || duration >= MAX_DURATION;
    const punctEnd = /[.!?,;:]$/.test(prev.text);
    const longGap = silence > SILENCE_THRESHOLD;
    if (tooLong || punctEnd || longGap) {
      flush();
      cueStart = w.startTime;
    }
    current.push(w);
  });
  flush();

  return cues;
}
