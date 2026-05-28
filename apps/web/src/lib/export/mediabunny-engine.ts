/**
 * Default export engine: Mediabunny (WebCodecs). Decodes the source video
 * frame-by-frame, composites the caption overlay onto a canvas, and re-encodes
 * to H.264/AAC MP4 — all locally. Same library family OpenReel uses.
 */
import {
  Input,
  Output,
  BlobSource,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  CanvasSink,
  AudioBufferSink,
  ALL_FORMATS,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
} from 'mediabunny';
import type { ExportEngine, ExportRequest, ExportResult } from './types';
import { createCaptionRasterizer } from './rasterizer';

/** H.264 needs even dimensions. */
function evenDim(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

export const mediabunnyEngine: ExportEngine = {
  id: 'mediabunny-webcodecs',

  isSupported() {
    return (
      typeof window !== 'undefined' &&
      'VideoEncoder' in window &&
      'VideoDecoder' in window &&
      'AudioEncoder' in window
    );
  },

  async export(req: ExportRequest): Promise<ExportResult> {
    const width = evenDim(req.width);
    const height = evenDim(req.height);

    // Offscreen mount so GSAP selectors resolve and snapdom can measure. Kept
    // on-screen-sized but pushed far off the viewport (no opacity:0, which would
    // make snapdom capture faded content).
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
    document.body.appendChild(holder);
    const stage = req.buildStage(holder);
    const raster = createCaptionRasterizer(stage.stage);

    const comp = document.createElement('canvas');
    comp.width = width;
    comp.height = height;
    const ctx = comp.getContext('2d');
    if (!ctx) throw new Error('Could not get a 2D canvas context.');

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(req.file) });
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });

    const videoSource = new CanvasSource(comp, { codec: 'avc', bitrate: QUALITY_HIGH });
    output.addVideoTrack(videoSource);

    const audioTrack = await input.getPrimaryAudioTrack();
    let audioSource: AudioBufferSource | null = null;
    if (audioTrack) {
      audioSource = new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_MEDIUM });
      output.addAudioTrack(audioSource);
    }

    const aborted = () => {
      if (req.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    };

    try {
      await output.start();

      // Audio: decode the original track and re-encode (in-memory target, so
      // adding the whole audio track before video is fine).
      if (audioTrack && audioSource) {
        const aSink = new AudioBufferSink(audioTrack);
        for await (const { buffer } of aSink.buffers()) {
          aborted();
          await audioSource.add(buffer);
        }
      }

      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) throw new Error('No video track found in the file.');
      const vSink = new CanvasSink(videoTrack, { width, height, fit: 'fill' });

      const frameDur = 1 / req.fps;
      const count = Math.max(1, Math.round(req.durationSeconds * req.fps));
      const timestamps: number[] = [];
      for (let i = 0; i < count; i++) timestamps.push(i * frameDur);

      let i = 0;
      for await (const wrapped of vSink.canvasesAtTimestamps(timestamps)) {
        aborted();
        const t = i * frameDur;
        ctx.clearRect(0, 0, width, height);
        const frameCanvas = (wrapped as { canvas?: CanvasImageSource } | null)?.canvas;
        if (frameCanvas) ctx.drawImage(frameCanvas, 0, 0, width, height);
        stage.seek(t);
        const capImg = await raster.frame();
        if (capImg) ctx.drawImage(capImg, 0, 0, width, height);
        await videoSource.add(t, frameDur);
        i++;
        req.onProgress?.(i / count);
      }

      await output.finalize();
      const buffer = (output.target as BufferTarget).buffer;
      if (!buffer) throw new Error('Export produced no output.');
      return {
        blob: new Blob([buffer], { type: 'video/mp4' }),
        mimeType: 'video/mp4',
        extension: 'mp4',
      };
    } finally {
      stage.destroy();
      holder.remove();
    }
  },
};
