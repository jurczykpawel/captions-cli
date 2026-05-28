/**
 * Export-engine registry. The app calls getExportEngine() and never touches a
 * concrete engine — swap or reorder this list to change engines.
 */
import type { ExportEngine } from './types';
import { pickEngine } from './types';
import { mediabunnyEngine } from './mediabunny-engine';

export const EXPORT_ENGINES: readonly ExportEngine[] = [mediabunnyEngine];

export function getExportEngine(): ExportEngine | null {
  return pickEngine(EXPORT_ENGINES);
}

export function isExportSupported(): boolean {
  return getExportEngine() !== null;
}

export type { ExportEngine, ExportRequest, ExportResult, StageFactory } from './types';
