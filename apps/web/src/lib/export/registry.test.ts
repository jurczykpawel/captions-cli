import { test, expect } from 'bun:test';
import { pickEngine, type ExportEngine } from './types';

const fake = (id: string, ok: boolean): ExportEngine => ({
  id,
  isSupported: () => ok,
  export: async () => ({ blob: new Blob(), mimeType: 'video/mp4', extension: 'mp4' }),
});

test('pickEngine returns the first supported engine', () => {
  expect(pickEngine([fake('a', false), fake('b', true), fake('c', true)])?.id).toBe('b');
});

test('pickEngine returns null when none are supported', () => {
  expect(pickEngine([fake('a', false), fake('b', false)])).toBeNull();
});

test('pickEngine handles an empty list', () => {
  expect(pickEngine([])).toBeNull();
});
