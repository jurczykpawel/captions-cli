import { test, expect } from 'bun:test';
import { checkVideo, isVideoFile, MAX_DURATION_SECONDS } from './media';

test('isVideoFile accepts video mime types only', () => {
  expect(isVideoFile('video/mp4')).toBe(true);
  expect(isVideoFile('video/webm')).toBe(true);
  expect(isVideoFile('image/png')).toBe(false);
  expect(isVideoFile('')).toBe(false);
});

test('checkVideo rejects non-video files', () => {
  expect(checkVideo({ type: 'image/png', durationSeconds: 5 })).toEqual({
    ok: false,
    reason: 'invalid',
  });
});

test('checkVideo rejects unreadable/zero duration', () => {
  expect(checkVideo({ type: 'video/mp4', durationSeconds: 0 })).toEqual({
    ok: false,
    reason: 'invalid',
  });
  expect(checkVideo({ type: 'video/mp4', durationSeconds: NaN })).toEqual({
    ok: false,
    reason: 'invalid',
  });
});

test('checkVideo rejects clips longer than the cap', () => {
  expect(checkVideo({ type: 'video/mp4', durationSeconds: MAX_DURATION_SECONDS + 1 })).toEqual({
    ok: false,
    reason: 'too-long',
  });
});

test('checkVideo accepts a valid short clip', () => {
  expect(checkVideo({ type: 'video/mp4', durationSeconds: 42 })).toEqual({ ok: true });
  expect(checkVideo({ type: 'video/quicktime', durationSeconds: MAX_DURATION_SECONDS })).toEqual({
    ok: true,
  });
});
