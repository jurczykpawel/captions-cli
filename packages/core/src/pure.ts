/**
 * Browser-safe entry: types + pure cue grouping only. No node:* imports, so it
 * bundles cleanly for the web app. The default entry (./index) pulls in
 * node-only transcription/probe and must NOT be imported from the browser.
 */
export * from './types';
export { groupWordsIntoCues } from './cues';
