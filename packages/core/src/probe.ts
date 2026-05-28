/**
 * ffprobe wrapper. Engine-agnostic — both HF and ASS engines need to
 * know the source dimensions + duration before rendering.
 */
import { execFileSync } from 'node:child_process';
import type { VideoProbe } from './types';

export function probeVideo(videoPath: string): VideoProbe {
  const out = execFileSync(
    'ffprobe',
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-show_entries', 'format=duration',
      '-of', 'json',
      videoPath,
    ],
    { encoding: 'utf-8' },
  );
  const json = JSON.parse(out) as {
    streams: { width: number; height: number }[];
    format: { duration: string };
  };
  return {
    durationSeconds: parseFloat(json.format.duration),
    width: json.streams[0]?.width ?? 1080,
    height: json.streams[0]?.height ?? 1920,
  };
}
