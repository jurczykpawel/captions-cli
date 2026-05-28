import { test, expect } from 'bun:test';
import { groupWordsIntoCues } from './transcribe';
import type { Word } from './types';

const w = (text: string, startTime: number, endTime: number): Word => ({
  text,
  startTime,
  endTime,
});

test('empty input yields no cues', () => {
  expect(groupWordsIntoCues([])).toEqual([]);
});

test('a short clause becomes a single cue', () => {
  const cues = groupWordsIntoCues([w('hello', 0, 0.3), w('there', 0.3, 0.6)]);
  expect(cues).toHaveLength(1);
  expect(cues[0].text).toBe('hello there');
  expect(cues[0].words).toHaveLength(2);
});

test('splits on sentence-ending punctuation', () => {
  const cues = groupWordsIntoCues([
    w('stop.', 0, 0.3),
    w('go', 0.35, 0.6),
  ]);
  expect(cues).toHaveLength(2);
});

test('caps a cue at 5 words', () => {
  const words = ['one', 'two', 'three', 'four', 'five', 'six'].map((t, i) =>
    w(t, i * 0.2, i * 0.2 + 0.15),
  );
  const cues = groupWordsIntoCues(words);
  expect(cues[0].words.length).toBeLessThanOrEqual(5);
  expect(cues).toHaveLength(2);
});

test('splits on a long silence gap', () => {
  const cues = groupWordsIntoCues([
    w('before', 0, 0.3),
    w('after', 2.0, 2.3), // >0.7s gap
  ]);
  expect(cues).toHaveLength(2);
});
