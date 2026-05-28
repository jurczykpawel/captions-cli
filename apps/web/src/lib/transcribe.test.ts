import { test, expect } from 'bun:test';
import { mapChunksToWords } from './transcribe';

test('maps word chunks to core words, trimming text', () => {
  const words = mapChunksToWords([
    { text: ' hello', timestamp: [0, 0.5] },
    { text: 'world ', timestamp: [0.5, 1.0] },
  ]);
  expect(words).toEqual([
    { text: 'hello', startTime: 0, endTime: 0.5 },
    { text: 'world', startTime: 0.5, endTime: 1.0 },
  ]);
});

test('drops empty/whitespace chunks', () => {
  const words = mapChunksToWords([
    { text: '   ', timestamp: [0, 0.2] },
    { text: 'hi', timestamp: [0.2, 0.4] },
  ]);
  expect(words).toHaveLength(1);
  expect(words[0].text).toBe('hi');
});

test('repairs a missing final end timestamp', () => {
  const words = mapChunksToWords([{ text: 'end', timestamp: [2, null] }]);
  expect(words[0].startTime).toBe(2);
  expect(words[0].endTime).toBeGreaterThan(2);
});

test('clamps end below start up to start', () => {
  const words = mapChunksToWords([{ text: 'x', timestamp: [1, 0.5] }]);
  expect(words[0].endTime).toBe(1);
});
